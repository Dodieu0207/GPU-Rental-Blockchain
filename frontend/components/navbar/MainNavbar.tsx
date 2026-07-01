"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { useWallet } from "@/components/WalletProvider";

const guestItems = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Browse GPUs" },
  { href: "/guides", label: "Guide" },
];

const tenantItems = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Browse GPUs" },
  { href: "/rentals", label: "Active Rentals" },
  { href: "/transactions", label: "Transaction" },
  { href: "/guides", label: "Guide" },
  { href: "/settings", label: "Settings" },
];

const hostItems = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Browse GPUs" },
  { href: "/host", label: "Host" },
  { href: "/rentals", label: "Active Rentals" },
  { href: "/transactions", label: "Transaction" },
  { href: "/guides", label: "Guide" },
  { href: "/settings", label: "Settings" },
];

export function MainNavbar() {
  const pathname = usePathname() ?? "/";
  const { isConnected, role } = useWallet();
  const navItems = !isConnected ? guestItems : role === "host" ? hostItems : tenantItems;

  return (
    <header className="border-b border-white/10 bg-[#1b1252] shadow-[0_8px_30px_rgba(7,3,35,0.28)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex items-center gap-3 text-2xl font-bold text-white">
            <span className="grid h-10 w-10 place-items-center text-4xl leading-none">✶</span>
            <span>DeCompute</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {isConnected ? (
              <span className="rounded-md border border-white/30 bg-[#1b1252] px-3 py-2 text-sm font-semibold capitalize text-white">
                {role}
              </span>
            ) : null}
            <ConnectWalletButton />
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto text-base">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-4 py-2 font-semibold ${
                  active
                    ? "bg-violet-600 text-white ring-1 ring-violet-400"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
