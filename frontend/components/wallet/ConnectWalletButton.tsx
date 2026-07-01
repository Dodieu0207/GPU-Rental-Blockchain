"use client";

import { useWallet } from "@/components/WalletProvider";
import { shortenAddress } from "@/lib/format";

export function ConnectWalletButton() {
  const { account, connectWallet, disconnectWallet, isConnecting } = useWallet();

  if (account) {
    return (
      <button
        type="button"
        onClick={disconnectWallet}
        className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-violet-50"
      >
        {shortenAddress(account)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={connectWallet}
      disabled={isConnecting}
      className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
