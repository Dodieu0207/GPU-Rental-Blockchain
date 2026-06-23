"use client";

import { useCallback, useEffect, useState } from "react";
import { GPUCard } from "@/components/gpu/GPUCard";
import { StatusMessage } from "@/components/StatusMessage";
import { useWallet } from "@/components/WalletProvider";
import { demoGPUs } from "@/lib/demoData";
import { isContractConfigured, readGPUsFromContract, rentGPU } from "@/lib/contract";
import type { GPU } from "@/lib/types";

export default function MarketplacePage() {
  const { account, connectWallet, getProvider, isConnected, isSepolia, role } = useWallet();
  const [gpus, setGPUs] = useState<GPU[]>(demoGPUs);
  const [filter, setFilter] = useState<"all" | "available" | "unavailable">("all");
  const [hoursByGpu, setHoursByGpu] = useState<Record<string, number>>(
    Object.fromEntries(demoGPUs.map((gpu) => [gpu.id, 1])),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [rentingGpuId, setRentingGpuId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "info" | "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const loadGPUs = useCallback(async () => {
    const provider = getProvider();
    if (!provider || !isContractConfigured()) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000"}/api/gpus`);
        const backendGPUs = await response.json();
        if (!response.ok) throw new Error(backendGPUs.error || "Backend GPU load failed.");

        setGPUs(
          backendGPUs.map((gpu: {
            id: string;
            spec?: string;
            cid?: string;
            pricePerHourWei?: string;
            status?: string;
            providerId?: string;
          }) => ({
            id: gpu.id,
            name: gpu.spec || `GPU metadata ${gpu.cid}`,
            vram: gpu.spec?.match(/(\d+(?:\.\d+)?)\s*GB/i)?.[0] ?? "See IPFS metadata",
            priceEth: gpu.pricePerHourWei
              ? (Number(gpu.pricePerHourWei) / 1e18).toString()
              : "0",
            priceWei: gpu.pricePerHourWei,
            available: gpu.status === "available",
            provider: gpu.providerId || "Unknown provider",
            cid: gpu.cid,
          })),
        );
        setMessage({
          type: "success",
          text: "Loaded GPU list from backend.",
        });
      } catch {
        setMessage({
          type: "warning",
          text: "Showing demo GPUs. Start backend or add contract address to read live data.",
        });
      }
      return;
    }

    setIsLoading(true);
    try {
      const contractGPUs = await readGPUsFromContract(provider);
      setGPUs(contractGPUs);
      setHoursByGpu((current) => ({
        ...Object.fromEntries(contractGPUs.map((gpu) => [gpu.id, current[gpu.id] ?? 1])),
      }));
      setMessage({
        type: "success",
        text: "Loaded GPU list from smart contract.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not read GPU list from smart contract.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [getProvider]);

  useEffect(() => {
    if (isConnected) {
      void loadGPUs();
    }
  }, [isConnected, loadGPUs]);

  const handleRent = async (gpu: GPU) => {
    setMessage(null);

    if (!account) {
      await connectWallet();
      return;
    }

    if (!isSepolia) {
      setMessage({
        type: "warning",
        text: "Please switch MetaMask to Sepolia before renting.",
      });
      return;
    }

    if (role !== "renter") {
      setMessage({
        type: "warning",
        text: "Switch role to Renter before renting GPU compute.",
      });
      return;
    }

    const provider = getProvider();
    if (!provider) {
      setMessage({
        type: "error",
        text: "MetaMask provider not found.",
      });
      return;
    }

    setRentingGpuId(gpu.id);
    setMessage({
      type: "info",
      text: `MetaMask should open now. Confirm ${hoursByGpu[gpu.id] ?? 1} hour(s) for ${gpu.name}.`,
    });

    try {
      const hours = hoursByGpu[gpu.id] ?? 1;
      const rentalTx = await rentGPU(provider, gpu, hours);

      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000"}/api/rentals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": "tenant",
          "X-User-Id": account,
          "X-Wallet-Address": account,
        },
        body: JSON.stringify({
          gpuId: gpu.id,
          cid: gpu.cid,
          renterId: account,
          renterWalletAddress: account,
          hours,
          durationSeconds: hours * 3600,
          smartContractAgreementId: rentalTx.agreementId,
          escrowTxHash: rentalTx.receipt?.hash,
        }),
      }).catch(() => null);
      setMessage({
        type: "success",
        text: `Rental transaction confirmed for ${gpu.name}. Active rental created.`,
      });
      setGPUs((current) =>
        current.map((item) =>
          item.id === gpu.id ? { ...item, available: false } : item,
        ),
      );
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Rental transaction failed.",
      });
    } finally {
      setRentingGpuId(null);
    }
  };

  const visibleGPUs = gpus.filter((gpu) => {
    if (filter === "available") return gpu.available;
    if (filter === "unavailable") return !gpu.available;
    return true;
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Marketplace
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Browse GPUs</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Filter GPU machines, choose rental hours, confirm, then send the
            blockchain transaction through MetaMask.
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
              onClick={() => setFilter(value as typeof filter)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                filter === value
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={loadGPUs}
            disabled={isLoading}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Loading..." : "Reload GPUs"}
          </button>
        </div>
      </div>

      {message ? <StatusMessage type={message.type}>{message.text}</StatusMessage> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleGPUs.map((gpu) => (
          <GPUCard
            key={gpu.id}
            gpu={gpu}
            hours={hoursByGpu[gpu.id] ?? 1}
            disabled={!isConnected || !isSepolia || role !== "renter"}
            isRenting={rentingGpuId === gpu.id}
            onHoursChange={(gpuId, hours) =>
              setHoursByGpu((current) => ({
                ...current,
                [gpuId]: Math.max(1, Math.min(24, hours)),
              }))
            }
            onRent={handleRent}
          />
        ))}
      </div>

      {!isConnected ? (
        <StatusMessage type="info">
          Connect MetaMask to read contract data and enable the Rent buttons.
        </StatusMessage>
      ) : null}
    </section>
  );
}
