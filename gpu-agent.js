#!/usr/bin/env node

const http = require('http');
const os = require('os');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

loadEnvFile(path.join(__dirname, '.env'));

const CONFIG = {
  backendUrl: process.env.AGENT_BACKEND_URL || 'http://localhost:5000',
  agentHost: process.env.AGENT_HOST || '0.0.0.0',
  agentPort: Number(process.env.AGENT_PORT || 5055),
  providerId: process.env.PROVIDER_ID || '',
  machineId:
    process.env.MACHINE_ID ||
    crypto.createHash('sha256').update(`${os.hostname()}-${os.userInfo().username}`).digest('hex').slice(0, 16),
  metadataDir: process.env.AGENT_METADATA_DIR || path.join(__dirname, '.decompute'),
  ipfsProvider: process.env.IPFS_PROVIDER || '',
  pinataJwt: process.env.PINATA_JWT || '',
  pinataApiKey: process.env.PINATA_API_KEY || '',
  pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY || '',
  localIpfsApiUrl: process.env.IPFS_API_URL || 'http://127.0.0.1:5001',
  dockerMode: process.env.AGENT_DOCKER_MODE || 'mock',
  dockerImage: process.env.AGENT_DOCKER_IMAGE || 'jupyter/tensorflow-notebook:latest',
  publicBaseUrl: process.env.AGENT_PUBLIC_BASE_URL || '',
};

const sessions = new Map();
let gpuStatus = 'available';
let cachedMetadata = null;

const MOCK_GPU = {
  providerId: CONFIG.providerId,
  machineId: CONFIG.machineId,
  gpuName: 'NVIDIA GeForce RTX 3060',
  gpuCount: 1,
  vramGB: 12,
  driverVersion: 'mock-driver',
  cudaVersion: 'mock-cuda',
  status: 'available',
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
    // .env is optional for demo.
  }
}

async function ask(question) {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function scanGpu() {
  const queryCommand =
    'nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits';

  try {
    const [{ stdout: gpuStdout }, { stdout: smiStdout }] = await Promise.all([
      execAsync(queryCommand, { windowsHide: true }),
      execAsync('nvidia-smi', { windowsHide: true }),
    ]);

    const rows = gpuStdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseGpuCsvRow);

    if (rows.length === 0) {
      throw new Error('nvidia-smi returned no GPU rows.');
    }

    const first = rows[0];
    return {
      providerId: CONFIG.providerId,
      machineId: CONFIG.machineId,
      gpuName: first.gpuName,
      gpuCount: rows.length,
      vramGB: first.vramGB,
      driverVersion: first.driverVersion,
      cudaVersion: parseCudaVersion(smiStdout),
      status: gpuStatus,
      gpus: rows,
    };
  } catch (error) {
    console.warn('nvidia-smi unavailable. Using mock GPU metadata for demo.');
    return {
      ...MOCK_GPU,
      providerId: CONFIG.providerId,
      machineId: CONFIG.machineId,
      status: gpuStatus,
      gpus: [
        {
          index: 0,
          gpuName: MOCK_GPU.gpuName,
          vramGB: MOCK_GPU.vramGB,
          driverVersion: MOCK_GPU.driverVersion,
        },
      ],
    };
  }
}

function parseGpuCsvRow(line, index) {
  const [gpuName, memoryMbText, driverVersion] = line.split(',').map((part) => part.trim());
  const memoryMb = Number(memoryMbText);

  if (!gpuName || !Number.isFinite(memoryMb) || memoryMb <= 0) {
    throw new Error(`Invalid nvidia-smi row: ${line}`);
  }

  return {
    index,
    gpuName,
    vramGB: Math.round((memoryMb / 1024) * 10) / 10,
    driverVersion: driverVersion || 'unknown',
  };
}

function parseCudaVersion(nvidiaSmiOutput) {
  const match = nvidiaSmiOutput.match(/CUDA Version:\s*([0-9.]+)/i);
  return match ? match[1] : 'unknown';
}

async function createMetadata() {
  const scanned = await scanGpu();
  const now = new Date().toISOString();

  const metadata = {
    providerId: scanned.providerId,
    machineId: scanned.machineId,
    gpuName: scanned.gpuName,
    gpuCount: scanned.gpuCount,
    vramGB: scanned.vramGB,
    driverVersion: scanned.driverVersion,
    cudaVersion: scanned.cudaVersion,
    status: scanned.status,
    createdAt: cachedMetadata?.createdAt || now,
    updatedAt: now,
    agent: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      dockerMode: CONFIG.dockerMode,
    },
    gpus: scanned.gpus,
  };

  cachedMetadata = metadata;
  await fs.mkdir(CONFIG.metadataDir, { recursive: true });
  const metadataPath = path.join(CONFIG.metadataDir, 'gpu-metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  return { metadata, metadataPath };
}

