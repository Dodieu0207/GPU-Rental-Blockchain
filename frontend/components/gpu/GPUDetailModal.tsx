"use client";

import type { GPU } from "@/lib/types";
import { formatDateTime, shortenAddress } from "@/lib/format";

type Props = {
  gpu: GPU | null;
  onClose: () => void;
};

export function GPUDetailModal({ gpu, onClose }: Props) {
  if (!gpu) return null;

  const details = [
    ["GPU", gpu.gpu],
    ["VRAM", gpu.vram],
    ["CPU", gpu.cpu],
    ["SSD", gpu.ssd],
    ["CUDA", gpu.cuda],
    ["Operating System", gpu.os],
    ["Network", gpu.network],
    ["Location", gpu.location],
    ["CID", gpu.cid ?? "No CID"],
    ["Provider", shortenAddress(gpu.provider)],
    ["Price", `${gpu.priceEth} ETH / hour`],
    ["Availability", gpu.status],
    ["Register Time", formatDateTime(gpu.registeredAt)],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 text-ink shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-violet-700">{gpu.machineId}</p>
            <h2 className="mt-1 text-2xl font-bold">{gpu.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-md border border-line p-3">
              <p className="text-xs uppercase text-gray-500">{label}</p>
              <p className="mt-1 break-words font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
