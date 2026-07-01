"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusMessage } from "@/components/StatusMessage";
import { useWallet } from "@/components/WalletProvider";
import type { UserRole } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { account, connectWallet, error, isConnecting, role, signUpWithWallet } = useWallet();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const redirectByRole = (nextRole: UserRole) => {
    router.push(nextRole === "host" ? "/host" : "/marketplace");
  };

  const handleSignIn = async () => {
    await connectWallet();
    setLocalMessage("If this wallet is registered, DeCompute will load its saved role automatically.");
  };

  const handleSignUp = async () => {
    if (!selectedRole) {
      setLocalMessage("Choose Tenant or Host before signing up.");
      return;
    }

    await signUpWithWallet(selectedRole);
    redirectByRole(selectedRole);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Get Started</p>
        <h1 className="mt-2 text-4xl font-bold">Create your DeCompute role</h1>
        <p className="mt-3 text-violet-100">
          Choose your role once, then sign up with MetaMask. The same wallet will keep the same role on future sign-ins.
        </p>
      </div>

      {error ? <StatusMessage type="error">{error}</StatusMessage> : null}
      {localMessage ? <StatusMessage type="info">{localMessage}</StatusMessage> : null}
      {account ? <StatusMessage type="success">Signed in as {role}. Continue from the navigation bar.</StatusMessage> : null}

      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <p className="text-sm font-semibold uppercase text-violet-700">Step 1</p>
        <h2 className="mt-1 text-2xl font-bold">You want to be a...</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(["tenant", "host"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSelectedRole(item)}
              className={`rounded-md border p-5 text-left transition ${
                selectedRole === item ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-line hover:bg-gray-50"
              }`}
            >
              <span className="text-lg font-bold capitalize">{item}</span>
              <p className="mt-2 text-sm text-gray-600">
                {item === "tenant" ? "Rent GPU containers and pay with Sepolia ETH." : "Register your GPU, run Agent, and withdraw earnings."}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <p className="text-sm font-semibold uppercase text-violet-700">Step 2</p>
        <h2 className="mt-1 text-2xl font-bold">Sign up with MetaMask</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSignUp}
            disabled={!selectedRole || isConnecting}
            className="rounded-md bg-[#12091f] px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isConnecting ? "Connecting..." : "Sign up with MetaMask"}
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isConnecting}
            className="rounded-md border border-line px-5 py-3 text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign in with MetaMask
          </button>
        </div>
      </section>
    </section>
  );
}
