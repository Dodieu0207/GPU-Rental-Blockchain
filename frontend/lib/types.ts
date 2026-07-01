export type UserRole = "tenant" | "host";

export type GPUStatus = "available" | "unavailable" | "rented" | "offline";

export type GPU = {
  id: string;
  machineId?: string;
  name: string;
  gpu: string;
  vram: string;
  ram?: string;
  cpu: string;
  ssd: string;
  cuda: string;
  driverVersion?: string;
  network: string;
  os: string;
  location: string;
  priceEth: string;
  priceWei?: string;
  status: GPUStatus;
  provider: string;
  cid?: string;
  source: "dataset" | "backend" | "contract";
  registeredAt?: string;
  agentUrl?: string;
};

export type Rental = {
  id: string;
  gpuId: string;
  gpuName: string;
  cid?: string;
  renter?: string;
  provider: string;
  startedAt: string;
  rentalEndTime: string;
  durationSeconds: number;
  status: "pending" | "running" | "ended";
  transactionHash?: string;
  escrowAmount?: string;
  priceEth?: string;
  priceWei?: string;
  gpu?: GPU;
  sandboxEndpoint?: string;
  containerId?: string;
  containerStatus?: string;
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
  smartContractAgreementId?: string | null;
};

export type Transaction = {
  transactionId: string;
  type: string;
  from: string;
  to: string;
  amount: string;
  time: string;
  status: string;
  txHash: string;
  rentalId?: string;
  gpu?: string;
};
