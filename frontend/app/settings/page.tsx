"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusMessage } from "@/components/StatusMessage";
import { useWallet } from "@/components/WalletProvider";
import { WalletStatusPanel } from "@/components/wallet/WalletStatusPanel";
import { getPlatformBalance, withdrawPlatformFees } from "@/lib/contract";

export default function SettingsPage() {
  const { account, connectWallet, getProvider, isSepolia, role } = useWallet();
  const [platformBalance, setPlatformBalance] = useState("0");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [message, setMessage] = useState<{
    type: "info" | "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const loadPlatformBalance = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    setPlatformBalance(await getPlatformBalance(provider));
  }, [getProvider]);

  useEffect(() => {
    void loadPlatformBalance();
  }, [loadPlatformBalance]);

  const handleWithdrawPlatformFees = async () => {
    setMessage(null);

    if (!account) {
      await connectWallet();
      return;
    }

    if (role !== "admin") {
      setMessage({ type: "warning", text: "Only platform owner/admin role can withdraw platform fees." });
      return;
    }

    if (!isSepolia) {
      setMessage({ type: "warning", text: "Please switch MetaMask to Sepolia before withdrawing." });
      return;
    }

    const provider = getProvider();
    if (!provider) {
      setMessage({ type: "error", text: "MetaMask provider not found." });
      return;
    }

    setIsWithdrawing(true);
    try {
      await withdrawPlatformFees(provider);
      await loadPlatformBalance();
      setMessage({ type: "success", text: "Platform fees withdrawn to owner wallet." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Platform withdraw failed.",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Account Settings
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Profile and Security</h1>
      </div>
      <WalletStatusPanel />
      {message ? <StatusMessage type={message.type}>{message.text}</StatusMessage> : null}
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">Platform Owner Fees</h2>
        <p className="mt-2 text-sm text-gray-600">
          Platform balance available in smart contract:{" "}
          <span className="font-semibold text-ink">{platformBalance} ETH</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadPlatformBalance}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            Refresh Platform Balance
          </button>
          <button
            type="button"
            onClick={handleWithdrawPlatformFees}
            disabled={role !== "admin" || isWithdrawing}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isWithdrawing ? "Withdrawing..." : "Withdraw Platform Fees"}
          </button>
        </div>
      </section>
    </section>
  );
}
