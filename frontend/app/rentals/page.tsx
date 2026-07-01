"use client";

import { useCallback, useEffect, useState } from "react";
import { RentalCard } from "@/components/rental/RentalCard";
import { RentalDetailModal } from "@/components/rental/RentalDetailModal";
import { StatusMessage } from "@/components/StatusMessage";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useWallet } from "@/components/WalletProvider";
import { fetchGpuMarketplace, fetchRentals, stopRental } from "@/lib/api";
import { endRentalSession, isContractConfigured, readActiveRentalsFromContract, readGPUsFromContract } from "@/lib/contract";
import type { Rental } from "@/lib/types";

export default function RentalsPage() {
  const { account, getProvider } = useWallet();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "info" | "success" | "error" | "warning"; text: string } | null>(null);

  const loadRentals = useCallback(async () => {
    setIsLoading(true);
    try {
      const backendRows = await fetchRentals(account || undefined, "tenant");
      const provider = getProvider();
      let chainRows: Rental[] = [];
      if (provider && isContractConfigured()) {
        const contractGpus = await readGPUsFromContract(provider).catch(() => []);
        const gpus = await fetchGpuMarketplace(contractGpus).catch(() => contractGpus);
        chainRows = await readActiveRentalsFromContract(provider, gpus, account || undefined, "tenant").catch(() => []);
      }
      setRentals(mergeRentals(backendRows, chainRows).filter((rental) => rental.status !== "ended"));
      setMessage(null);
    } catch (error) {
      setMessage({ type: "warning", text: error instanceof Error ? error.message : "No rentals available." });
      setRentals([]);
    } finally {
      setIsLoading(false);
    }
  }, [account, getProvider]);

  useEffect(() => {
    void loadRentals();
  }, [loadRentals]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimerTick((current) => current + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleStop = async (rental: Rental) => {
    if (!account) {
      setMessage({ type: "warning", text: "Connect wallet before stopping a rental." });
      return;
    }
    if (rental.status === "ended") {
      setMessage({ type: "info", text: "This rental has already ended." });
      return;
    }

    setStoppingId(rental.id);
    try {
      try {
        await stopRental(rental.id, account);
      } catch {
        // Agent/backend stop is best-effort; on-chain end can still be attempted.
      }
      if (isContractConfigured() && rental.smartContractAgreementId) {
        const provider = getProvider();
        if (provider) {
          const receipt = await endRentalSession(
            provider,
            rental.smartContractAgreementId,
            `frontend-stop-${rental.id}`,
            (text, txHash) => setMessage({ type: "info", text: txHash ? `${text}. Tx: ${txHash}` : text }),
          );
          setMessage({ type: "success", text: `Rental ended on-chain. Tx: ${receipt?.hash ?? "confirmed"}` });
        }
      }
      await loadRentals();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Stop rental failed." });
    } finally {
      setStoppingId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Tenant</p>
          <h1 className="mt-2 text-4xl font-bold">Active Rentals</h1>
          <p className="mt-3 max-w-2xl text-violet-100">
            View running rentals and end sessions through the Sepolia contract.
          </p>
        </div>
        <button type="button" onClick={loadRentals} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-ink">
          Reload
        </button>
      </div>

      {message ? <StatusMessage type={message.type}>{message.text}</StatusMessage> : null}
      {isLoading ? <LoadingState title="Loading active rentals" /> : null}
      {!isLoading && rentals.length === 0 ? (
        <EmptyState title="No Rentals" message="Active rental sessions will appear here after a GPU is rented." />
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        {rentals.map((rental) => (
          <RentalCard
            key={rental.id}
            rental={rental}
            timerTick={timerTick}
            isStopping={stoppingId === rental.id}
            onStop={handleStop}
            onDetails={setSelectedRental}
          />
        ))}
      </div>
      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <button
          type="button"
          onClick={() => setIsGuideOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span className="text-xl font-bold">How to connect to your rented GPU container</span>
          <span className="rounded-md border border-line px-3 py-1 text-sm font-semibold">{isGuideOpen ? "Hide" : "Show"}</span>
        </button>
        {isGuideOpen ? (
          <div className="mt-5 space-y-4 text-sm text-gray-700">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Copy SSH command in the rental card or More Info.</li>
              <li>Open CMD or PowerShell.</li>
              <li>
                Paste the SSH command, for example:
                <code className="mt-2 block rounded bg-gray-100 px-3 py-2 text-ink">ssh decompute@localhost -p 2200</code>
              </li>
              <li>For the first connection, type <code>yes</code>.</li>
              <li>Paste the password provided by DeCompute.</li>
              <li>
                After entering the container, try:
                <code className="mt-2 block whitespace-pre rounded bg-gray-100 px-3 py-2 text-ink">{`whoami\npwd\nls`}</code>
              </li>
              <li>Use <code>exit</code> to leave the container.</li>
            </ol>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
              When typing a password in CMD, characters are hidden. This is normal. If you see Permission denied, copy the latest username/password from More Info and try again.
            </div>
          </div>
        ) : null}
      </section>
      <RentalDetailModal rental={selectedRental} onClose={() => setSelectedRental(null)} />
    </section>
  );
}

function mergeRentals(primary: Rental[], fallback: Rental[]) {
  const seen = new Set(primary.map((rental) => rental.smartContractAgreementId || rental.id));
  return [...primary, ...fallback.filter((rental) => !seen.has(rental.smartContractAgreementId || rental.id))];
}
