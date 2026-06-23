export type GPU = {
  id: string;
  name: string;
  vram: string;
  priceEth: string;
  priceWei?: string;
  available: boolean;
  provider: string;
  cid?: string;
};

export type Rental = {
  id: string;
  gpuName: string;
  hours: number;
  priceEth: string;
  status: "Active" | "Completed";
  endsAt: string;
};

export type Transaction = {
  id: string;
  date: string;
  type: "Rent" | "Deposit" | "Withdraw" | "Extend" | "End Rental";
  status: "Success" | "Pending" | "Failed";
  amountEth: string;
};
