import { formatEthFromWei } from "@/lib/format";
import { datasetGPUs } from "@/lib/gpuDataset";
import type { GPU, Rental, Transaction, UserRole } from "@/lib/types";

export const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

type BackendGpu = {
  id: string;
  machineId?: string;
  spec?: string;
  cid?: string;
  metadataCID?: string;
  metadata?: Record<string, unknown>;
  pricePerHourWei?: string;
  pricePerHour?: string;
  status?: string;
  availability?: string;
  available?: boolean;
  isAvailable?: boolean;
  rented?: boolean;
  isRented?: boolean;
  state?: string;
  providerId?: string;
  providerWalletAddress?: string;
  createdAt?: string;
  agentUrl?: string;
};

type BackendRental = {
  id: string;
  gpuId: string;
  renterWalletAddress?: string;
  providerWalletAddress?: string;
  status: string;
  startedAt: string;
  rentalEndTime: string;
  durationSeconds?: number;
  escrowTxHash?: string;
  escrowAmountWei?: string;
  smartContractAgreementId?: string | number | null;
  session?: {
    accessUrl?: string;
    containerId?: string;
    status?: string;
    mode?: string;
    accessInfo?: {
      host: string;
      address?: string;
      sshPort: number;
      username: string;
      password: string;
      containerId: string;
      sessionId: string;
      rentalId: string;
      sshCommand: string;
    };
  } | null;
};

type BackendTransaction = {
  transactionId?: string;
  transactionType?: string;
  from?: string;
  to?: string;
  amount?: string;
  timestamp?: number;
  txHash?: string;
  agreementId?: string;
  gpuId?: string;
};

export async function connectProfile(walletAddress: string, role: UserRole) {
  return signInProfile(walletAddress).catch(() => signUpProfile(walletAddress, role));
}

export async function signUpProfile(walletAddress: string, role: UserRole) {
  return fetchJson<{ walletAddress: string; role: "provider" | "renter"; createdAt: string; lastLogin: string }>("/api/users/signup", {
    method: "POST",
    body: JSON.stringify({
      walletAddress,
      role: role === "host" ? "provider" : "renter",
    }),
  });
}

export async function signInProfile(walletAddress: string) {
  return fetchJson<{ walletAddress: string; role: "provider" | "renter"; createdAt: string; lastLogin: string }>("/api/users/signin", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });
}

export async function fetchGpuMarketplace(contractGpus: GPU[] = []): Promise<GPU[]> {
  try {
    const [backendGpus, archived] = await Promise.all([
      fetchJson<BackendGpu[]>("/api/gpus"),
      fetchArchivedGpus().catch(() => ({ cids: [], cidPrefixes: [], gpuIds: [] })),
    ]);
    const mapped = backendGpus.map(mapBackendGpu);
    return mergeMarketplaceSources(mapped, contractGpus).filter((gpu) => !isArchivedFrontendGpu(gpu, archived));
  } catch {
    return mergeMarketplaceSources([], contractGpus);
  }
}

export async function fetchArchivedGpus() {
  return fetchJson<{ cids: string[]; cidPrefixes: string[]; gpuIds: string[] }>("/api/dev/archived-gpus");
}

