import type { Transaction } from "@/lib/types";
import { shortenAddress } from "@/lib/format";

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="overflow-hidden rounded-lg bg-white text-ink shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-line bg-gray-50 text-gray-500">
            <tr>
              {["Transaction ID", "Type", "From", "To", "Amount", "Time", "Status", "Transaction Hash", "Action", "Rental ID", "GPU"].map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {transactions.map((transaction) => (
              <tr key={`${transaction.transactionId}-${transaction.txHash}`}>
                <td className="px-4 py-3">{transaction.transactionId}</td>
                <td className="px-4 py-3">{transaction.type}</td>
                <td className="px-4 py-3">{shortenAddress(transaction.from)}</td>
                <td className="px-4 py-3">{shortenAddress(transaction.to)}</td>
                <td className="px-4 py-3">{transaction.amount} ETH</td>
                <td className="px-4 py-3">{transaction.time}</td>
                <td className="px-4 py-3">{transaction.status}</td>
                <td className="px-4 py-3">{transaction.txHash ? shortenAddress(transaction.txHash) : "Not available"}</td>
                <td className="px-4 py-3">
                  {transaction.txHash ? (
                    <a href={`https://sepolia.etherscan.io/tx/${transaction.txHash}`} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 hover:underline">
                      View on Etherscan
                    </a>
                  ) : (
                    "Not available"
                  )}
                </td>
                <td className="px-4 py-3">{transaction.rentalId ?? "Not available"}</td>
                <td className="px-4 py-3">{transaction.gpu ?? "Not available"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
