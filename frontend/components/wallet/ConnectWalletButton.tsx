"use client";

import { useWallet } from "@/components/WalletProvider";
import { shortenAddress } from "@/lib/format";

export function ConnectWalletButton() {
  const { account, connectWallet, isConnecting, isConnected } = useWallet();

  return (
    <button
      type="button"
      onClick={connectWallet}
      disabled={isConnecting}
      className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isConnecting
        ? "Connecting..."
        : isConnected && account
          ? shortenAddress(account)
          : "Connect Wallet"}
    </button>
  );
}
