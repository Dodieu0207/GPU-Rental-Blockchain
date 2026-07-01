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
  chainId: process.env.CHAIN_ID || '31337',
  explorerTxUrl: process.env.EXPLORER_TX_URL || '',
  minStakeWei: process.env.MIN_STAKE_WEI || '50000000000000000',
  defaultAgentUrl: process.env.DEFAULT_AGENT_URL || 'http://localhost:7000',
};

const DATA_FILE = path.join(CONFIG.dataDir, 'decompute-db.json');
const METADATA_FILE = path.join(CONFIG.dataDir, 'gpu-metadata.json');
const USERS_FILE = path.join(CONFIG.dataDir, 'users.json');
const ARCHIVED_GPUS_FILE = path.join(CONFIG.dataDir, 'archived-gpus.json');
const rentalsTimers = new Map();
const DEMO_USERS = [
  {
    walletAddress: '0xeb5db0bc882b30cf8f0489eb5af4e39dea5522e1',
    role: 'provider',
  },
  {
    walletAddress: '0x2a88b29e5cc9e137552b9b8aae3b66b27a784723',
    role: 'renter',
  },
];
const DEMO_ARCHIVED_GPU_CID_PREFIXES = ['bafkreie2l', 'mock-8b5e3', 'mock-b9cdc'];

const initialDb = {
  users: [],
  gpus: [],
  rentals: [],
  providerAgents: [],
  agentReports: [],
  transactions: [],
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
    return normalizeDb(JSON.parse(await fs.readFile(DATA_FILE, 'utf8')));
  } catch {
    await writeDb(initialDb);
    return structuredClone(initialDb);
  }
}

function normalizeDb(db) {
  return {
    ...structuredClone(initialDb),
    ...(db || {}),
    users: Array.isArray(db?.users) ? db.users : [],
    gpus: Array.isArray(db?.gpus) ? db.gpus : [],
    rentals: Array.isArray(db?.rentals) ? db.rentals : [],
    providerAgents: Array.isArray(db?.providerAgents) ? db.providerAgents : [],
    agentReports: Array.isArray(db?.agentReports) ? db.agentReports : [],
    transactions: Array.isArray(db?.transactions) ? db.transactions : [],
  };
}

