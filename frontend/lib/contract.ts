import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import type { ContractRunner } from "ethers";
import { contractABI } from "@/lib/contractAbi";
import type { GPU } from "@/lib/types";

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

export async function readGPUsFromContract(provider: BrowserProvider): Promise<GPU[]> {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  const contract = getContract(provider);
  const rawGPUs = await contract[getGPUsFunction]();
  return rawGPUs.map(normalizeGPU);
}

export async function rentGPU(provider: BrowserProvider, gpu: GPU, hours = 1) {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  const signer = await provider.getSigner();
  const contract = getContract(signer);

  const escrowValue =
    gpu.priceWei !== undefined
      ? BigInt(gpu.priceWei) * BigInt(hours)
      : parseEther((Number(gpu.priceEth) * hours).toString());

  const transaction = await contract[rentGPUFunction](gpu.id, {
    value: escrowValue,
  });
  const receipt = await transaction.wait();
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

export async function getProviderBalance(
  provider: BrowserProvider,
  walletAddress: string,
) {
  if (!isContractConfigured()) {
    return "0";
  }

  const contract = getContract(provider);
  const balance = await contract.getProviderBalance(walletAddress);
  return formatEther(balance);
}

export async function getPlatformBalance(provider: BrowserProvider) {
  if (!isContractConfigured()) {
    return "0";
  }

  const contract = getContract(provider);
  const balance = await contract.getPlatformBalance();
  return formatEther(balance);
}

export async function withdrawProviderEarnings(provider: BrowserProvider) {
  if (!isContractConfigured()) {
    throw new Error("Contract address is missing. Add it to .env.local.");
  }

  const signer = await provider.getSigner();
  const contract = getContract(signer);
  const transaction = await contract.withdrawProviderEarnings();
  return transaction.wait();
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

  return {
    id: rawId.toString(),
    name: item.name ?? item.gpuName ?? item.hardwareSpec ?? `GPU #${rawId.toString()}`,
    vram: (item.vram ?? item.memory ?? extractVram(item.hardwareSpec) ?? "Unknown").toString(),
    priceEth:
      typeof rawPrice === "bigint"
        ? formatEther(rawPrice)
        : rawPrice.toString(),
    priceWei: rawPrice.toString(),
    available:
      item.available ??
      item.isAvailable ??
      (item.status !== undefined ? Number(item.status) === 0 : !item.rented),
    provider: item.provider ?? item.owner ?? "Unknown provider",
    cid: item.metadataCID || item.hardwareSpecHash,
  };
}

function extractVram(spec?: string) {
  if (!spec) return undefined;
  return spec.match(/(\d+(?:\.\d+)?)\s*GB/i)?.[0];
}