async function uploadMetadataToIPFS(metadata) {
  const provider = resolveIpfsProvider();

  if (provider === 'pinata') {
    return uploadToPinata(metadata);
  }

  if (provider === 'local') {
    return uploadToLocalIpfs(metadata);
  }

  const cid = `mock-${crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex').slice(0, 46)}`;
  return {
    cid,
    provider: 'mock',
    gatewayUrl: '',
    note: 'No IPFS credentials found. Set PINATA_JWT or IPFS_PROVIDER=local for real upload.',
  };
}

function resolveIpfsProvider() {
  if (CONFIG.ipfsProvider) return CONFIG.ipfsProvider.toLowerCase();
  if (CONFIG.pinataJwt || (CONFIG.pinataApiKey && CONFIG.pinataSecretApiKey)) return 'pinata';
  if (process.env.IPFS_API_URL) return 'local';
  return 'mock';
}

async function uploadToPinata(metadata) {
  const headers = { 'Content-Type': 'application/json' };
  if (CONFIG.pinataJwt) {
    headers.Authorization = `Bearer ${CONFIG.pinataJwt}`;
  } else {
    headers.pinata_api_key = CONFIG.pinataApiKey;
    headers.pinata_secret_api_key = CONFIG.pinataSecretApiKey;
  }

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pinataMetadata: {
        name: `decompute-${metadata.machineId}-${Date.now()}`,
      },
      pinataContent: metadata,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${body.error || response.statusText}`);
  }

  return {
    cid: body.IpfsHash,
    provider: 'pinata',
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${body.IpfsHash}`,
  };
}

async function uploadToLocalIpfs(metadata) {
  const form = new FormData();
  form.append('file', new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }), 'gpu-metadata.json');

  const response = await fetch(`${CONFIG.localIpfsApiUrl}/api/v0/add?pin=true`, {
    method: 'POST',
    body: form,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Local IPFS upload failed: ${text || response.statusText}`);
  }

  const json = JSON.parse(text.trim().split(/\r?\n/).pop());
  return {
    cid: json.Hash,
    provider: 'local',
    gatewayUrl: `http://127.0.0.1:8080/ipfs/${json.Hash}`,
  };
}

