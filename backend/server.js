#!/usr/bin/env node

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

loadEnvFile(path.join(__dirname, '.env'));

const CONFIG = {
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
  contractAddress: process.env.CONTRACT_ADDRESS || '',
  contractRpcUrl: process.env.CONTRACT_RPC_URL || '',
  contractPrivateKey: process.env.CONTRACT_PRIVATE_KEY || '',
  minStakeWei: process.env.MIN_STAKE_WEI || '50000000000000000',
  defaultAgentUrl: process.env.DEFAULT_AGENT_URL || 'http://localhost:5055',
};

const DATA_FILE = path.join(CONFIG.dataDir, 'decompute-db.json');
const rentalsTimers = new Map();

const initialDb = {
  users: [],
  gpus: [],
  rentals: [],
  agentReports: [],
};

function loadEnvFile(envPath) {
  try {
    const text = require('fs').readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional.
  }
}

async function readDb() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch {
    await writeDb(initialDb);
    return structuredClone(initialDb);
  }
}

async function writeDb(db) {
  await fs.mkdir(CONFIG.dataDir, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Role, X-Wallet-Address',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  response.end(JSON.stringify(body, null, 2));
}

function getUser(request) {
  return {
    id: request.headers['x-user-id'] || 'demo-user',
    role: request.headers['x-user-role'] || 'guest',
    walletAddress: normalizeAddress(request.headers['x-wallet-address'] || ''),
  };
}

function normalizeAddress(address) {
  return typeof address === 'string' ? address.trim().toLowerCase() : '';
}

async function connectWallet(request) {
  const body = await readJsonBody(request);
  const walletAddress = normalizeAddress(body.walletAddress);
  const role = body.role || 'renter';
  const userId = body.userId || walletAddress || 'demo-user';

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    const error = new Error('Valid walletAddress is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!['renter', 'provider', 'admin'].includes(role)) {
    const error = new Error('Role must be renter, provider, or admin.');
    error.statusCode = 400;
    throw error;
  }

  const db = await readDb();
  db.users = db.users || [];
  const now = new Date().toISOString();
  let user = db.users.find((item) => item.id === userId || item.walletAddress === walletAddress);

  if (!user) {
    user = { id: userId, walletAddress, role, createdAt: now, updatedAt: now };
    db.users.push(user);
  } else {
    user.walletAddress = walletAddress;
    user.role = role;
    user.updatedAt = now;
  }

  await writeDb(db);
  return user;
}

function requireProvider(request) {
  const user = getUser(request);
  if (!['provider', 'admin'].includes(user.role)) {
    const error = new Error('Only provider accounts can register GPUs.');
    error.statusCode = 403;
    throw error;
  }
  return user;
}

function requireTenant(request) {
  const user = getUser(request);
  if (!['tenant', 'renter', 'admin'].includes(user.role)) {
    const error = new Error('Only renter accounts can start rentals.');
    error.statusCode = 403;
    throw error;
  }
  return user;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.error || `${response.status} ${response.statusText}`);
  }

  return body;
}

