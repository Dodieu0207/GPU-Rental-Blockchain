"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useWallet, type UserRole } from "@/components/WalletProvider";

const navItems = [
  { href: "/", label: "Landing" },
  { href: "/auth", label: "Auth" },
  { href: "/marketplace", label: "Browse GPUs" },
  { href: "/rentals", label: "Active Rentals" },
  { href: "/host", label: "Host" },
  { href: "/transactions", label: "Transactions" },
  { href: "/payments", label: "Payment" },
  { href: "/guides", label: "Guide" },
  { href: "/settings", label: "Settings" },
];

export function MainNavbar() {
  const pathname = usePathname();
  const { isConnected, isSepolia, role, setRole, switchToSepolia } = useWallet();

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="text-xl font-bold text-ink">
            DeCompute
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink"
            >
              <option value="renter">Renter</option>
              <option value="provider">Provider</option>
              <option value="admin">Platform owner</option>
            </select>
            <ConnectWalletButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto text-sm">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-2 font-medium ${
                  active
                    ? "bg-blue-50 text-brand"
                    : "text-gray-600 hover:bg-gray-100 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {isConnected && !isSepolia ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800">
          Wrong network.{" "}
          <button type="button" onClick={switchToSepolia} className="font-bold underline">
            Switch MetaMask to Sepolia
          </button>
          {" "}before blockchain actions.
        </div>
      ) : null}
    </header>
  );
}
