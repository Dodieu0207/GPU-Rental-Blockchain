"use client";

import type { GPU } from "@/lib/types";

type Props = {
  gpu: GPU | null;
  hours: number;
  status?: string;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RentConfirmationModal({ gpu, hours, status, isConfirming, onCancel, onConfirm }: Props) {
  if (!gpu) return null;

  const price = Number(gpu.priceEth || "0");
  const total = Number.isFinite(price) ? (price * hours).toString() : "On-chain";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section className="w-full max-w-2xl rounded-lg bg-white p-6 text-ink shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-violet-700">GPU Server Rental Confirmation</p>
            <h2 className="mt-1 text-2xl font-bold">{gpu.gpu}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-md border border-line p-4">
          <p className="font-semibold">Server configuration:</p>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Server name" value={gpu.name} />
            <Info label="VM" value={gpu.os || "Linux container"} />
            <Info label="GPU" value={gpu.gpu} />
            <Info label="CPU" value={gpu.cpu} />
            <Info label="RAM" value={gpu.ram || gpu.vram || "See metadata"} />
            <Info label="SSD Storage" value={gpu.ssd} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-md border border-line bg-gray-50 p-4 text-sm sm:grid-cols-3">
          <Info label="Price" value={`${gpu.priceEth} ETH / hour`} />
          <Info label="Duration" value={`${hours} hour(s)`} />
          <Info label="Total" value={`${total} ETH`} />
        </div>

        {status ? (
          <div className="mt-5 rounded-md border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800">
            {status}
            {status === "Machine is ready!" ? (
              <a href="/rentals" className="ml-3 inline-flex rounded-md bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-700">
                Open Active Rentals
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-md bg-[#12091f] px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isConfirming ? "Renting..." : "Confirm and Rent"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 break-words font-semibold">{value || "Not available"}</p>
    </div>
  );
}
