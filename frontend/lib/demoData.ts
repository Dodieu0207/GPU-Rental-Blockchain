import type { GPU, Rental, Transaction } from "@/lib/types";

export const demoGPUs: GPU[] = [
  {
    id: "1",
    name: "NVIDIA RTX 4090",
    vram: "24 GB",
    priceEth: "0.015",
    available: true,
    provider: "0x8A21...F91C",
  },
  {
    id: "2",
    name: "NVIDIA RTX 3090",
    vram: "24 GB",
    priceEth: "0.010",
    available: true,
    provider: "0x19c0...A3b2",
  },
  {
    id: "3",
    name: "NVIDIA A100",
    vram: "40 GB",
    priceEth: "0.050",
    available: false,
    provider: "0xB772...44Ed",
  },
];

export const demoRentals: Rental[] = [
  {
    id: "demo-rental-1",
    gpuName: "NVIDIA RTX 4090",
    hours: 3,
    priceEth: "0.045",
    status: "Active",
    endsAt: "Today, 18:30",
  },
];

export const demoTransactions: Transaction[] = [
  {
    id: "tx-001",
    date: "2026-06-23",
    type: "Rent",
    status: "Success",
    amountEth: "0.045",
  },
  {
    id: "tx-002",
    date: "2026-06-22",
    type: "Deposit",
    status: "Success",
    amountEth: "0.200",
  },
  {
    id: "tx-003",
    date: "2026-06-21",
    type: "Withdraw",
    status: "Pending",
    amountEth: "0.075",
  },
];

export const hostStats = {
  totalGPUs: 5,
  availableGPUs: 3,
  activeRentals: 2,
  totalEarningsEth: "0.42",
  withdrawableBalanceEth: "0.18",
};