async function registerProviderGpu(request) {
  const user = requireProvider(request);
  const body = await readJsonBody(request);

  if (!body.cid || typeof body.cid !== 'string') {
    const error = new Error('CID is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!body.pricePerHourWei || BigInt(body.pricePerHourWei) <= 0n) {
    const error = new Error('pricePerHourWei must be greater than zero.');
    error.statusCode = 400;
    throw error;
  }

  const db = await readDb();
  const now = new Date().toISOString();
  const providerWalletAddress = normalizeAddress(body.providerWalletAddress || body.walletAddress || user.walletAddress);

  const gpu = {
    id: crypto.randomUUID(),
    providerId: body.providerId || user.id,
    providerWalletAddress,
    machineId: body.machineId || '',
    metadataCID: body.cid,
    cid: body.cid,
    spec: body.spec || `ipfs://${body.cid}`,
    specHash: body.specHash || body.cid,
    pricePerHourWei: body.pricePerHourWei,
    pricePerHour: body.pricePerHourWei,
    agentUrl: body.agentUrl || CONFIG.defaultAgentUrl,
    status: 'available',
    createdAt: now,
    updatedAt: now,
    contract: {
      status: 'pending_frontend_or_relayer',
      functionName: 'registerGPUWithCID',
      note:
        'Call registerGPUWithCID(spec, cid, pricePerHourWei) with MIN_STAKE from the provider wallet.',
    },
  };

  db.gpus.push(gpu);
  await writeDb(db);

  return gpu;
}

async function handleAgentReport(body) {
  const db = await readDb();
  const now = new Date().toISOString();
  db.agentReports.push({ ...body, receivedAt: now });
  await writeDb(db);
  return { ok: true, receivedAt: now };
}

async function startRental(request) {
  const user = requireTenant(request);
  const body = await readJsonBody(request);
  const db = await readDb();
  const gpu = db.gpus.find((item) => item.id === body.gpuId || item.cid === body.cid);

  if (!gpu) {
    const error = new Error('GPU not found.');
    error.statusCode = 404;
    throw error;
  }

  if (gpu.status !== 'available') {
    const error = new Error('GPU is not available.');
    error.statusCode = 409;
    throw error;
  }

  const now = new Date();
  const durationSeconds = Number(body.durationSeconds || body.hours * 3600 || 3600);
  const rental = {
    id: crypto.randomUUID(),
    gpuId: gpu.id,
    renterId: body.renterId || user.id,
    renterWalletAddress: normalizeAddress(body.renterWalletAddress || body.walletAddress || user.walletAddress),
    providerId: gpu.providerId,
    providerWalletAddress: gpu.providerWalletAddress || '',
    status: 'starting',
    startedAt: now.toISOString(),
    rentalEndTime: new Date(now.getTime() + durationSeconds * 1000).toISOString(),
    durationSeconds,
    escrowTxHash: body.escrowTxHash || '',
    smartContractAgreementId: body.smartContractAgreementId ?? null,
    session: null,
  };

  gpu.status = 'rented';
  gpu.updatedAt = now.toISOString();
  db.rentals.push(rental);
  await writeDb(db);

  try {
    const session = await fetchJson(`${gpu.agentUrl}/commands/startRental`, {
      method: 'POST',
      body: JSON.stringify({
        rentalId: rental.id,
        sessionId: rental.id,
        gpuId: gpu.id,
        renterId: rental.renterId,
        durationSeconds,
      }),
    });

    rental.status = 'active';
    rental.session = session;
    await writeDb(db);
    scheduleRentalStop(rental.id, durationSeconds);
  } catch (error) {
    rental.status = 'agent_start_failed';
    rental.error = error.message;
    gpu.status = 'available';
    await writeDb(db);
    throw error;
  }

  return rental;
}

async function stopRentalById(rentalId, reason = 'manual') {
  const db = await readDb();
  const rental = db.rentals.find((item) => item.id === rentalId);

  if (!rental) {
    const error = new Error('Rental not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!['active', 'starting'].includes(rental.status)) {
    return rental;
  }

  const gpu = db.gpus.find((item) => item.id === rental.gpuId);
  if (!gpu) {
    const error = new Error('GPU for rental not found.');
    error.statusCode = 404;
    throw error;
  }

  const timer = rentalsTimers.get(rental.id);
  if (timer) {
    clearTimeout(timer);
    rentalsTimers.delete(rental.id);
  }

  const session = await fetchJson(`${gpu.agentUrl}/commands/stopRental`, {
    method: 'POST',
    body: JSON.stringify({ sessionId: rental.id, rentalId: rental.id, reason }),
  });

  rental.status = 'completed';
  rental.stoppedAt = new Date().toISOString();
  rental.stopReason = reason;
  rental.session = session;
  rental.contract = await tryEndRentalOnChain(rental);
  gpu.status = 'available';
  gpu.updatedAt = rental.stoppedAt;

  await writeDb(db);
  return rental;
}

async function tryEndRentalOnChain(rental) {
  if (
    !CONFIG.contractAddress ||
    !CONFIG.contractRpcUrl ||
    !CONFIG.contractPrivateKey ||
    rental.smartContractAgreementId === null
  ) {
    return {
      status: 'skipped',
      note: 'Missing contract env or smartContractAgreementId. Frontend/admin can call endRentalSession manually.',
    };
  }

  try {
    const { ethers } = require('ethers');
    const abi = [
      'function endRentalSession(uint256 agreementId,string telemetryHash) external',
    ];
    const provider = new ethers.JsonRpcProvider(CONFIG.contractRpcUrl);
    const wallet = new ethers.Wallet(CONFIG.contractPrivateKey, provider);
    const contract = new ethers.Contract(CONFIG.contractAddress, abi, wallet);
    const telemetryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(rental))
      .digest('hex');
    const tx = await contract.endRentalSession(rental.smartContractAgreementId, telemetryHash);
    const receipt = await tx.wait();
    return { status: 'confirmed', txHash: receipt.hash };
  } catch (error) {
    return { status: 'failed', error: error.message };
  }
}

function scheduleRentalStop(rentalId, durationSeconds) {
  const timer = setTimeout(() => {
    stopRentalById(rentalId, 'expired').catch((error) => {
      console.error(`Auto stop failed for rental ${rentalId}:`, error.message);
    });
  }, durationSeconds * 1000);
  rentalsTimers.set(rentalId, timer);
}

async function restoreRentalTimers() {
  const db = await readDb();
  const now = Date.now();
  for (const rental of db.rentals.filter((item) => item.status === 'active')) {
    const ms = new Date(rental.rentalEndTime).getTime() - now;
    if (ms <= 0) {
      stopRentalById(rental.id, 'expired').catch((error) => {
        console.error(`Restore auto stop failed for rental ${rental.id}:`, error.message);
      });
    } else {
      scheduleRentalStop(rental.id, Math.ceil(ms / 1000));
    }
  }
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'OPTIONS') {
      return sendJson(response, 204, {});
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(response, 200, { ok: true, service: 'decompute-backend' });
    }

    if (request.method === 'POST' && url.pathname === '/api/users/connect-wallet') {
      return sendJson(response, 200, await connectWallet(request));
    }

    if (request.method === 'POST' && url.pathname === '/api/agent/report') {
      return sendJson(response, 200, await handleAgentReport(await readJsonBody(request)));
    }

    if (request.method === 'POST' && url.pathname === '/api/provider/gpus') {
      return sendJson(response, 201, await registerProviderGpu(request));
    }

    if (request.method === 'GET' && url.pathname === '/api/gpus') {
      const db = await readDb();
      return sendJson(response, 200, db.gpus);
    }

    if (request.method === 'POST' && url.pathname === '/api/rentals') {
      return sendJson(response, 201, await startRental(request));
    }

    const stopMatch = url.pathname.match(/^\/api\/rentals\/([^/]+)\/stop$/);
    if (request.method === 'POST' && stopMatch) {
      return sendJson(response, 200, await stopRentalById(stopMatch[1], 'manual'));
    }

    if (request.method === 'GET' && url.pathname === '/api/rentals') {
      const db = await readDb();
      return sendJson(response, 200, db.rentals);
    }

    if (request.method === 'POST' && url.pathname === '/api/agent/rental-stopped') {
      return sendJson(response, 200, { ok: true, body: await readJsonBody(request) });
    }

    return sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(response, error.statusCode || 500, { error: error.message });
  }
}

async function main() {
  await restoreRentalTimers();
  const server = http.createServer((request, response) => {
    handleRequest(request, response);
  });

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`DeCompute backend listening on http://${CONFIG.host}:${CONFIG.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