export async function saveRegisteredGpu(input: {
  cid: string;
  spec: string;
  pricePerHourWei: string;
  providerWalletAddress: string;
  agentUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const agentUrl = normalizeAgentUrl(input.agentUrl);
  return fetchJson<BackendGpu>("/api/provider/gpus", {
    method: "POST",
    headers: authHeaders(input.providerWalletAddress, "host"),
    body: JSON.stringify({
      cid: input.cid,
      metadataCID: input.cid,
      spec: input.spec,
      pricePerHourWei: input.pricePerHourWei,
      providerId: input.providerWalletAddress,
      providerWalletAddress: input.providerWalletAddress,
      agentUrl,
      metadata: input.metadata,
    }),
  });
}

export async function saveProviderAgentUrl(walletAddress: string, agentUrl: string) {
  const normalizedAgentUrl = normalizeAgentUrl(agentUrl);
  return fetchJson<{ providerWalletAddress: string; agentUrl: string; updatedAt: string }>("/api/provider/agent", {
    method: "POST",
    headers: authHeaders(walletAddress, "host"),
    body: JSON.stringify({
      providerWalletAddress: walletAddress,
      agentUrl: normalizedAgentUrl,
    }),
  });
}

export async function saveGpuMetadata(cid: string, metadata: Record<string, unknown>) {
  return fetchJson<{ cid: string; metadata: Record<string, unknown>; updatedAt: string }>("/api/metadata", {
    method: "POST",
    body: JSON.stringify({ cid, metadata }),
  });
}

export async function createRental(input: {
  account: string;
  gpu: GPU;
  hours: number;
  txHash?: string;
  agreementId?: string | null;
}) {
  return fetchJson<BackendRental>("/api/rentals", {
    method: "POST",
    headers: authHeaders(input.account, "tenant"),
    body: JSON.stringify({
      gpuId: input.gpu.id,
      cid: input.gpu.cid,
      renterId: input.account,
      renterWalletAddress: input.account,
      hours: input.hours,
      durationSeconds: input.hours * 3600,
      smartContractAgreementId: input.agreementId,
      escrowTxHash: input.txHash,
      escrowAmountWei: input.gpu.priceWei ? (BigInt(input.gpu.priceWei) * BigInt(input.hours)).toString() : undefined,
      gpuSnapshot: input.gpu,
    }),
  });
}

export async function fetchRentals(walletAddress?: string, role?: UserRole): Promise<Rental[]> {
  const [rentals, gpus] = await Promise.all([
    fetchJson<BackendRental[]>("/api/rentals"),
    fetchGpuMarketplace(),
  ]);
  return rentals
    .map((rental) => mapRental(rental, gpus.find((gpu) => gpu.id === rental.gpuId || gpu.cid === findRentalCid(rental, gpus))))
    .filter((rental) => {
      if (!walletAddress) return true;
      const wallet = walletAddress.toLowerCase();
      if (role === "host") return rental.provider.toLowerCase() === wallet;
      if (role === "tenant") return rental.renter?.toLowerCase() === wallet;
      return true;
    });
}

export async function stopRental(rentalId: string, account: string) {
  return fetchJson<BackendRental>(`/api/rentals/${rentalId}/stop`, {
    method: "POST",
    headers: authHeaders(account, "tenant"),
  });
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const rows = await fetchJson<BackendTransaction[]>("/api/transactions");
  return rows.map((row) => ({
    transactionId: row.transactionId ?? "-",
    type: row.transactionType ?? "Transaction",
    from: row.from ?? "",
    to: row.to ?? "",
    amount: formatEthFromWei(row.amount),
    time: row.timestamp ? new Date(row.timestamp * 1000).toLocaleString() : "Not available",
    status: row.txHash ? "Confirmed" : "Indexed",
    txHash: row.txHash ?? "",
    rentalId: row.agreementId,
    gpu: row.gpuId,
  }));
}

export async function checkAgent(agentUrl: string) {
  const baseUrl = normalizeAgentUrl(agentUrl);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/health`);
  } catch {
    throw new Error("Agent not running. Start it with: node gpu-agent.js serve");
  }
  if (!response.ok) throw new Error("Agent did not respond.");
  return response.json();
}

export async function scanAgent(agentUrl: string) {
  const baseUrl = normalizeAgentUrl(agentUrl);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("Agent not running or blocked by browser CORS. Start it with: node gpu-agent.js serve");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Agent scan failed.");
  const rawMetadata = body?.raw?.metadata ?? body?.metadata ?? {};
  return {
    status: "success",
    cid: body?.cid ?? body?.ipfs?.cid,
    metadata: normalizeMetadata(rawMetadata),
    metadataRaw: rawMetadata,
    raw: body,
  };
}

export function normalizeAgentUrl(agentUrl: string) {
  const raw = (agentUrl || "http://localhost:7000").trim();
  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (
      pathname === "/health" ||
      pathname === "/scan" ||
      pathname === "/sessions/start" ||
      pathname === "/sessions/stop" ||
      pathname.startsWith("/commands/")
    ) {
      parsed.pathname = "/";
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw
      .replace(/\/+(health|scan|sessions\/start|sessions\/stop|commands\/startRental|commands\/stopRental)\/?$/i, "")
      .replace(/\/$/, "");
  }
}

function mergeMarketplaceSources(backendGpus: GPU[], contractGpus: GPU[]) {
  const normalizedContract = contractGpus.map((gpu) => ({ ...gpu, source: "contract" as const }));
  const contractByCid = new Map(normalizedContract.filter((gpu) => gpu.cid).map((gpu) => [gpu.cid, gpu]));
  const backendByCid = pickBackendGpuByCid(backendGpus);

  const merged = datasetGPUs.map((gpu) => {
    const contractGpu = gpu.cid ? contractByCid.get(gpu.cid) : undefined;
    if (contractGpu) {
      const backendGpu = gpu.cid ? backendByCid.get(gpu.cid) : undefined;
      return mergeGpuMetadataAndStatus({ ...gpu, ...contractGpu }, backendGpu, contractGpu);
    }

    const backendGpu = gpu.cid ? backendByCid.get(gpu.cid) : undefined;
    return backendGpu ? { ...gpu, ...backendGpu, status: "unavailable" as const, source: "backend" as const } : gpu;
  });

  const knownCids = new Set(merged.map((gpu) => gpu.cid).filter(Boolean));
  const unknownBackend = [...backendByCid.values()].filter((gpu) => gpu.cid && !knownCids.has(gpu.cid));
  const unknownContract = normalizedContract
    .filter((gpu) => !gpu.cid || !knownCids.has(gpu.cid))
    .map((gpu) => {
      const backendGpu = gpu.cid ? backendByCid.get(gpu.cid) : undefined;
      return backendGpu ? mergeGpuMetadataAndStatus(gpu, backendGpu, gpu) : gpu;
    });
  const backendOnly = unknownBackend.filter((gpu) => gpu.cid && !contractByCid.has(gpu.cid));

  return [...merged, ...backendOnly, ...unknownContract];
}

function isArchivedFrontendGpu(
  gpu: GPU,
  archived: { cids: string[]; cidPrefixes: string[]; gpuIds: string[] },
) {
  const cid = gpu.cid || "";
  return archived.gpuIds.includes(gpu.id) ||
    archived.cids.includes(cid) ||
    archived.cidPrefixes.some((prefix) => cid.startsWith(prefix));
}

function pickBackendGpuByCid(gpus: GPU[]) {
  const byCid = new Map<string, GPU>();
  for (const gpu of gpus) {
    if (!gpu.cid) continue;
    const current = byCid.get(gpu.cid);
    if (!current || isBetterBackendGpu(gpu, current)) {
      byCid.set(gpu.cid, gpu);
    }
  }
  return byCid;
}

function isBetterBackendGpu(candidate: GPU, current: GPU) {
  const candidateHasMetadata = hasResolvedMetadata(candidate);
  const currentHasMetadata = hasResolvedMetadata(current);
  if (candidateHasMetadata !== currentHasMetadata) return candidateHasMetadata;
  const candidateTime = Date.parse(candidate.registeredAt || "");
  const currentTime = Date.parse(current.registeredAt || "");
  if (Number.isFinite(candidateTime) && Number.isFinite(currentTime)) return candidateTime >= currentTime;
  return candidate.status === "available" && current.status !== "available";
}

function mergeGpuMetadataAndStatus(base: GPU, backendGpu: GPU | undefined, contractGpu: GPU): GPU {
  const metadata = backendGpu && hasResolvedMetadata(backendGpu) ? backendGpu : base;
  return {
    ...base,
    ...metadata,
    id: contractGpu.id,
    provider: contractGpu.provider || metadata.provider,
    priceEth: contractGpu.priceEth || metadata.priceEth,
    priceWei: contractGpu.priceWei || metadata.priceWei,
    status: contractGpu.status,
    source: "contract",
  };
}

function hasResolvedMetadata(gpu: GPU) {
  const weakValues = new Set(["Registered GPU", "On-chain metadata", "Unknown", "See metadata", "GPU"]);
  return Boolean(
    gpu.gpu && !weakValues.has(gpu.gpu) &&
    gpu.vram && !weakValues.has(gpu.vram) &&
    gpu.cpu && gpu.cpu !== "On-chain metadata"
  );
}

function mapBackendGpu(gpu: BackendGpu): GPU {
  const dataset = datasetGPUs.find((item) => item.cid === (gpu.cid ?? gpu.metadataCID));
  const metadata = normalizeMetadata(gpu.metadata);
  const spec = metadata.name ?? gpu.spec ?? dataset?.name ?? `Metadata ${gpu.cid ?? gpu.metadataCID ?? ""}`;
  return {
    ...(dataset ?? {
      gpu: metadata.gpu || spec.split("-")[0]?.trim() || "GPU",
      vram: metadata.vram || spec.match(/(\d+(?:\.\d+)?)\s*GB[^-]*/i)?.[0] || "See metadata",
      ram: metadata.ram,
      cpu: metadata.cpu || "See metadata",
      ssd: metadata.ssd || "See metadata",
      cuda: metadata.cuda || "See metadata",
      driverVersion: metadata.driverVersion,
      network: metadata.network || "See metadata",
      os: metadata.os || "See metadata",
      location: metadata.location || "See metadata",
    }),
    id: gpu.id,
    machineId: gpu.machineId || metadata.machineId || dataset?.machineId,
    name: spec,
    cid: gpu.cid ?? gpu.metadataCID ?? dataset?.cid,
    provider: gpu.providerWalletAddress || gpu.providerId || dataset?.provider || "Unknown provider",
    priceEth: formatEthFromWei(gpu.pricePerHourWei ?? gpu.pricePerHour),
    priceWei: gpu.pricePerHourWei ?? gpu.pricePerHour,
    status: normalizeBackendGpuStatus(gpu),
    source: "backend",
    registeredAt: gpu.createdAt,
    agentUrl: gpu.agentUrl,
  };
}

function normalizeBackendGpuStatus(gpu: BackendGpu) {
  const value = String(gpu.status || gpu.availability || gpu.state || "").toLowerCase();
  if (gpu.available === true || gpu.isAvailable === true) return "available";
  if (gpu.rented === true || gpu.isRented === true) return "rented";
  if (gpu.available === false || gpu.isAvailable === false) return "rented";
  if (value === "available") return "available";
  if (value === "rented") return "rented";
  return "unavailable";
}

function mapRental(rental: BackendRental, gpu?: GPU): Rental {
  const normalizedStatus =
    rental.status === "active" ? "running" : rental.status === "completed" ? "ended" : "pending";
  return {
    id: rental.id,
    gpuId: rental.gpuId,
    gpuName: gpu?.name ?? `GPU ${rental.gpuId}`,
    cid: gpu?.cid,
    renter: rental.renterWalletAddress,
    provider: rental.providerWalletAddress || gpu?.provider || "Unknown provider",
    startedAt: rental.startedAt,
    rentalEndTime: rental.rentalEndTime,
    durationSeconds: rental.durationSeconds ?? 0,
    status: normalizedStatus,
    transactionHash: rental.escrowTxHash,
    escrowAmount: formatEthFromWei(rental.escrowAmountWei),
    priceEth: gpu?.priceEth,
    priceWei: gpu?.priceWei,
    gpu,
    sandboxEndpoint: rental.session?.accessUrl,
    containerId: rental.session?.accessInfo?.containerId ?? rental.session?.containerId,
    containerStatus: rental.session?.status ?? rental.session?.mode,
    accessInfo: rental.session?.accessInfo,
    smartContractAgreementId:
      rental.smartContractAgreementId === undefined || rental.smartContractAgreementId === null
        ? null
        : String(rental.smartContractAgreementId),
  };
}

function findRentalCid(rental: BackendRental, gpus: GPU[]) {
  return gpus.find((gpu) => gpu.id === rental.gpuId)?.cid;
}

function normalizeMetadata(raw?: Record<string, unknown>) {
  const metadata = raw || {};
  const agent = (metadata.agent || {}) as Record<string, unknown>;
  const gpuName = stringValue(metadata.gpuName ?? metadata.gpu ?? metadata.name);
  const vramGB = metadata.vramGB ?? metadata.vram;
  const osName = stringValue(metadata.os ?? metadata.operatingSystem ?? agent.platform);
  return {
    name: gpuName || undefined,
    gpu: gpuName || undefined,
    vram: vramGB ? `${vramGB} GB`.replace(" GB GB", " GB") : undefined,
    ram: stringValue(metadata.ram ?? metadata.ramGB),
    cpu: stringValue(metadata.cpu) || "Host machine",
    ssd: stringValue(metadata.ssd ?? metadata.storage) || "Host storage",
    cuda: stringValue(metadata.cudaVersion ?? metadata.cuda),
    driverVersion: stringValue(metadata.driverVersion),
    network: stringValue(metadata.network) || "Host network",
    os: osName,
    location: stringValue(metadata.location) || "Host machine",
    machineId: stringValue(metadata.machineId),
  };
}

function stringValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Backend request failed.");
  return body as T;
}

function authHeaders(walletAddress: string, role: UserRole) {
  return {
    "X-User-Role": role === "host" ? "provider" : "tenant",
    "X-User-Id": walletAddress,
    "X-Wallet-Address": walletAddress,
  };
}
