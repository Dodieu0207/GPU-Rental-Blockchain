import Link from "next/link";
import { WalletStatusPanel } from "@/components/wallet/WalletStatusPanel";

export default function AuthPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Authentication Flow
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Sign Up or Login</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          MVP authentication is mocked for demo. Choose role, connect wallet,
          then continue to the main menu.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {[
          {
            role: "Host",
            body: "List GPU machines, manage pricing, view earnings, and withdraw ETH.",
            href: "/host",
          },
          {
            role: "Tenant",
            body: "Browse GPUs, rent by hour, manage active rentals, and view history.",
            href: "/marketplace",
          },
        ].map((item) => (
          <article
            key={item.role}
            className="rounded-lg border border-line bg-white p-5 shadow-soft"
          >
            <h2 className="text-xl font-bold text-ink">Continue as {item.role}</h2>
            <p className="mt-2 text-sm text-gray-600">{item.body}</p>
            <Link
              href={item.href}
              className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Choose {item.role}
            </Link>
          </article>
        ))}
      </div>

      <WalletStatusPanel />
    </section>
  );
}
