"use client";

import { StatusMessage } from "@/components/StatusMessage";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useWallet } from "@/components/WalletProvider";
import { shortenAddress } from "@/lib/format";

export function WalletStatusPanel() {
  const { account, error, isConnected, isSepolia, role, switchToSepolia } = useWallet();

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-500">Wallet Layer</p>
          <h2 className="mt-1 text-xl font-bold text-ink">
            {account ? shortenAddress(account) : "Wallet not connected"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Status:{" "}
            {isConnected
              ? isSepolia
                ? "Correct network: Sepolia"
                : "Wrong network"
              : "Connect MetaMask to continue"}
          </p>
          <p className="mt-1 text-sm text-gray-600">Role: {role}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConnectWalletButton />
          {isConnected && !isSepolia ? (
            <button
              type="button"
              onClick={switchToSepolia}
              className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
            >
              Switch to Sepolia
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className="mt-4">
          <StatusMessage type="error">{error}</StatusMessage>
        </div>
      ) : null}
    </div>
  );
}
