import { TransactionTable } from "@/components/transaction/TransactionTable";
import { demoTransactions } from "@/lib/demoData";

export default function TransactionsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Ledger
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Transaction History</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          View all transactions and filter by status or type. Date filter can be
          wired once real backend/indexer data is available.
        </p>
      </div>
      <TransactionTable transactions={demoTransactions} />
    </section>
  );
}
