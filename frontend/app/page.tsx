import Link from "next/link";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { WalletStatusPanel } from "@/components/wallet/WalletStatusPanel";

export default function HomePage() {
  return (
    <section className="space-y-10 py-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Blockchain GPU Rental Marketplace
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-ink sm:text-5xl">
            DeCompute connects GPU Hosts and Tenants through Sepolia smart contracts.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Hosts list machines and earn ETH. Tenants browse GPUs, rent by hour,
            confirm through MetaMask, and manage active rentals.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="rounded-md bg-brand px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Get Started
            </Link>
            <Link
              href="/auth"
              className="rounded-md border border-line bg-white px-5 py-3 font-semibold text-ink transition hover:bg-gray-50"
            >
              Login
            </Link>
            <ConnectWalletButton />
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold text-ink">Main Menu</h2>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Browse GPUs", "/marketplace"],
              ["Rent GPU", "/marketplace"],
              ["Payment", "/payments"],
              ["Transaction History", "/transactions"],
              ["User Guide", "/guides"],
              ["Account Settings", "/settings"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="rounded-md border border-line px-4 py-3 font-semibold text-ink hover:bg-gray-50"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <WalletStatusPanel />
    </section>
  );
}
