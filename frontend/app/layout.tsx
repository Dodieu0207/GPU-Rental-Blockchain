import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "DeCompute",
  description: "Decentralized GPU rental marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <AppShell>{children}</AppShell>
        </WalletProvider>
      </body>
    </html>
  );
}
