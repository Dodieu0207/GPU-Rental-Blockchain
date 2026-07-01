"use client";

import { MainNavbar } from "@/components/navbar/MainNavbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#180f49] text-white">
      <MainNavbar />
      <main className="mx-auto max-w-7xl px-4 py-10">{children}</main>
    </div>
  );
}
