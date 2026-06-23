"use client";

import { useEffect, useState } from "react";
import { StatusMessage } from "@/components/StatusMessage";
import { useWallet } from "@/components/WalletProvider";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

type BackendRental = {
  id: string;
  gpuId: string;
  status: string;
  startedAt: string;
  rentalEndTime: string;
  session?: {
    accessUrl?: string;
    containerId?: string;
    mode?: string;
  };
};

export default function RentalsPage() {
  const { account } = useWallet();
  const [rentals, setRentals] = useState<BackendRental[]>([]);
  const [message, setMessage] = useState<{
    type: "info" | "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const loadRentals = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/rentals`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load rentals.");
      setRentals(body);
    } catch (error) {
      setMessage({
        type: "warning",
        text: error instanceof Error ? error.message : "Backend is not running.",
      });
    }
  };

  useEffect(() => {
    void loadRentals();
  }, []);

  const stopRental = async (rentalId: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/rentals/${rentalId}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": "tenant",
          "X-User-Id": account || "tenant-demo",
        },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not stop rental.");
      setMessage({ type: "success", text: "Rental stopped and Agent was notified." });
      await loadRentals();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Stop rental failed.",
      });
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Tenant
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Active Rentals</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            View active GPU rentals, open sandbox access, or stop the container.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRentals}
          className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50"
        >
          Reload
        </button>
      </div>

      {message ? <StatusMessage type={message.type}>{message.text}</StatusMessage> : null}

      <div className="grid gap-5 md:grid-cols-2">
        {rentals.map((rental) => (
          <article key={rental.id} className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-ink">GPU {rental.gpuId}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Started {new Date(rental.startedAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Ends {new Date(rental.rentalEndTime).toLocaleString()}
                </p>
                {rental.session?.accessUrl ? (
                  <a
                    href={rental.session.accessUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-brand"
                  >
                    Open sandbox access
                  </a>
                ) : null}
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {rental.status}
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => stopRental(rental.id)}
                disabled={!["active", "starting"].includes(rental.status)}
                className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Stop Container
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
