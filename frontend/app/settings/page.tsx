"use client";

import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useWallet } from "@/components/WalletProvider";
import { shortenAddress } from "@/lib/format";

export default function SettingsPage() {
  const { account, chainId, role, disconnectWallet, clearCache } = useWallet();

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-300">Settings</p>
        <h1 className="mt-2 text-4xl font-bold">Account Settings</h1>
      </div>

      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <h2 className="text-xl font-bold">Wallet</h2>
        <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
          <p>Address: <span className="font-semibold text-ink">{account ? shortenAddress(account) : "Not connected"}</span></p>
          <p>Chain ID: <span className="font-semibold text-ink">{chainId ?? "Not connected"}</span></p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <ConnectWalletButton />
          <button
            type="button"
            onClick={disconnectWallet}
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            Disconnect Wallet
          </button>
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <h2 className="text-xl font-bold">Role</h2>
        <p className="mt-3 text-sm text-gray-700">
          Registered role: <span className="font-semibold capitalize text-ink">{role}</span>
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Roles are fixed per wallet after signup. Use Clear Cache only for local demo reset; backend demo data remains in backend/data/users.json.
        </p>
      </section>

      <section className="rounded-lg bg-white p-6 text-ink shadow-soft">
        <h2 className="text-xl font-bold">Preferences</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Language
            <select className="mt-1 w-full rounded-md border border-line px-3 py-2" disabled>
              <option>English placeholder</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Theme
            <select className="mt-1 w-full rounded-md border border-line px-3 py-2" disabled>
              <option>Dark placeholder</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={clearCache}
          className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          Clear Cache
        </button>
      </section>
    </section>
  );
}
