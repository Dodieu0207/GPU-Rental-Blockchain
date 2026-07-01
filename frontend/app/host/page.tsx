"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentScanModal } from "@/components/agent/AgentScanModal";
import { AgentStatusBadge } from "@/components/agent/AgentStatusBadge";
import { StatusMessage } from "@/components/StatusMessage";
import { StatsCard } from "@/components/ui/StatsCard";
import { EmptyState } from "@/components/ui/States";
import { useWallet } from "@/components/WalletProvider";
import { backendUrl, checkAgent, fetchGpuMarketplace, fetchRentals, normalizeAgentUrl, saveProviderAgentUrl, saveRegisteredGpu } from "@/lib/api";
import { getProviderBalance, isContractConfigured, readActiveRentalsFromContract, readGPUsFromContract, registerGPUWithCID, withdrawProviderEarnings } from "@/lib/contract";
import { formatDateTime, formatDuration, secondsRemaining, shortenAddress, shortenCid } from "@/lib/format";
import type { GPU, Rental } from "@/lib/types";

export default function HostPage() {
  const { account, connectWallet, getProvider, role } = useWallet();
  const [gpus, setGpus] = useState<GPU[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [providerBalance, setProviderBalance] = useState("0");
  const [cid, setCid] = useState("");
  const [pricePerHourEth, setPricePerHourEth] = useState("0.01");
  const [stakeEth, setStakeEth] = useState("0.05");
  const [agentUrl, setAgentUrl] = useState("http://localhost:7000");
  const [agentStatus, setAgentStatus] = useState("No agent connected");
  const [dockerStatus, setDockerStatus] = useState("Docker Not Ready");
  const [scannedMetadata, setScannedMetadata] = useState<Record<string, unknown> | undefined>();
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [message, setMessage] = useState<{ type: "info" | "success" | "error" | "warning"; text: string } | null>(null);

  const hostGpus = useMemo(
    () => (account ? gpus.filter((gpu) => gpu.provider.toLowerCase() === account.toLowerCase()) : []),
    [account, gpus],
  );
  const hostRentals = useMemo(
    () => (account ? rentals.filter((rental) => rental.provider.toLowerCase() === account.toLowerCase() && rental.status !== "ended") : []),
    [account, rentals],
  );

  const loadDashboard = useCallback(async () => {
    let contractGpus: GPU[] = [];
    const provider = getProvider();
    if (provider && isContractConfigured()) {
      try {
        contractGpus = await readGPUsFromContract(provider);
      } catch {
        contractGpus = [];
      }
    }
    const nextGpus = await fetchGpuMarketplace(contractGpus);
    const backendRentals = await fetchRentals(account || undefined, "host").catch(() => []);
    const chainRentals = provider
      ? await readActiveRentalsFromContract(provider, nextGpus, account || undefined, "host").catch(() => [])
      : [];
    const nextRentals = mergeRentals(backendRentals, chainRentals);
    setGpus(nextGpus);
    setRentals(nextRentals);
    return nextGpus;
  }, [account, getProvider]);

  const loadBalance = useCallback(async () => {
    if (!account || !isContractConfigured()) {
      setProviderBalance("0");
      return;
    }
    const provider = getProvider();
    if (!provider) return;

    try {
      setProviderBalance(await getProviderBalance(provider, account));
    } catch {
      setProviderBalance("0");
      setMessage({
        type: "warning",
        text: "Could not read provider balance on the current wallet network. Showing 0 ETH.",
      });
    }
  }, [account, getProvider]);

  useEffect(() => {
    void loadDashboard();
    void loadBalance();
  }, [loadBalance, loadDashboard]);

  const stats = [
    ["Total GPUs", hostGpus.length],
    ["Available GPUs", hostGpus.filter((gpu) => gpu.status === "available").length],
    ["Busy GPUs", hostGpus.filter((gpu) => gpu.status === "rented").length],
    ["Offline GPUs", hostGpus.filter((gpu) => gpu.status === "offline" || gpu.status === "unavailable").length],
    ["Total Earnings", `${providerBalance} ETH`],
    ["Pending Withdraw", `${providerBalance} ETH`],
  ];

  const handleRegister = async () => {
    setMessage(null);
    if (!account) {
      await connectWallet();
      return;
    }
    if (role !== "host") {
      setMessage({ type: "warning", text: "Switch role to Host before registering a GPU." });
      return;
    }
    if (!cid.trim()) {
      setMessage({ type: "warning", text: "Paste a metadata CID before registering a GPU." });
      return;
    }

    const metadata = gpus.find((gpu) => gpu.cid === cid.trim());
    const spec = metadata?.name ?? `ipfs://${cid.trim()}`;
    const provider = getProvider();
    if (!provider || !isContractConfigured()) {
      setMessage({ type: "warning", text: "Contract address is not configured, so on-chain registerGPUWithCID cannot run yet." });
      return;
    }

    setIsSubmitting(true);
    try {
      const registeredCid = cid.trim();
      const registration = await registerGPUWithCID({
        provider,
        spec,
        cid: registeredCid,
        pricePerHourEth,
        stakeEth,
        onProgress: (text, txHash) => setMessage({ type: "info", text: txHash ? `${text}. Tx: ${txHash}` : text }),
      });
      try {
        const normalizedAgentUrl = normalizeAgentUrl(agentUrl);
        await saveRegisteredGpu({
          cid: registeredCid,
          spec,
          pricePerHourWei: registration.priceWei,
          providerWalletAddress: account,
          agentUrl: normalizedAgentUrl,
          metadata: scannedMetadata,
        });
      } catch {
        // Backend sync is optional for the urgent Sepolia demo.
      }
      setMessage({ type: "info", text: `Refreshing GPU list. CID: ${registeredCid}. Tx: ${registration.receipt?.hash ?? "confirmed"}` });
      const refreshedGpus = await loadDashboard();
      const registeredGpu = refreshedGpus.find((gpu) => gpu.cid === registeredCid && gpu.source === "contract");
      if (!registeredGpu) {
        throw new Error(`Transaction confirmed but getAllGPUs did not return CID ${registeredCid}. Tx: ${registration.receipt?.hash ?? "confirmed"}`);
      }
      setMessage({ type: "success", text: `GPU available in Marketplace. CID: ${registeredCid}. Tx: ${registration.receipt?.hash ?? "confirmed"}` });
      setCid("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "GPU registration failed." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!account) {
      await connectWallet();
      return;
    }
    const provider = getProvider();
    if (!provider) return;

    setIsWithdrawing(true);
    try {
      const receipt = await withdrawProviderEarnings(provider, (text, txHash) =>
        setMessage({ type: "info", text: txHash ? `${text}. Tx: ${txHash}` : text }),
      );
      await loadBalance();
      setMessage({ type: "success", text: `Withdraw confirmed. Tx: ${receipt?.hash ?? "confirmed"}` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Withdraw failed." });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleAgentConnect = async () => {
    try {
      const normalizedAgentUrl = normalizeAgentUrl(agentUrl);
      setAgentUrl(normalizedAgentUrl);
      const result = await checkAgent(normalizedAgentUrl);
      if (account) {
        await saveProviderAgentUrl(account, normalizedAgentUrl);
      }
      setAgentStatus("Agent connected");
      const dockerReady = result?.docker?.canRunContainer ?? result?.docker?.available ?? result?.metadata?.agent?.dockerMode === "real";
      const dockerWarning = result?.docker?.warning || result?.docker?.message || "";
      setDockerStatus(dockerReady ? (dockerWarning ? "Docker Ready - Warning" : "Docker Ready") : "Docker Not Ready");
      setMessage({
        type: dockerReady && !dockerWarning ? "success" : "warning",
        text: dockerWarning
          ? `Agent connected, Docker reachable, but container start may need attention: ${dockerWarning}`
          : `Agent connected and saved for this Host wallet: ${normalizedAgentUrl}`,
      });
    } catch (error) {
      setAgentStatus(error instanceof Error ? error.message : "No agent connected");
      setDockerStatus("Docker Not Ready");
    }
  };

  const handleAgentScan = async () => {
    setIsScanOpen(true);
  };

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Host Dashboard</p>
        <h1 className="mt-2 text-4xl font-bold">Manage GPU Supply</h1>
        <p className="mt-3 max-w-2xl text-violet-100">
          Register metadata CIDs directly from the web, monitor host GPUs, track rentals, and withdraw provider earnings.
        </p>
      </div>

      {message ? <StatusMessage type={message.type}>{message.text}</StatusMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, value]) => <StatsCard key={label} label={String(label)} value={value} />)}
      </div>

      <Panel title="Current GPUs">
        {hostGpus.length === 0 ? (
          <EmptyState title="No GPUs" message="Registered host GPUs will appear here after your wallet registers a CID." />
        ) : (
          <div className="grid gap-3">
            {hostGpus.map((gpu) => (
              <div key={gpu.id} className="rounded-md border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-violet-700">{gpu.machineId || "Registered Machine"}</p>
                    <p className="mt-1 text-lg font-bold">{gpu.gpu || gpu.name}</p>
                    <p className="mt-1 text-sm text-gray-600">{gpu.vram} · CUDA {gpu.cuda}</p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold capitalize text-violet-700">{gpu.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                  <p>CPU: <span className="font-semibold text-ink">{gpu.cpu}</span></p>
                  <p>SSD: <span className="font-semibold text-ink">{gpu.ssd}</span></p>
                  <p>OS: <span className="font-semibold text-ink">{gpu.os}</span></p>
                  <p>Network: <span className="font-semibold text-ink">{gpu.network}</span></p>
                  <p>Location: <span className="font-semibold text-ink">{gpu.location}</span></p>
                  <p>CID: <span className="font-semibold text-ink">{shortenCid(gpu.cid)}</span></p>
                  <p>Price/hour: <span className="font-semibold text-ink">{gpu.priceEth} ETH</span></p>
                  <p>Registered: <span className="font-semibold text-ink">{formatDateTime(gpu.registeredAt)}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Current Rentals">
        {hostRentals.length === 0 ? (
          <EmptyState title="No Rentals" message="Current rentals for your machines will appear here." />
        ) : (
          <div className="grid gap-3">
            {hostRentals.map((rental) => (
              <div key={rental.id} className="rounded-md border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{rental.gpuName}</p>
                    <p className="mt-1 text-sm text-gray-600">Tenant {shortenAddress(rental.renter || "")}</p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold capitalize text-violet-700">{rental.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                  <p>CID: <span className="font-semibold text-ink">{shortenCid(rental.cid)}</span></p>
                  <p>Started: <span className="font-semibold text-ink">{formatDateTime(rental.startedAt)}</span></p>
                  <p>Duration: <span className="font-semibold text-ink">{formatDuration(rental.durationSeconds)}</span></p>
                  <p>Remaining: <span className="font-semibold text-ink">{formatDuration(secondsRemaining(rental.rentalEndTime))}</span></p>
                  <p>Price/hour: <span className="font-semibold text-ink">{rental.priceEth || "On-chain"} ETH</span></p>
                  <p>Escrow: <span className="font-semibold text-ink">{rental.escrowAmount || "On-chain"} ETH</span></p>
                  <p>Container: <span className="font-semibold text-ink">{rental.containerStatus || "pending/not started"}</span></p>
                  <p>Container ID: <span className="font-semibold text-ink">{rental.containerId || "Not available"}</span></p>
                  <p>Session/Rental ID: <span className="font-semibold text-ink">{rental.accessInfo?.sessionId || rental.id}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Withdraw">
        <div className="grid gap-3 text-sm text-gray-700 md:grid-cols-2">
          <p>Wallet: <span className="font-semibold text-ink">{account ? shortenAddress(account) : "Not connected"}</span></p>
          <p>Current Balance: <span className="font-semibold text-ink">{providerBalance} ETH</span></p>
        </div>
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={!account || isWithdrawing}
          className="mt-4 rounded-md bg-[#12091f] px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isWithdrawing ? "Withdrawing..." : "Withdraw"}
        </button>
      </Panel>

      <Panel title="Optional Agent">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span>Agent Status:</span>
          <AgentStatusBadge status={agentStatus} />
          <AgentStatusBadge status={dockerStatus} />
        </div>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          Agent URL
          <input value={agentUrl} onChange={(event) => setAgentUrl(event.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2" />
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Health endpoint: <span className="font-semibold text-ink">{normalizeAgentUrl(agentUrl)}/health</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={`${backendUrl}/api/agent/download`} className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Download Agent
          </a>
          <button type="button" onClick={handleAgentConnect} className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Connect Agent
          </button>
          <button type="button" onClick={handleAgentScan} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            Scan Machine
          </button>
        </div>
      </Panel>

      <Panel title="Register GPU">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            CID
            <input value={cid} onChange={(event) => setCid(event.target.value)} placeholder="Paste CID manually, e.g. bafy..." className="mt-1 w-full rounded-md border border-line px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Price per hour (ETH)
            <input value={pricePerHourEth} onChange={(event) => setPricePerHourEth(event.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Stake (ETH)
            <input value={stakeEth} onChange={(event) => setStakeEth(event.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2" />
          </label>
        </div>
        <button
          type="button"
          onClick={handleRegister}
          disabled={isSubmitting}
          className="mt-4 rounded-md bg-[#12091f] px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      </Panel>
      <AgentScanModal
        agentUrl={agentUrl}
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onCidReady={(nextCid) => {
          setCid(nextCid);
          setAgentStatus("Machine scanned");
        }}
        onMetadataReady={setScannedMetadata}
      />
    </section>
  );
}

function mergeRentals(primary: Rental[], fallback: Rental[]) {
  const seen = new Set(primary.map((rental) => rental.smartContractAgreementId || rental.id));
  return [...primary, ...fallback.filter((rental) => !seen.has(rental.smartContractAgreementId || rental.id))];
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
