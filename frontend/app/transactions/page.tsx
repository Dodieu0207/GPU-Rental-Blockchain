"use client";

import { useEffect, useState } from "react";
import { TransactionTable } from "@/components/transaction/TransactionTable";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { StatusMessage } from "@/components/StatusMessage";
import { fetchTransactions } from "@/lib/api";
import { contractAddress, isContractConfigured } from "@/lib/contract";
import type { Transaction } from "@/lib/types";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions()
      .then(setTransactions)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "No transactions found."))
      .finally(() => setIsLoading(false));
  }, []);

  const txHashRows = transactions.filter((transaction) => transaction.txHash);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Ledger</p>
        <h1 className="mt-2 text-4xl font-bold">Transaction History</h1>
        <p className="mt-3 max-w-2xl text-violet-100">
          DeCompute rental payments are public Sepolia transactions. Use Etherscan to inspect the contract and confirmed wallet activity.
        </p>
      </div>
      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <p className="text-sm font-semibold uppercase text-gray-500">Current Contract</p>
        <p className="mt-2 break-all font-mono text-sm">{isContractConfigured() ? contractAddress : "Contract address is not configured."}</p>
        {isContractConfigured() ? (
          <a
            href={`https://sepolia.etherscan.io/address/${contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            View Contract on Sepolia Etherscan
          </a>
        ) : null}
      </section>
      {error ? <StatusMessage type="warning">{error}</StatusMessage> : null}
      {isLoading ? <LoadingState title="Loading transactions" /> : null}
      {!isLoading && txHashRows.length === 0 ? (
        <EmptyState title="No Local Tx Hashes" message="No backend transaction hashes are stored yet. Contract activity is still visible from the Etherscan link above." />
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-violet-100">Recent backend tx hashes</p>
          <TransactionTable transactions={txHashRows} />
        </div>
      )}
    </section>
  );
}
