"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GPUCard } from "@/components/gpu/GPUCard";
import { GPUDetailModal } from "@/components/gpu/GPUDetailModal";
import { RentConfirmationModal } from "@/components/gpu/RentConfirmationModal";
import { StatusMessage } from "@/components/StatusMessage";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useWallet } from "@/components/WalletProvider";
import { createRental, fetchGpuMarketplace } from "@/lib/api";
import { isContractConfigured, readGPUsFromContract, rentGPU } from "@/lib/contract";
import type { GPU } from "@/lib/types";

type Filter = "all" | "available" | "unavailable";

export default function MarketplacePage() {
  const { account, connectWallet, getProvider, role } = useWallet();
  const [gpus, setGPUs] = useState<GPU[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [hoursByGpu, setHoursByGpu] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [rentingGpuId, setRentingGpuId] = useState<string | null>(null);
  const [selectedGpu, setSelectedGpu] = useState<GPU | null>(null);
  const [pendingRentalGpu, setPendingRentalGpu] = useState<GPU | null>(null);
  const [rentStatus, setRentStatus] = useState("");
  const [message, setMessage] = useState<{ type: "info" | "success" | "error" | "warning"; text: string } | null>(null);

  const loadGPUs = useCallback(async () => {
    setIsLoading(true);
    try {
      let contractGpus: GPU[] = [];
      const provider = getProvider();
      if (provider && isContractConfigured()) {
        try {
          contractGpus = await readGPUsFromContract(provider);
        } catch (error) {
          setMessage({ type: "warning", text: error instanceof Error ? `Could not refresh on-chain GPUs: ${error.message}` : "Could not refresh on-chain GPUs." });
        }
      }
      const rows = await fetchGpuMarketplace(contractGpus);
      setGPUs(rows);
      setHoursByGpu((current) => ({
        ...Object.fromEntries(rows.map((gpu) => [gpu.id, current[gpu.id] ?? 1])),
      }));
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not load GPUs." });
    } finally {
      setIsLoading(false);
    }
  }, [getProvider]);

  useEffect(() => {
    void loadGPUs();
  }, [loadGPUs]);

  const visibleGPUs = useMemo(
    () =>
      gpus.filter((gpu) => {
        if (filter === "available") return gpu.status === "available";
        if (filter === "unavailable") return gpu.status !== "available";
        return true;
      }),
    [filter, gpus],
  );

  const handleRent = async (gpu: GPU) => {
    if (gpu.source !== "contract") {
      setMessage({
        type: "warning",
        text: "Only GPUs registered on-chain can be rented.",
      });
      return;
    }

    if (gpu.status !== "available") {
      setMessage({ type: "warning", text: "This GPU is unavailable." });
      return;
    }

    if (!isContractConfigured()) {
      setMessage({
        type: "warning",
        text: "Contract address is not configured. Add NEXT_PUBLIC_CONTRACT_ADDRESS before renting.",
      });
      return;
    }

    if (!account) {
      await connectWallet();
      return;
    }

    if (role !== "tenant") {
      setMessage({ type: "warning", text: "Switch role to Tenant before renting a GPU." });
      return;
    }

    if (gpu.provider.toLowerCase() === account.toLowerCase()) {
      setMessage({ type: "warning", text: "The host wallet cannot rent its own GPU. Switch to Account 2." });
      return;
    }

    setPendingRentalGpu(gpu);
    setRentStatus("");
  };

  const confirmRent = async () => {
    const gpu = pendingRentalGpu;
    if (!gpu) return;
    if (!account) {
      await connectWallet();
      return;
    }

    const provider = getProvider();
    if (!provider) {
      setMessage({ type: "error", text: "MetaMask provider not found." });
      return;
    }

    setRentingGpuId(gpu.id);
    setRentStatus("Confirming transaction...");
    setMessage({ type: "info", text: "Confirming transaction..." });

    try {
      const hours = hoursByGpu[gpu.id] ?? 1;
      let txHash: string | undefined;
      let agreementId: string | null | undefined;

      const rentalTx = await rentGPU(provider, gpu, hours, (text, hash) => {
        setRentStatus("Confirming transaction...");
        setMessage({ type: "info", text: hash ? `${text}. Tx: ${hash}` : text });
      });
      txHash = rentalTx.receipt?.hash;
      agreementId = rentalTx.agreementId;

      setRentStatus("Starting Docker container...");
      await createRental({ account, gpu, hours, txHash, agreementId });
      setRentStatus("Generating SSH access...");
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      await loadGPUs();
      setRentStatus("Machine is ready!");
      setMessage({ type: "success", text: `Machine is ready. Open Active Rentals to copy SSH access. Tx: ${txHash ?? "confirmed"}` });
      window.setTimeout(() => setPendingRentalGpu(null), 1200);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Rental failed." });
      setRentStatus("");
    } finally {
      setRentingGpuId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Marketplace</p>
          <h1 className="mt-2 text-4xl font-bold">Browse GPUs</h1>
          <p className="mt-3 max-w-2xl text-violet-100">
            Choose an on-chain registered machine, inspect details, then rent through the Sepolia contract.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All GPUs"],
            ["available", "Available"],
            ["unavailable", "Unavailable"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as Filter)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                filter === value ? "bg-violet-600 text-white ring-1 ring-violet-400" : "bg-white text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {message ? <StatusMessage type={message.type}>{message.text}</StatusMessage> : null}
      {isLoading ? <LoadingState title="Loading GPU marketplace" /> : null}
      {!isLoading && visibleGPUs.length === 0 ? (
        <EmptyState title="No GPUs" message="No machines match this availability filter." />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleGPUs.map((gpu) => (
          <GPUCard
            key={gpu.id}
            gpu={gpu}
            hours={hoursByGpu[gpu.id] ?? 1}
            disabled={!account || gpu.source !== "contract" || gpu.status !== "available" || gpu.provider.toLowerCase() === account.toLowerCase() || !isContractConfigured()}
            isRenting={rentingGpuId === gpu.id}
            onHoursChange={(gpuId, hours) =>
              setHoursByGpu((current) => ({ ...current, [gpuId]: Math.max(1, Math.min(24, hours)) }))
            }
            onRent={handleRent}
            onDetails={setSelectedGpu}
          />
        ))}
      </div>
      <GPUDetailModal gpu={selectedGpu} onClose={() => setSelectedGpu(null)} />
      <RentConfirmationModal
        gpu={pendingRentalGpu}
        hours={pendingRentalGpu ? hoursByGpu[pendingRentalGpu.id] ?? 1 : 1}
        status={rentStatus}
        isConfirming={Boolean(rentingGpuId)}
        onCancel={() => {
          if (!rentingGpuId) {
            setPendingRentalGpu(null);
            setRentStatus("");
          }
        }}
        onConfirm={confirmRent}
      />
    </section>
  );
}
