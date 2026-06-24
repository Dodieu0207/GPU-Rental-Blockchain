"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusMessage } from "@/components/StatusMessage";
import { useWallet } from "@/components/WalletProvider";
import { hostStats } from "@/lib/demoData";
import { shortenAddress } from "@/lib/format";
import {
  getProviderBalance,
  isContractConfigured,
  withdrawProviderEarnings,
} from "@/lib/contract";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

export default function HostPage() {
  const { account, connectWallet, getProvider, isSepolia, role } = useWallet();
  const [cid, setCid] = useState("");
  const [spec, setSpec] = useState("");
  const [pricePerHourWei, setPricePerHourWei] = useState("1000000000000000");
  const [agentUrl, setAgentUrl] = useState("http://localhost:7000");
  const [providerBalance, setProviderBalance] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [message, setMessage] = useState<{
    type: "info" | "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const isProviderRole = role === "provider" || role === "admin";

  const loadProviderBalance = useCallback(async () => {
    if (!account || !isContractConfigured()) {
      setProviderBalance("0");
      return;
    }

    const provider = getProvider();
    if (!provider) return;

    setProviderBalance(await getProviderBalance(provider, account));
  }, [account, getProvider]);

  useEffect(() => {
    void loadProviderBalance();
  }, [loadProviderBalance]);

  const handleRegisterCid = async () => {
    setMessage(null);

    if (!account) {
      await connectWallet();
      return;
    }

    if (!isProviderRole) {
      setMessage({ type: "warning", text: "Switch role to Provider before registering GPUs." });
      return;
    }

    if (!cid.trim()) {
      setMessage({ type: "warning", text: "Please enter the IPFS CID created by the Agent." });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${backendUrl}/api/provider/gpus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": "provider",
          "X-User-Id": account,
          "X-Wallet-Address": account,
        },
        body: JSON.stringify({
          cid: cid.trim(),
          metadataCID: cid.trim(),
          spec: spec.trim() || `ipfs://${cid.trim()}`,
          pricePerHourWei,
          providerId: account,
          providerWalletAddress: account,
          agentUrl,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Backend rejected the GPU registration.");
      }

      setMessage({
        type: "success",
        text: "GPU metadata CID saved in backend. Register the same CID on-chain with registerGPUWithCID from the provider wallet.",
      });
      setCid("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not register GPU CID.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setMessage(null);

    if (!account) {
      await connectWallet();
      return;
    }

    if (!isProviderRole) {
      setMessage({ type: "warning", text: "Only provider/admin role can withdraw provider earnings." });
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
      await withdrawProviderEarnings(provider);
      await loadProviderBalance();
      setMessage({ type: "success", text: "Provider earnings withdrawn to your MetaMask wallet." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Withdraw failed.",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (!isProviderRole) {
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Host Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Access Denied</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Agent Setup is only for GPU Owners. Tenant/Renter accounts do not need
            to download or run the Agent.
          </p>
        </div>
        <StatusMessage type="warning">
          Switch your role to Provider in the top navigation if you are listing a GPU.
        </StatusMessage>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Host Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Manage GPU Supply</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Run the Agent, copy the IPFS CID, register metadata, and withdraw provider
          earnings from the smart contract.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total GPUs", hostStats.totalGPUs],
          ["Available GPUs", hostStats.availableGPUs],
          ["Active Rentals", hostStats.activeRentals],
          ["Withdrawable", `${providerBalance} ETH`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>

      {message ? <StatusMessage type={message.type}>{message.text}</StatusMessage> : null}

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Agent Setup</h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Agent is required for GPU Owners. It scans your GPU, generates an IPFS
              CID, and manages rental containers on your machine.
            </p>
          </div>
          <a
            href="/gpu-agent.js"
            download
            className="inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Download Agent
          </a>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold text-ink">Host checklist</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>Step 1: Download Agent</li>
              <li>Step 2: Run GPU Scan</li>
              <li>Step 3: Copy CID</li>
              <li>Step 4: Register GPU</li>
              <li>Step 5: Start Agent Server</li>
            </ol>
          </div>

          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <p className="font-semibold text-ink">Create metadata CID</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-gray-950 p-3 text-gray-50">
                <code>node gpu-agent.js upload</code>
              </pre>
              <p className="mt-2">
                Copy the generated CID and paste it into the Register GPU form.
              </p>
            </div>
            <div>
              <p className="font-semibold text-ink">Run Agent server for rentals</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-gray-950 p-3 text-gray-50">
                <code>node gpu-agent.js serve</code>
              </pre>
              <p className="mt-2">
                Default Agent URL: <span className="font-semibold">http://localhost:7000</span>.
                Keep this process running while your GPU is listed as available.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">My Earnings</h2>
        <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-3">
          <p>
            Wallet: <span className="font-semibold text-ink">{account ? shortenAddress(account) : "Not connected"}</span>
          </p>
          <p>
            Provider balance: <span className="font-semibold text-ink">{providerBalance} ETH</span>
          </p>
          <p>
            Network: <span className="font-semibold text-ink">{isSepolia ? "Sepolia" : "Not Sepolia"}</span>
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadProviderBalance}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
          >
            Refresh Balance
          </button>
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={!isProviderRole || isWithdrawing || !account}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isWithdrawing ? "Withdrawing..." : "Withdraw to MetaMask"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Register GPU Metadata CID</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            IPFS CID
            <input
              value={cid}
              onChange={(event) => setCid(event.target.value)}
              placeholder="bafy..."
              className="mt-1 block w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Price per hour (wei)
            <input
              value={pricePerHourWei}
              onChange={(event) => setPricePerHourWei(event.target.value)}
              className="mt-1 block w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Readable spec
            <input
              value={spec}
              onChange={(event) => setSpec(event.target.value)}
              placeholder="NVIDIA RTX 4090 - 24GB VRAM - CUDA 12.4"
              className="mt-1 block w-full rounded-md border border-line px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Agent URL
            <input
              value={agentUrl}
              onChange={(event) => setAgentUrl(event.target.value)}
              className="mt-1 block w-full rounded-md border border-line px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleRegisterCid}
          disabled={isSubmitting || !isProviderRole}
          className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isSubmitting ? "Saving..." : "Save GPU CID to Backend"}
        </button>
      </section>
    </section>
  );
}