async function reportMetadataToBackend(metadata, ipfs) {
  if (!CONFIG.backendUrl) return null;

  const response = await fetch(`${CONFIG.backendUrl}/api/agent/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...metadata, cid: ipfs.cid, ipfs }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Backend report failed: ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function startRental(payload) {
  if (gpuStatus !== 'available') {
    throw new Error('GPU is not available.');
  }

  const sessionId = payload.sessionId || crypto.randomUUID();
  const durationSeconds = Number(payload.durationSeconds || payload.durationMinutes * 60 || 3600);
  const hostPort = Number(payload.hostPort || 8888);
  const token = payload.token || crypto.randomBytes(16).toString('hex');
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);

  let containerId = `mock-${sessionId}`;
  let accessUrl =
    payload.accessUrl ||
    `${CONFIG.publicBaseUrl || `http://localhost:${hostPort}`}/?token=${encodeURIComponent(token)}`;
  let mode = 'mock';

  if (CONFIG.dockerMode === 'real') {
    const result = await execFileAsync('docker', [
      'run',
      '-d',
      '--rm',
      '--gpus',
      'all',
      '-p',
      `${hostPort}:8888`,
      '-e',
      `JUPYTER_TOKEN=${token}`,
      '--name',
      `decompute-${sessionId}`,
      CONFIG.dockerImage,
    ]);
    containerId = result.stdout.trim();
    mode = 'docker';
  }

  gpuStatus = 'rented';
  const session = {
    sessionId,
    rentalId: payload.rentalId || sessionId,
    gpuId: payload.gpuId,
    renterId: payload.renterId,
    containerId,
    status: 'running',
    mode,
    accessUrl,
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };

  session.timer = setTimeout(() => {
    stopRental({ sessionId, reason: 'duration-expired' }).catch((error) => {
      console.error(`Auto-stop failed for ${sessionId}:`, error.message);
    });
  }, durationSeconds * 1000);

  sessions.set(sessionId, session);
  return withoutTimer(session);
}

async function stopRental(payload) {
  const sessionId = payload.sessionId || payload.rentalId;
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error('Rental session not found.');
  }

  if (session.timer) {
    clearTimeout(session.timer);
  }

  if (session.mode === 'docker') {
    await execFileAsync('docker', ['stop', session.containerId]);
  }

  session.status = 'stopped';
  session.stoppedAt = new Date().toISOString();
  session.stopReason = payload.reason || 'manual';
  gpuStatus = 'available';

  await notifyBackendRentalStopped(session).catch((error) => {
    console.warn('Could not notify backend about stopped rental:', error.message);
  });

  return withoutTimer(session);
}

async function notifyBackendRentalStopped(session) {
  const response = await fetch(`${CONFIG.backendUrl}/api/agent/rental-stopped`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withoutTimer(session)),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }
}

async function getAgentStatus() {
  const { metadata } = await createMetadata();
  return {
    status: gpuStatus,
    metadata,
    sessions: [...sessions.values()].map(withoutTimer),
    heartbeatAt: new Date().toISOString(),
  };
}

function withoutTimer(session) {
  const { timer, ...safeSession } = session;
  return safeSession;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body, null, 2));
}

async function handleAgentRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/status') {
      return sendJson(response, 200, await getAgentStatus());
    }

    if (request.method === 'GET' && url.pathname === '/metadata') {
      const { metadata, metadataPath } = await createMetadata();
      return sendJson(response, 200, { metadata, metadataPath });
    }

    if (request.method === 'POST' && url.pathname === '/metadata/upload') {
      const { metadata, metadataPath } = await createMetadata();
      const ipfs = await uploadMetadataToIPFS(metadata);
      return sendJson(response, 200, { metadata, metadataPath, ipfs, cid: ipfs.cid });
    }

    if (request.method === 'POST' && url.pathname === '/commands/startRental') {
      return sendJson(response, 200, await startRental(await readJsonBody(request)));
    }

    if (request.method === 'POST' && url.pathname === '/commands/stopRental') {
      return sendJson(response, 200, await stopRental(await readJsonBody(request)));
    }

    if (request.method === 'POST' && url.pathname === '/commands/getStatus') {
      return sendJson(response, 200, await getAgentStatus());
    }

    if (request.method === 'POST' && url.pathname === '/commands/heartbeat') {
      return sendJson(response, 200, { ok: true, ...(await getAgentStatus()) });
    }

    return sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(response, 500, { error: error.message });
  }
}

function startAgentServer() {
  const server = http.createServer((request, response) => {
    handleAgentRequest(request, response);
  });

  server.listen(CONFIG.agentPort, CONFIG.agentHost, () => {
    console.log(`DeCompute Agent listening on http://${CONFIG.agentHost}:${CONFIG.agentPort}`);
    console.log(`Docker mode: ${CONFIG.dockerMode}. Set AGENT_DOCKER_MODE=real to start real containers.`);
  });
}

async function runRegisterFlow() {
  if (!CONFIG.providerId) {
    const providerId = await ask('Provider ID or wallet address (optional): ');
    if (providerId) CONFIG.providerId = providerId;
  }

  console.log('Scanning GPU hardware...');
  const { metadata, metadataPath } = await createMetadata();
  console.log(`Metadata JSON created: ${metadataPath}`);

  console.log('Uploading metadata to IPFS...');
  const ipfs = await uploadMetadataToIPFS(metadata);
  console.log(`CID: ${ipfs.cid}`);
  if (ipfs.gatewayUrl) console.log(`Gateway: ${ipfs.gatewayUrl}`);
  if (ipfs.note) console.log(ipfs.note);

  try {
    await reportMetadataToBackend(metadata, ipfs);
    console.log('Metadata reported to backend.');
  } catch (error) {
    console.warn(error.message);
  }
}

async function main() {
  const command = process.argv[2] || 'register';

  if (command === 'serve') {
    startAgentServer();
    return;
  }

  if (command === 'scan') {
    console.log(JSON.stringify(await scanGpu(), null, 2));
    return;
  }

  if (command === 'metadata') {
    const result = await createMetadata();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'register' || command === 'upload') {
    await runRegisterFlow();
    return;
  }

  console.log('Usage: node gpu-agent.js [register|scan|metadata|upload|serve]');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
