"use client";

import type { GPU } from "@/lib/types";

type GPUCardProps = {
  gpu: GPU;
  hours: number;
  disabled?: boolean;
  isRenting?: boolean;
  onHoursChange: (gpuId: string, hours: number) => void;
  onRent: (gpu: GPU) => void;
};

export function GPUCard({
  gpu,
  hours,
  disabled,
  isRenting,
  onHoursChange,
  onRent,
}: GPUCardProps) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{gpu.name}</h2>
          <p className="mt-1 text-sm text-gray-600">VRAM: {gpu.vram}</p>
          <p className="mt-1 text-sm text-gray-600">Provider: {gpu.provider}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            gpu.available
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {gpu.available ? "Available" : "Rented"}
        </span>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Price per hour
            </p>
            <p className="text-xl font-bold text-ink">{gpu.priceEth} ETH</p>
          </div>
          <label className="text-sm font-medium text-gray-700">
            Hours
            <input
              type="number"
              min={1}
              max={24}
              value={hours}
              onChange={(event) =>
                onHoursChange(gpu.id, Number(event.target.value) || 1)
              }
              className="mt-1 block w-24 rounded-md border border-line px-3 py-2"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={disabled || !gpu.available || isRenting}
          onClick={() => onRent(gpu)}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isRenting ? "Waiting for MetaMask..." : "Rent GPU by Hour"}
        </button>
      </div>
    </article>
  );
}
