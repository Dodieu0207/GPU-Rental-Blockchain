"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/WalletProvider";

const why = [
  "Trustless Payments",
  "GPU Metadata Verification",
  "IPFS",
  "Docker Sandbox",
  "Blockchain Settlement",
  "Decentralized Marketplace",
];

const stack = ["Ethereum", "Smart Contract", "MetaMask", "IPFS", "Docker", "Backend", "Host Agent", "Next.js"];

export default function HomePage() {
  const router = useRouter();
  const { account, role } = useWallet();

  const getStarted = () => {
    router.push(account ? (role === "host" ? "/host" : "/marketplace") : "/onboarding");
  };

  return (
    <div className="space-y-16">
      <section className="grid gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">
            Blockchain GPU Rental Marketplace
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight text-white">
            DeCompute
          </h1>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-violet-100">
            Rent verified GPU machines by the hour, settle escrow on-chain, and access compute through a Docker sandbox managed by the existing Host Agent.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={getStarted}
              className="rounded-md bg-white px-5 py-3 font-semibold text-ink transition hover:bg-violet-50"
            >
              Get Started
            </button>
            <Link
              href="/marketplace"
              className="rounded-md border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Browse GPUs
            </Link>
          </div>
        </div>
        <div className="relative min-h-[360px] overflow-hidden rounded-lg bg-white/10 p-6 ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(167,139,250,0.35),transparent_35%),radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.18),transparent_35%)]" />
          <div className="relative grid h-full place-items-center">
            <div className="w-full max-w-md rounded-lg bg-[#090515] p-5 shadow-2xl ring-1 ring-violet-400/30">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="aspect-square rounded-md bg-violet-500/20 ring-1 ring-violet-300/20" />
                ))}
              </div>
              <div className="mt-5 h-3 rounded bg-violet-400" />
              <div className="mt-3 h-3 w-2/3 rounded bg-white/40" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold">How DeCompute Works</h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Workflow title="Tenant workflow" steps={["Connect wallet", "Browse GPUs", "Rent by hour", "Confirm transaction", "Open sandbox", "End rental"]} />
          <Workflow title="Host workflow" steps={["Connect wallet", "Paste metadata CID", "Register GPU", "Confirm transaction", "Track rentals", "Withdraw earnings"]} />
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold">Why DeCompute</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {why.map((item) => <InfoCard key={item} title={item} />)}
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold">Technology Stack</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stack.map((item) => <InfoCard key={item} title={item} compact />)}
        </div>
      </section>
    </div>
  );
}

function Workflow({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-lg bg-white p-6 text-ink shadow-soft">
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="mt-5 grid gap-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
              {index + 1}
            </span>
            <span className="font-semibold">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ title, compact }: { title: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg bg-white text-ink shadow-soft ${compact ? "p-4" : "p-5"}`}>
      <p className="font-bold">{title}</p>
    </div>
  );
}
