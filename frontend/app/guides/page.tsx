"use client";

import { useState } from "react";

const guides = {
  tenant: ["Connect Wallet", "Browse GPUs", "Rent GPU", "Confirm Wallet Transaction", "Open Sandbox", "End Rental"],
  host: ["Connect Wallet", "Download Agent", "Connect Agent", "Scan Machine", "Upload Metadata", "Register GPU", "Monitor Rentals", "Withdraw Earnings"],
};

export default function GuidesPage() {
  const [tab, setTab] = useState<"tenant" | "host">("tenant");

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Guide</p>
        <h1 className="mt-2 text-4xl font-bold">How to Use DeCompute</h1>
      </div>
      <div className="inline-flex rounded-lg bg-white p-1 text-ink">
        {(["tenant", "host"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-md px-5 py-2 text-sm font-semibold capitalize ${
              tab === item ? "bg-violet-600 text-white" : "text-ink hover:bg-violet-50"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <h2 className="text-2xl font-bold">{tab === "tenant" ? "Tenant Guide" : "Host Guide"}</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-2">
          {guides[tab].map((step, index) => (
            <li key={step} className="flex items-center gap-3 rounded-md border border-line p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                {index + 1}
              </span>
              <span className="font-semibold">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
