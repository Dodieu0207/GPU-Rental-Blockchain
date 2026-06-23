"use client";

import { useMemo, useState } from "react";
import type { Transaction } from "@/lib/types";

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");

  const filtered = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          (status === "All" || transaction.status === status) &&
          (type === "All" || transaction.type === type),
      ),
    [status, transactions, type],
  );

  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-ink">Transaction History</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            {["All", "Success", "Pending", "Failed"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            {["All", "Rent", "Deposit", "Withdraw", "Extend", "End Rental"].map(
              (item) => (
                <option key={item}>{item}</option>
              ),
            )}
          </select>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-gray-500">
            <tr>
              <th className="py-3 pr-4">Date</th>
              <th className="py-3 pr-4">Type</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((transaction) => (
              <tr key={transaction.id}>
                <td className="py-3 pr-4">{transaction.date}</td>
                <td className="py-3 pr-4">{transaction.type}</td>
                <td className="py-3 pr-4">{transaction.status}</td>
                <td className="py-3 pr-4">{transaction.amountEth} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
