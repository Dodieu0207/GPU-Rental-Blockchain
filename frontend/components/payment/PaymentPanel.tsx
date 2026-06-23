"use client";

import { useState } from "react";

export function PaymentPanel() {
  const [amount, setAmount] = useState("0.05");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Tenant Payment</h2>
        <p className="mt-2 text-sm text-gray-600">Deposit ETH and view balance.</p>
        <label className="mt-5 block text-sm font-medium text-gray-700">
          Deposit amount
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2"
          />
        </label>
        <button className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
          Deposit ETH
        </button>
      </section>
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Host Earnings</h2>
        <p className="mt-2 text-sm text-gray-600">Withdraw earnings from contract.</p>
        <div className="mt-5 rounded-md bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Withdrawable balance</p>
          <p className="text-2xl font-bold text-ink">0.18 ETH</p>
        </div>
        <button className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">
          Withdraw Earnings
        </button>
      </section>
    </div>
  );
}
