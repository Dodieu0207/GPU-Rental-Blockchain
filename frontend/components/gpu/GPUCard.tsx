"use client";

import type { GPU } from "@/lib/types";
import { shortenAddress, shortenCid } from "@/lib/format";

type GPUCardProps = {
  gpu: GPU;
  hours: number;
  disabled?: boolean;
  isRenting?: boolean;
  onHoursChange: (gpuId: string, hours: number) => void;
  onRent: (gpu: GPU) => void;
  onDetails: (gpu: GPU) => void;
};

export function GPUCard({
  gpu,
  hours,
  disabled,
  isRenting,
  onHoursChange,
  onRent,
  onDetails,
}: GPUCardProps) {
  const available = gpu.status === "available";

  return (
    <article className="rounded-lg bg-white p-5 text-ink shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-700">{gpu.machineId}</p>
          <h2 className="mt-2 text-xl font-bold">{gpu.gpu}</h2>
          <p className="mt-1 text-sm text-gray-600">{gpu.vram} · CUDA {gpu.cuda}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            available ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {available ? "Available" : "Unavailable"}
        </span>
      </div>

      <div className="mt-5 grid gap-2 text-sm text-gray-700">
        <p>CPU: <span className="font-semibold text-ink">{gpu.cpu}</span></p>
        <p>SSD: <span className="font-semibold text-ink">{gpu.ssd}</span></p>
        <p>Network: <span className="font-semibold text-ink">{gpu.network}</span></p>
        <p>Location: <span className="font-semibold text-ink">{gpu.location}</span></p>
        <p>CID: <span className="font-semibold text-ink">{shortenCid(gpu.cid)}</span></p>
        <p>Provider: <span className="font-semibold text-ink">{shortenAddress(gpu.provider)}</span></p>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Price per hour</p>
          <p className="text-2xl font-bold">{gpu.priceEth} ETH</p>
        </div>
        <label className="text-sm font-medium text-gray-700">
          Hours
          <input
            type="number"
            min={1}
            max={24}
            value={hours}
            onChange={(event) => onHoursChange(gpu.id, Number(event.target.value) || 1)}
            className="mt-1 block w-24 rounded-md border border-line px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onDetails(gpu)}
          className="rounded-md border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50"
        >
          View Details
        </button>
        <button
          type="button"
          disabled={disabled || !available || isRenting}
          onClick={() => onRent(gpu)}
          className="rounded-md bg-[#12091f] px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isRenting ? "Confirming..." : "Rent"}
        </button>
      </div>
    </article>
  );
}
