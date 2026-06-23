import type { Rental } from "@/lib/types";

export function RentalCard({ rental }: { rental: Rental }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">{rental.gpuName}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {rental.hours} hours, ends {rental.endsAt}
          </p>
          <p className="mt-1 text-sm text-gray-600">Paid: {rental.priceEth} ETH</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {rental.status}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-50">
          Extend Rental Time
        </button>
        <button className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
          End Rental
        </button>
      </div>
    </article>
  );
}