async function writeDb(db) {
  await fs.mkdir(CONFIG.dataDir, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

async function readMetadataStore() {
  try {
    return JSON.parse(await fs.readFile(METADATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeMetadataStore(store) {
  await fs.mkdir(CONFIG.dataDir, { recursive: true });
  await fs.writeFile(METADATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

async function readUsersStore() {
  let users = [];
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
  } catch {
    users = [];
  }

  const now = new Date().toISOString();
  let changed = false;
  for (const demoUser of DEMO_USERS) {
    const existing = users.find((user) => normalizeAddress(user.walletAddress) === demoUser.walletAddress);
    if (!existing) {
      users.push({
        walletAddress: demoUser.walletAddress,
        role: demoUser.role,
        createdAt: now,
        lastLogin: now,
        seeded: true,
      });
      changed = true;
    }
  }

  if (changed) {
    await writeUsersStore(users);
  }
  return users;
}

async function writeUsersStore(users) {
  await fs.mkdir(CONFIG.dataDir, { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

async function readArchivedGpuStore() {
  let store;
  try {
    store = JSON.parse(await fs.readFile(ARCHIVED_GPUS_FILE, 'utf8'));
  } catch {
    store = {};
  }

  const nextStore = {
    cidPrefixes: Array.isArray(store.cidPrefixes) ? store.cidPrefixes : [],
    cids: Array.isArray(store.cids) ? store.cids : [],
    gpuIds: Array.isArray(store.gpuIds) ? store.gpuIds : [],
  };
  let changed = false;
  for (const prefix of DEMO_ARCHIVED_GPU_CID_PREFIXES) {
    if (!nextStore.cidPrefixes.includes(prefix)) {
      nextStore.cidPrefixes.push(prefix);
      changed = true;
    }
  }
  if (changed) {
    await writeArchivedGpuStore(nextStore);
  }
  return nextStore;
}

async function writeArchivedGpuStore(store) {
  await fs.mkdir(CONFIG.dataDir, { recursive: true });
  await fs.writeFile(ARCHIVED_GPUS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

async function saveMetadataForCid(cid, metadata) {
  if (!cid || typeof cid !== 'string') {
    const error = new Error('CID is required.');
    error.statusCode = 400;
    throw error;
  }

  if (!metadata || typeof metadata !== 'object') {
    const error = new Error('metadata object is required.');
    error.statusCode = 400;
    throw error;
  }

  const store = await readMetadataStore();
  store[cid] = {
    cid,
    metadata,
    updatedAt: new Date().toISOString(),
  };
  await writeMetadataStore(store);
  console.log(`Saving metadata for CID: ${cid}`);
  return store[cid];
}

async function getMetadataForCid(cid) {
  const store = await readMetadataStore();
  const row = store[cid] || null;
  console.log(`Loaded metadata for CID: ${cid}`);
  return row;
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

async function sendAgentDownload(response) {
  const agentPath = path.join(__dirname, '..', 'gpu-agent.js');
  const agentSource = await fs.readFile(agentPath, 'utf8');

  response.writeHead(200, {
    'Content-Type': 'application/javascript',
    'Content-Disposition': 'attachment; filename="gpu-agent.js"',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(agentSource);
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

function normalizeAgentUrl(agentUrl) {
  const fallback = CONFIG.defaultAgentUrl;
  const raw = typeof agentUrl === 'string' && agentUrl.trim() ? agentUrl.trim() : fallback;
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
    }
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (
      pathname === '/health' ||
      pathname === '/scan' ||
      pathname === '/sessions/start' ||
      pathname === '/sessions/stop' ||
      pathname.startsWith('/commands/')
    ) {
      parsed.pathname = '/';
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return raw
      .replace(/\/+(health|scan|sessions\/start|sessions\/stop|commands\/startRental|commands\/stopRental)\/?$/i, '')
      .replace(/\/$/, '') || fallback;
  }
}

function getProviderAgentUrl(db, walletAddress) {
  const wallet = normalizeAddress(walletAddress);
  const row = db.providerAgents.find((agent) => normalizeAddress(agent.providerWalletAddress) === wallet);
  return row?.agentUrl ? normalizeAgentUrl(row.agentUrl) : '';
}

const TRANSACTION_TYPE_NAMES = [
  'EscrowDeposited',
  'RentalPaymentRecorded',
  'PlatformFeeRecorded',
  'RefundPaid',
  'ProviderWithdrawal',
  'PlatformWithdrawal',
  'SlashingCompensation',
];

function normalizeTransactionEvent(event) {
  const chainId = String(event.chainId || CONFIG.chainId);
  const contractAddress = normalizeAddress(event.contractAddress || CONFIG.contractAddress);
  const transactionId = String(event.transactionId);
  const txHash = event.txHash || event.transactionHash || '';
  const logIndex = event.logIndex === undefined || event.logIndex === null ? null : Number(event.logIndex);
  const transactionTypeValue = event.transactionType;
  const transactionType =
    typeof transactionTypeValue === 'number' || typeof transactionTypeValue === 'bigint'
      ? TRANSACTION_TYPE_NAMES[Number(transactionTypeValue)] || String(transactionTypeValue)
      : String(transactionTypeValue || '');

  if (!contractAddress) {
    const error = new Error('contractAddress is required for transaction sync.');
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d+$/.test(transactionId)) {
    const error = new Error('transactionId is required for transaction sync.');
    error.statusCode = 400;
    throw error;
  }

  return {
    chainId,
    contractAddress,
    transactionId,
    agreementId: String(event.agreementId ?? '0'),
    gpuId: String(event.gpuId ?? '0'),
    from: normalizeAddress(event.from),
    to: normalizeAddress(event.to),
    amount: String(event.amount ?? '0'),
    timestamp: Number(event.timestamp ?? Math.floor(Date.now() / 1000)),
    transactionType,
    txHash,
    blockNumber: event.blockNumber === undefined || event.blockNumber === null ? null : Number(event.blockNumber),
    logIndex,
    explorerUrl: txHash && CONFIG.explorerTxUrl ? `${CONFIG.explorerTxUrl.replace(/\/$/, '')}/${txHash}` : '',
    indexedAt: new Date().toISOString(),
  };
}

function sameTransaction(left, right) {
  const sameOnChainId =
    left.chainId === right.chainId &&
    left.contractAddress === right.contractAddress &&
    left.transactionId === right.transactionId;

  const sameLog =
    left.chainId === right.chainId &&
    left.txHash &&
    right.txHash &&
    left.txHash.toLowerCase() === right.txHash.toLowerCase() &&
    left.logIndex !== null &&
    right.logIndex !== null &&
    left.logIndex === right.logIndex;

  return sameOnChainId || sameLog;
}

async function upsertTransactionFromEvent(event) {
  const transaction = normalizeTransactionEvent(event);
  const db = await readDb();
  const existingIndex = db.transactions.findIndex((item) => sameTransaction(item, transaction));

  if (existingIndex >= 0) {
    db.transactions[existingIndex] = {
      ...db.transactions[existingIndex],
      ...transaction,
      indexedAt: db.transactions[existingIndex].indexedAt || transaction.indexedAt,
      updatedAt: new Date().toISOString(),
    };
  } else {
    db.transactions.push(transaction);
  }

  await writeDb(db);
  return existingIndex >= 0 ? db.transactions[existingIndex] : transaction;
}

function filterTransactions(transactions, query) {
  const walletAddress = normalizeAddress(query.get('walletAddress') || query.get('wallet') || '');
  const agreementId = query.get('agreementId');
  const gpuId = query.get('gpuId');

  return transactions
    .filter((transaction) => {
      if (walletAddress && transaction.from !== walletAddress && transaction.to !== walletAddress) return false;
      if (agreementId !== null && String(transaction.agreementId) !== String(agreementId)) return false;
      if (gpuId !== null && String(transaction.gpuId) !== String(gpuId)) return false;
      return true;
    })
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp) || Number(b.transactionId) - Number(a.transactionId));
}

async function connectWallet(request) {
  const body = await readJsonBody(request);
  return signInUser(body.walletAddress);
}

async function signUpUser(body) {
  const walletAddress = normalizeAddress(body.walletAddress);
  const role = body.role || 'renter';

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

  const users = await readUsersStore();
  const now = new Date().toISOString();
  let user = users.find((item) => normalizeAddress(item.walletAddress) === walletAddress);

  if (!user) {
    user = { walletAddress, role, createdAt: now, lastLogin: now };
    users.push(user);
    await writeUsersStore(users);
    return user;
  }

  user.lastLogin = now;
  await writeUsersStore(users);
  return user;
}

async function signInUser(walletAddressInput) {
  const walletAddress = normalizeAddress(walletAddressInput);
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    const error = new Error('Valid walletAddress is required.');
    error.statusCode = 400;
    throw error;
  }

  const users = await readUsersStore();
  const user = users.find((item) => normalizeAddress(item.walletAddress) === walletAddress);
  if (!user) {
    const error = new Error('Wallet is not registered. Please sign up first.');
    error.statusCode = 404;
    throw error;
  }

  user.lastLogin = new Date().toISOString();
  await writeUsersStore(users);
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
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 30000));
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const reason = error.name === 'AbortError' ? 'request timed out' : error.message;
    throw new Error(`Request failed for ${url}: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.error || `${url} returned ${response.status} ${response.statusText}`);
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
  const savedAgentUrl = getProviderAgentUrl(db, providerWalletAddress);
  const agentUrl = normalizeAgentUrl(body.agentUrl || savedAgentUrl || CONFIG.defaultAgentUrl);
  if (body.metadata && typeof body.metadata === 'object') {
    await saveMetadataForCid(body.cid, body.metadata);
  }
  const storedMetadata = await getMetadataForCid(body.cid);
  const metadata = body.metadata || storedMetadata?.metadata || null;

  const existingGpu = db.gpus.find((item) => item.cid === body.cid && normalizeAddress(item.providerWalletAddress) === providerWalletAddress);
  const gpu = existingGpu || {
    id: crypto.randomUUID(),
    providerId: body.providerId || user.id,
    providerWalletAddress,
    machineId: body.machineId || '',
    metadataCID: body.cid,
    cid: body.cid,
    metadata,
    spec: body.spec || `ipfs://${body.cid}`,
    specHash: body.specHash || body.cid,
    pricePerHourWei: body.pricePerHourWei,
    pricePerHour: body.pricePerHourWei,
    agentUrl,
    status: 'available',
    availability: 'available',
    available: true,
    isAvailable: true,
    rented: false,
    isRented: false,
    state: 'available',
    createdAt: now,
    updatedAt: now,
    contract: {
      status: 'pending_frontend_or_relayer',
      functionName: 'registerGPUWithCID',
      note:
        'Call registerGPUWithCID(spec, cid, pricePerHourWei) with MIN_STAKE from the provider wallet.',
    },
  };

  if (existingGpu) {
    existingGpu.providerId = body.providerId || existingGpu.providerId || user.id;
    existingGpu.providerWalletAddress = providerWalletAddress;
    existingGpu.machineId = body.machineId || existingGpu.machineId || '';
    existingGpu.metadataCID = body.cid;
    existingGpu.cid = body.cid;
    existingGpu.metadata = metadata || existingGpu.metadata || null;
    existingGpu.spec = body.spec || existingGpu.spec || `ipfs://${body.cid}`;
    existingGpu.specHash = body.specHash || existingGpu.specHash || body.cid;
    existingGpu.pricePerHourWei = body.pricePerHourWei;
    existingGpu.pricePerHour = body.pricePerHourWei;
    existingGpu.agentUrl = agentUrl || existingGpu.agentUrl || CONFIG.defaultAgentUrl;
    existingGpu.updatedAt = now;
    if (!db.rentals.some((rental) => rental.gpuId === existingGpu.id && isActiveRentalStatus(rental.status))) {
      setGpuAvailability(existingGpu, 'available');
    }
  } else {
    db.gpus.push(gpu);
  }
  const existingAgent = db.providerAgents.find((agent) => normalizeAddress(agent.providerWalletAddress) === providerWalletAddress);
  if (existingAgent) {
    existingAgent.agentUrl = agentUrl;
    existingAgent.updatedAt = now;
  } else {
    db.providerAgents.push({
      providerWalletAddress,
      agentUrl,
      createdAt: now,
      updatedAt: now,
    });
  }
  await writeDb(db);
  console.log(`Saved agentUrl for host ${providerWalletAddress}: ${agentUrl}`);

  return gpu;
}

async function saveProviderAgent(request) {
  const user = requireProvider(request);
  const body = await readJsonBody(request);
  const providerWalletAddress = normalizeAddress(body.providerWalletAddress || body.walletAddress || user.walletAddress);
  if (!providerWalletAddress) {
    const error = new Error('providerWalletAddress is required.');
    error.statusCode = 400;
    throw error;
  }

  const agentUrl = normalizeAgentUrl(body.agentUrl);
  const db = await readDb();
  const now = new Date().toISOString();
  const existing = db.providerAgents.find((agent) => normalizeAddress(agent.providerWalletAddress) === providerWalletAddress);
  if (existing) {
    existing.agentUrl = agentUrl;
    existing.updatedAt = now;
  } else {
    db.providerAgents.push({
      providerWalletAddress,
      agentUrl,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const gpu of db.gpus) {
    if (normalizeAddress(gpu.providerWalletAddress) === providerWalletAddress) {
      gpu.agentUrl = agentUrl;
      gpu.updatedAt = now;
    }
  }

  await writeDb(db);
  console.log(`Saved agentUrl for host ${providerWalletAddress}: ${agentUrl}`);
  return { providerWalletAddress, agentUrl, updatedAt: now };
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
  const db = await reconcileRentalState();
  let gpu = db.gpus.find((item) => item.id === body.gpuId || item.cid === body.cid);

  if (!gpu) {
    gpu = createGpuFromRentalSnapshot(body, user);
    db.gpus.push(gpu);
  }

  if (isArchivedGpu(gpu, await readArchivedGpuStore())) {
    const error = new Error('GPU is archived for demo reset.');
    error.statusCode = 410;
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
    escrowAmountWei: body.escrowAmountWei || '',
    smartContractAgreementId: body.smartContractAgreementId ?? null,
    session: null,
  };

  gpu.status = 'rented';
  setGpuAvailability(gpu, 'rented');
  gpu.updatedAt = now.toISOString();
  db.rentals.push(rental);
  await writeDb(db);

  try {
    const agentUrl = normalizeAgentUrl(gpu.agentUrl || getProviderAgentUrl(db, gpu.providerWalletAddress) || CONFIG.defaultAgentUrl);
    gpu.agentUrl = agentUrl;
    console.log(`Starting session for gpuId/cid ${gpu.id}/${gpu.cid || ''} using agentUrl ${agentUrl}`);
    console.log(`POST ${agentUrl}/sessions/start`);
    console.log(`Start body rentalId=${rental.id} gpuId=${gpu.id} cid=${gpu.cid || ''}`);
    const session = await fetchJson(`${agentUrl}/sessions/start`, {
      method: 'POST',
      body: JSON.stringify({
        rentalId: rental.id,
        sessionId: rental.id,
        gpuId: gpu.id,
        cid: gpu.cid || '',
        renterId: rental.renterId,
        durationSeconds,
      }),
    });

    rental.status = 'active';
    rental.session = session;
    const accessInfo = session?.accessInfo || {};
    if (accessInfo.containerId || accessInfo.sshPort) {
      console.log(`Container started ${accessInfo.containerId || session.containerId || 'unknown'} port ${accessInfo.sshPort || 'unknown'}`);
    }
    await writeDb(db);
    scheduleRentalStop(rental.id, durationSeconds);
  } catch (error) {
    console.error(`Agent start failed for rental ${rental.id}: ${error.message}`);
    rental.status = 'pending';
    rental.error = error.message;
    rental.session = {
      accessUrl: '',
      containerId: '',
      status: 'agent_start_failed',
      mode: 'agent_start_failed',
      note: 'Agent start failed. Use End/Cancel to release the GPU, then retry after Agent is healthy.',
    };
    await writeDb(db);
    scheduleRentalStop(rental.id, durationSeconds);
  }

  return rental;
}

function createGpuFromRentalSnapshot(body, user) {
  const snapshot = body.gpuSnapshot || {};
  const cid = body.cid || snapshot.cid || '';
  const now = new Date().toISOString();
  return {
    id: String(body.gpuId || snapshot.id || crypto.randomUUID()),
    providerId: snapshot.provider || 'on-chain-provider',
    providerWalletAddress: normalizeAddress(snapshot.provider || body.providerWalletAddress || ''),
    machineId: snapshot.machineId || '',
    metadataCID: cid,
    cid,
    metadata: snapshot,
    spec: snapshot.name || snapshot.gpu || `ipfs://${cid}`,
    specHash: cid,
    pricePerHourWei: snapshot.priceWei || body.pricePerHourWei || '0',
    pricePerHour: snapshot.priceWei || body.pricePerHourWei || '0',
    agentUrl: normalizeAgentUrl(snapshot.agentUrl || body.agentUrl || CONFIG.defaultAgentUrl),
    status: 'available',
    availability: 'available',
    available: true,
    isAvailable: true,
    rented: false,
    isRented: false,
    state: 'available',
    createdAt: now,
    updatedAt: now,
    note: `Created from rental snapshot by ${user.id}; on-chain GPU existed before backend metadata sync.`,
  };
}

async function stopRentalById(rentalId, reason = 'manual') {
  const db = await readDb();
  const rental = db.rentals.find((item) => item.id === rentalId);

  if (!rental) {
    const error = new Error('Rental not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!isActiveRentalStatus(rental.status)) {
    return rental;
  }

  const gpu = db.gpus.find((item) => item.id === rental.gpuId);

  const timer = rentalsTimers.get(rental.id);
  if (timer) {
    clearTimeout(timer);
    rentalsTimers.delete(rental.id);
  }

  let session;
  try {
    if (!gpu) {
      throw new Error('GPU for rental not found. Skipping container stop.');
    }
    const agentUrl = normalizeAgentUrl(gpu.agentUrl || getProviderAgentUrl(db, gpu.providerWalletAddress) || CONFIG.defaultAgentUrl);
    gpu.agentUrl = agentUrl;
    session = await fetchJson(`${agentUrl}/sessions/stop`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: rental.id,
        rentalId: rental.id,
        containerId: rental.session?.accessInfo?.containerId || rental.session?.containerId || '',
        reason,
      }),
    });
  } catch (error) {
    session = {
      status: 'agent-bypassed',
      mode: 'agent-bypassed',
      note: 'Agent stop was skipped for the Sepolia smart-contract demo.',
      error: error.message,
    };
  }

  rental.status = 'completed';
  rental.stoppedAt = new Date().toISOString();
  rental.stopReason = reason;
  rental.session = session;
  rental.contract = await tryEndRentalOnChain(rental);
  if (gpu) {
    setGpuAvailability(gpu, 'available');
    gpu.updatedAt = rental.stoppedAt;
  }

  await writeDb(db);
  return rental;
}

async function reconcileRentalState() {
  const db = await readDb();
  const now = Date.now();
  const expiredActiveRentals = db.rentals.filter((rental) => {
    return isActiveRentalStatus(rental.status) &&
      rental.rentalEndTime &&
      new Date(rental.rentalEndTime).getTime() <= now;
  });

  if (expiredActiveRentals.length > 0) {
    for (const rental of expiredActiveRentals) {
      await stopRentalById(rental.id, 'expired');
    }
    return readDb();
  }

  let changed = await enrichDbGpuMetadata(db);
  for (const gpu of db.gpus) {
    const hasActiveRental = db.rentals.some((rental) => {
      return rental.gpuId === gpu.id && isActiveRentalStatus(rental.status);
    });

    if (hasActiveRental && !hasNormalizedAvailabilityFields(gpu, false)) {
      setGpuAvailability(gpu, 'rented');
      gpu.updatedAt = gpu.updatedAt || new Date().toISOString();
      changed = true;
    } else if (isGpuMarkedBusy(gpu) || !hasNormalizedAvailabilityFields(gpu, true)) {
      setGpuAvailability(gpu, 'available');
      gpu.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    await writeDb(db);
  }

  return db;
}

async function getVisibleGpus(db) {
  const archived = await readArchivedGpuStore();
  return db.gpus.filter((gpu) => !isArchivedGpu(gpu, archived));
}

function isArchivedGpu(gpu, archived) {
  const cid = gpu.cid || gpu.metadataCID || gpu.specHash || '';
  const gpuId = String(gpu.id || gpu.gpuId || '');
  return archived.gpuIds.includes(gpuId) ||
    archived.cids.includes(cid) ||
    archived.cidPrefixes.some((prefix) => cid.startsWith(prefix));
}

async function archiveGpus(request) {
  const body = await readJsonBody(request);
  const store = await readArchivedGpuStore();
  const cids = Array.isArray(body.cids) ? body.cids : [];
  const cidPrefixes = Array.isArray(body.cidPrefixes) ? body.cidPrefixes : [];
  const gpuIds = Array.isArray(body.gpuIds) ? body.gpuIds : [];
  for (const cid of cids) if (cid && !store.cids.includes(cid)) store.cids.push(cid);
  for (const prefix of cidPrefixes) if (prefix && !store.cidPrefixes.includes(prefix)) store.cidPrefixes.push(prefix);
  for (const gpuId of gpuIds) if (gpuId && !store.gpuIds.includes(gpuId)) store.gpuIds.push(gpuId);
  await writeArchivedGpuStore(store);
  return store;
}

async function enrichDbGpuMetadata(db) {
  const store = await readMetadataStore();
  let dbChanged = false;
  let storeChanged = false;

  for (const gpu of db.gpus) {
    const cid = gpu.cid || gpu.metadataCID || gpu.specHash;
    if (!cid) continue;

    const stored = store[cid]?.metadata;
    if (stored) {
      const changed = JSON.stringify(gpu.metadata || null) !== JSON.stringify(stored);
      gpu.metadata = stored;
      console.log(`Enriched GPU with metadata: true (${cid})`);
      if (changed) dbChanged = true;
      continue;
    }

    if (isUsefulMetadata(gpu.metadata)) {
      store[cid] = {
        cid,
        metadata: gpu.metadata,
        updatedAt: new Date().toISOString(),
      };
      console.log(`Saving metadata for CID: ${cid}`);
      storeChanged = true;
    } else {
      console.log(`Enriched GPU with metadata: false (${cid})`);
    }
  }

  if (storeChanged) {
    await writeMetadataStore(store);
  }

  return dbChanged;
}

function isUsefulMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return Boolean(metadata.gpuName || metadata.gpu || metadata.name || metadata.vramGB || metadata.vram || metadata.cpu || metadata.os);
}

function isActiveRentalStatus(status) {
  return ['active', 'starting', 'pending', 'agent_start_failed'].includes(status);
}

function isGpuMarkedBusy(gpu) {
  return gpu.status === 'rented' ||
    gpu.status === 'unavailable' ||
    gpu.availability === 'rented' ||
    gpu.availability === 'unavailable' ||
    gpu.available === false ||
    gpu.isAvailable === false ||
    gpu.rented === true ||
    gpu.isRented === true ||
    gpu.state === 'rented' ||
    gpu.state === 'unavailable';
}

function hasNormalizedAvailabilityFields(gpu, expectedAvailable) {
  return gpu.status === (expectedAvailable ? 'available' : 'rented') &&
    gpu.availability === (expectedAvailable ? 'available' : 'rented') &&
    gpu.available === expectedAvailable &&
    gpu.isAvailable === expectedAvailable &&
    gpu.rented === !expectedAvailable &&
    gpu.isRented === !expectedAvailable &&
    gpu.state === (expectedAvailable ? 'available' : 'rented');
}

function setGpuAvailability(gpu, status) {
  const available = status === 'available';
  gpu.status = available ? 'available' : 'rented';
  gpu.availability = available ? 'available' : 'rented';
  gpu.available = available;
  gpu.isAvailable = available;
  gpu.rented = !available;
  gpu.isRented = !available;
  gpu.state = available ? 'available' : 'rented';
  return gpu;
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
      'event TransactionRecorded(uint256 indexed transactionId,uint256 indexed agreementId,uint256 indexed gpuId,address from,address to,uint256 amount,uint256 timestamp,uint8 transactionType)',
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
    const indexedTransactions = await syncTransactionRecordedLogs(receipt, contract.interface, CONFIG.contractAddress);
    return {
      status: 'confirmed',
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      indexedTransactions,
    };
  } catch (error) {
    return { status: 'failed', error: error.message };
  }
}

async function syncTransactionRecordedLogs(receipt, iface, contractAddress = CONFIG.contractAddress) {
  const logs = [];
  for (const log of receipt.logs || []) {
    if (contractAddress && normalizeAddress(log.address) !== normalizeAddress(contractAddress)) continue;

    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name !== 'TransactionRecorded') continue;

      const transaction = await upsertTransactionFromEvent({
        chainId: CONFIG.chainId,
        contractAddress: log.address || contractAddress,
        transactionId: parsed.args.transactionId,
        agreementId: parsed.args.agreementId,
        gpuId: parsed.args.gpuId,
        from: parsed.args.from,
        to: parsed.args.to,
        amount: parsed.args.amount,
        timestamp: parsed.args.timestamp,
        transactionType: parsed.args.transactionType,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        logIndex: log.index,
      });
      logs.push(transaction);
    } catch {
      // Ignore unrelated logs in the same receipt.
    }
  }
  return logs;
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

    if (request.method === 'GET' && url.pathname === '/api/agent/download') {
      return sendAgentDownload(response);
    }

    if (request.method === 'POST' && url.pathname === '/api/users/connect-wallet') {
      return sendJson(response, 200, await connectWallet(request));
    }

    if (request.method === 'POST' && url.pathname === '/api/users/signup') {
      return sendJson(response, 201, await signUpUser(await readJsonBody(request)));
    }

    if (request.method === 'POST' && url.pathname === '/api/users/signin') {
      const body = await readJsonBody(request);
      return sendJson(response, 200, await signInUser(body.walletAddress));
    }

    if (request.method === 'POST' && url.pathname === '/api/agent/report') {
      return sendJson(response, 200, await handleAgentReport(await readJsonBody(request)));
    }

    if (request.method === 'POST' && url.pathname === '/api/metadata') {
      const body = await readJsonBody(request);
      return sendJson(response, 200, await saveMetadataForCid(body.cid, body.metadata));
    }

    const metadataMatch = url.pathname.match(/^\/api\/metadata\/(.+)$/);
    if (request.method === 'GET' && metadataMatch) {
      const cid = decodeURIComponent(metadataMatch[1]);
      const row = await getMetadataForCid(cid);
      if (!row) {
        return sendJson(response, 404, { error: 'Metadata not found.' });
      }
      return sendJson(response, 200, row);
    }

    if (request.method === 'POST' && url.pathname === '/api/provider/gpus') {
      return sendJson(response, 201, await registerProviderGpu(request));
    }

    if (request.method === 'POST' && url.pathname === '/api/provider/agent') {
      return sendJson(response, 200, await saveProviderAgent(request));
    }

    if (request.method === 'GET' && url.pathname === '/api/gpus') {
      const db = await reconcileRentalState();
      return sendJson(response, 200, await getVisibleGpus(db));
    }

    if (request.method === 'GET' && url.pathname === '/api/dev/archived-gpus') {
      return sendJson(response, 200, await readArchivedGpuStore());
    }

    if (request.method === 'POST' && url.pathname === '/api/dev/archive-gpus') {
      return sendJson(response, 200, await archiveGpus(request));
    }

    if (request.method === 'POST' && url.pathname === '/api/rentals') {
      return sendJson(response, 201, await startRental(request));
    }

    const stopMatch = url.pathname.match(/^\/api\/rentals\/([^/]+)\/stop$/);
    if (request.method === 'POST' && stopMatch) {
      return sendJson(response, 200, await stopRentalById(stopMatch[1], 'manual'));
    }

    if (request.method === 'GET' && url.pathname === '/api/rentals') {
      const db = await reconcileRentalState();
      return sendJson(response, 200, db.rentals);
    }

    if (request.method === 'POST' && url.pathname === '/api/transactions/sync-event') {
      const body = await readJsonBody(request);
      if (Array.isArray(body.events)) {
        const transactions = [];
        for (const event of body.events) {
          transactions.push(await upsertTransactionFromEvent(event));
        }
        return sendJson(response, 200, { transactions });
      }
      return sendJson(response, 200, await upsertTransactionFromEvent(body));
    }

    if (request.method === 'GET' && url.pathname === '/api/transactions') {
      const db = await readDb();
      return sendJson(response, 200, filterTransactions(db.transactions, url.searchParams));
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
  await readUsersStore();
  await readArchivedGpuStore();
  await restoreRentalTimers();
  const server = http.createServer((request, response) => {
    handleRequest(request, response);
  });

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`DeCompute backend listening on http://${CONFIG.host}:${CONFIG.port}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIG,
  DATA_FILE,
  connectWallet,
  filterTransactions,
  normalizeAddress,
  normalizeDb,
  normalizeTransactionEvent,
  readDb,
  upsertTransactionFromEvent,
  writeDb,
};
