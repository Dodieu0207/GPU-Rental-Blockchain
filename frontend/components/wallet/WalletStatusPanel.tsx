"use client";

import { StatusMessage } from "@/components/StatusMessage";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useWallet } from "@/components/WalletProvider";
import { shortenAddress } from "@/lib/format";

export function WalletStatusPanel() {
  const { account, chainId, error, isConnected, role } = useWallet();

  return (
    <div className="rounded-lg bg-white p-5 text-ink shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">Wallet</p>
          <h2 className="mt-1 text-xl font-bold">
            {account ? shortenAddress(account) : "Wallet not connected"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Status: {isConnected ? "Connected" : "Connect MetaMask to continue"}
          </p>
          <p className="mt-1 text-sm text-gray-600">Role: {role}</p>
          <p className="mt-1 text-sm text-gray-600">Chain ID: {chainId ?? "Not connected"}</p>
        </div>
        <ConnectWalletButton />
      </div>
      {error ? (
        <div className="mt-4">
          <StatusMessage type="error">{error}</StatusMessage>
        </div>
      ) : null}
    </div>
  );
}
