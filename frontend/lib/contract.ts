import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import type { ContractRunner } from "ethers";
import { contractABI } from "@/lib/contractAbi";
import type { GPU, Rental, UserRole } from "@/lib/types";

export const SEPOLIA_CHAIN_ID = 11155111;
export const contractAddress =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000";

export const getGPUsFunction =
  process.env.NEXT_PUBLIC_GET_GPUS_FUNCTION ?? "getAllGPUs";

export const rentGPUFunction =
  process.env.NEXT_PUBLIC_RENT_GPU_FUNCTION ?? "startRental";

export function isContractConfigured() {
  return (
    contractAddress &&
    contractAddress !== "0x0000000000000000000000000000000000000000"
  );
}

export function getContract(providerOrSigner: ContractRunner) {
  return new Contract(contractAddress, contractABI, providerOrSigner);
}

async function ensureSepolia(provider: BrowserProvider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) === SEPOLIA_CHAIN_ID) return;

  await provider.send("wallet_switchEthereumChain", [
    { chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` },
  ]);
}

type TxProgress = (message: string, txHash?: string) => void;

export async function readGPUsFromContract(provider: BrowserProvider): Promise<GPU[]> {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  await ensureSepolia(provider);
  const contract = getContract(provider);
  const rawGPUs = await contract[getGPUsFunction]();
  return rawGPUs.map(normalizeGPU);
}

export async function rentGPU(provider: BrowserProvider, gpu: GPU, hours = 1, onProgress?: TxProgress) {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  await ensureSepolia(provider);
  const signer = await provider.getSigner();
  const contract = getContract(signer);

  const escrowValue =
    gpu.priceWei !== undefined
      ? BigInt(gpu.priceWei) * BigInt(hours)
      : parseEther((Number(gpu.priceEth) * hours).toString());

  onProgress?.("Waiting for wallet confirmation");
  const transaction = await contract[rentGPUFunction](gpu.id, {
    value: escrowValue,
  });
  onProgress?.("Transaction submitted", transaction.hash);
  const receipt = await transaction.wait();
  onProgress?.("Transaction confirmed", receipt?.hash);
  const rentalStarted = receipt?.logs
    ?.map((log: unknown) => {
      try {
        return contract.interface.parseLog(log as Parameters<typeof contract.interface.parseLog>[0]);
      } catch {
        return null;
      }
    })
    .find((event: { name?: string } | null) => event?.name === "RentalStarted");

  return {
    receipt,
    agreementId: rentalStarted?.args?.agreementId?.toString?.() ?? null,
  };
}

export async function readActiveRentalsFromContract(
  provider: BrowserProvider,
  gpus: GPU[],
  walletAddress?: string,
  role?: UserRole,
): Promise<Rental[]> {
  if (!isContractConfigured()) return [];

  await ensureSepolia(provider);
  const contract = getContract(provider);
  const total = Number(await contract.nextAgreementId());
  const rows: Rental[] = [];

  for (let id = 0; id < total; id++) {
    try {
      const agreement = await contract.getAgreement(id);
      if (!agreement.isActive) continue;

      const gpu = gpus.find((item) => item.id === agreement.gpuId.toString());
      const renter = String(agreement.renter);
      const providerWallet = gpu?.provider || "Unknown provider";
      const wallet = walletAddress?.toLowerCase();
      if (wallet && role === "tenant" && renter.toLowerCase() !== wallet) continue;
      if (wallet && role === "host" && providerWallet.toLowerCase() !== wallet) continue;

      const startedAt = new Date(Number(agreement.startTime) * 1000).toISOString();
      rows.push({
        id: `onchain-${id}`,
        gpuId: agreement.gpuId.toString(),
        gpuName: gpu?.name || `GPU ${agreement.gpuId.toString()}`,
        cid: gpu?.cid,
        renter,
        provider: providerWallet,
        startedAt,
        rentalEndTime: new Date(Date.now() + 3600 * 1000).toISOString(),
        durationSeconds: 3600,
        status: "running",
        escrowAmount: formatEther(agreement.escrowFund),
        priceEth: gpu?.priceEth,
        priceWei: gpu?.priceWei,
        gpu,
        containerStatus: "pending/not started",
        smartContractAgreementId: agreement.agreementId.toString(),
      });
    } catch {
      // Skip malformed or unavailable historical agreement rows.
    }
  }

  return rows;
}

export async function registerGPUWithCID(input: {
  provider: BrowserProvider;
  spec: string;
  cid: string;
  pricePerHourEth: string;
  stakeEth?: string;
  onProgress?: TxProgress;
}) {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  await ensureSepolia(input.provider);
  const signer = await input.provider.getSigner();
  const contract = getContract(signer);
  const priceWei = parseEther(input.pricePerHourEth);
  const stake = parseEther(input.stakeEth || "0.05");
  input.onProgress?.("Waiting for wallet confirmation");
  const transaction = await contract.registerGPUWithCID(input.spec, input.cid, priceWei, {
    value: stake,
  });
  input.onProgress?.("Transaction submitted", transaction.hash);
  const receipt = await transaction.wait();
  input.onProgress?.("Transaction confirmed", receipt?.hash);
  return { receipt, priceWei: priceWei.toString() };
}

export async function endRentalSession(
  provider: BrowserProvider,
  agreementId: string,
  telemetryHash: string,
  onProgress?: TxProgress,
) {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  await ensureSepolia(provider);
  const signer = await provider.getSigner();
  const contract = getContract(signer);
  onProgress?.("Waiting for wallet confirmation");
  const transaction = await contract.endRentalSession(agreementId, telemetryHash);
  onProgress?.("Transaction submitted", transaction.hash);
  const receipt = await transaction.wait();
  onProgress?.("Transaction confirmed", receipt?.hash);
  return receipt;
}

export async function getProviderBalance(
  provider: BrowserProvider,
  walletAddress: string,
) {
  if (!isContractConfigured()) {
    return "0";
  }

  const contract = getContract(provider);
  if (!(await hasContractCode(provider))) {
    return "0";
  }

  try {
    const balance = await contract.getProviderBalance(walletAddress);
    return formatEther(balance);
  } catch (error) {
    try {
      const balance = await contract.providerBalances(walletAddress);
      return formatEther(balance);
    } catch {
      console.warn("Could not read provider balance from contract.", error);
      return "0";
    }
  }
}

export async function getPlatformBalance(provider: BrowserProvider) {
  if (!isContractConfigured()) {
    return "0";
  }

  const contract = getContract(provider);
  if (!(await hasContractCode(provider))) {
    return "0";
  }

  try {
    const balance = await contract.getPlatformBalance();
    return formatEther(balance);
  } catch (error) {
    console.warn("Could not read platform balance from contract.", error);
    return "0";
  }
}

export async function withdrawProviderEarnings(provider: BrowserProvider, onProgress?: TxProgress) {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  await ensureSepolia(provider);
  const signer = await provider.getSigner();
  const contract = getContract(signer);
  onProgress?.("Waiting for wallet confirmation");
  const transaction = await contract.withdrawProviderEarnings();
  onProgress?.("Transaction submitted", transaction.hash);
  const receipt = await transaction.wait();
  onProgress?.("Transaction confirmed", receipt?.hash);
  return receipt;
}

export async function withdrawPlatformFees(provider: BrowserProvider) {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  const signer = await provider.getSigner();
  const contract = getContract(signer);
  const transaction = await contract.withdrawPlatformFees();
  return transaction.wait();
}

function normalizeGPU(raw: unknown, index: number): GPU {
  const item = raw as {
    id?: bigint | number | string;
    gpuId?: bigint | number | string;
    name?: string;
    gpuName?: string;
    hardwareSpec?: string;
    metadataCID?: string;
    hardwareSpecHash?: string;
    vram?: string | bigint | number;
    memory?: string | bigint | number;
    pricePerHour?: bigint | number | string;
    price?: bigint | number | string;
    available?: boolean;
    isAvailable?: boolean;
    rented?: boolean;
    status?: bigint | number;
    provider?: string;
    owner?: string;
  };

  const rawId = item.id ?? item.gpuId ?? index;
  const rawPrice = item.pricePerHour ?? item.price ?? 0;
  const cid = item.metadataCID || item.hardwareSpecHash;
  const readableSpec =
    item.name ??
    item.gpuName ??
    (item.hardwareSpec?.startsWith("ipfs://") ? undefined : item.hardwareSpec);
  const isAvailable =
    item.status !== undefined
      ? Number(item.status) === 0
      : item.available ?? item.isAvailable ?? !item.rented;

  return {
    id: rawId.toString(),
    name: readableSpec ?? "Registered GPU",
    vram: (item.vram ?? item.memory ?? extractVram(item.hardwareSpec) ?? "Unknown").toString(),
    gpu: readableSpec ?? "Registered GPU",
    cpu: "On-chain metadata",
    ssd: "On-chain metadata",
    cuda: "On-chain metadata",
    network: "On-chain metadata",
    os: "On-chain metadata",
    location: "On-chain metadata",
    priceEth:
      typeof rawPrice === "bigint"
        ? formatEther(rawPrice)
        : rawPrice.toString(),
    priceWei: rawPrice.toString(),
    status: isAvailable ? "available" : "rented",
    provider: item.provider ?? item.owner ?? "Unknown provider",
    cid,
    source: "contract",
  };
}

function extractVram(spec?: string) {
  if (!spec) return undefined;
  return spec.match(/(\d+(?:\.\d+)?)\s*GB/i)?.[0];
}

async function hasContractCode(provider: BrowserProvider) {
  try {
    return (await provider.getCode(contractAddress)) !== "0x";
  } catch {
    return false;
  }
}
