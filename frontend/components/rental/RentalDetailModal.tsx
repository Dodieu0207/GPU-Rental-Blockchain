"use client";

import type { Rental } from "@/lib/types";
import { formatDateTime, formatDuration, secondsRemaining } from "@/lib/format";

export function RentalDetailModal({
  rental,
  onClose,
}: {
  rental: Rental | null;
  onClose: () => void;
}) {
  if (!rental) return null;
  const copyText = async (value?: string | number) => {
    if (value === undefined || value === null || value === "") return;
    await navigator.clipboard.writeText(String(value));
  };

  const rows = [
    ["GPU", rental.gpuName],
    ["Rental ID", rental.id],
    ["Provider", rental.provider],
    ["Status", rental.status],
    ["Started Time", formatDateTime(rental.startedAt)],
    ["Duration", formatDuration(rental.durationSeconds)],
    ["Remaining Time", formatDuration(secondsRemaining(rental.rentalEndTime))],
    ["Transaction Hash", rental.transactionHash ?? "Not available"],
    ["Escrow Amount", rental.escrowAmount ?? "Stored on-chain"],
    ["Agreement ID", rental.smartContractAgreementId ?? "Not available"],
    ["Sandbox Endpoint", rental.sandboxEndpoint ?? "Not available"],
    ["SSH Command", rental.accessInfo?.sshCommand ?? "Not available"],
    ["Host / Address", rental.accessInfo?.host ?? rental.accessInfo?.address ?? "Not available"],
    ["SSH Username", rental.accessInfo?.username ?? "Not available"],
    ["SSH Password", rental.accessInfo?.password ?? "Not available"],
    ["SSH Port", rental.accessInfo?.sshPort ? String(rental.accessInfo.sshPort) : "Not available"],
    ["Container ID", rental.containerId ?? "Not available"],
    ["Container Status", rental.containerStatus ?? "Not available"],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 text-ink shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold">Rental Detail</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {!rental.accessInfo ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 sm:col-span-2">
              Container is starting or access info is not available yet. Please reload.
            </div>
          ) : (
            <div className="rounded-md border border-line bg-gray-50 p-3 sm:col-span-2">
              <p className="text-xs uppercase text-gray-500">Quick Copy</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => copyText(rental.accessInfo?.sshCommand)} className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50">Copy SSH Command</button>
                <button type="button" onClick={() => copyText(rental.accessInfo?.password)} className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50">Copy Password</button>
                <button type="button" onClick={() => copyText(rental.accessInfo?.host || rental.accessInfo?.address)} className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50">Copy Host</button>
                <button type="button" onClick={() => copyText(rental.accessInfo?.sshPort)} className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50">Copy Port</button>
              </div>
            </div>
          )}
          {rows.map(([label, value]) => (
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
