"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrowserProvider } from "ethers";

export type UserRole = "renter" | "provider" | "admin";

type WalletContextValue = {
  account: string | null;
  chainId: number | null;
  error: string | null;
  role: UserRole;
  isConnecting: boolean;
  isConnected: boolean;
  isSepolia: boolean;
  connectWallet: () => Promise<void>;
  switchToSepolia: () => Promise<void>;
  setRole: (role: UserRole) => void;
  getProvider: () => BrowserProvider | null;
};

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_HEX = "0xaa36a7";
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const WalletContext = createContext<WalletContextValue | null>(null);

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRoleState] = useState<UserRole>("renter");
  const [isConnecting, setIsConnecting] = useState(false);

  const getProvider = useCallback(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      return null;
    }

    return new BrowserProvider(window.ethereum);
  }, []);

  const loadChainId = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setChainId(null);
      return;
    }

    const network = await provider.getNetwork();
    setChainId(Number(network.chainId));
  }, [getProvider]);

  const linkWalletToBackend = useCallback(
    async (walletAddress: string, nextRole: UserRole) => {
      try {
        await fetch(`${backendUrl}/api/users/connect-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            role: nextRole,
            userId: walletAddress,
          }),
        });
      } catch {
        // Demo backend can be offline; never block MetaMask connection on this.
      }
    },
    [],
  );

  const switchToSepolia = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
      setChainId(SEPOLIA_CHAIN_ID);
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Please switch MetaMask to Sepolia.",
      );
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const nextAccount = accounts[0] ?? null;
      setAccount(nextAccount);

      if (nextAccount) {
        window.localStorage.setItem("decompute.walletAddress", nextAccount);
        await linkWalletToBackend(nextAccount, role);
      }

      await loadChainId();
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Could not connect wallet.",
      );
    } finally {
      setIsConnecting(false);
    }
  }, [linkWalletToBackend, loadChainId, role]);

  const setRole = useCallback(
    (nextRole: UserRole) => {
      setRoleState(nextRole);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("decompute.role", nextRole);
      }

      if (account) {
        void linkWalletToBackend(account, nextRole);
      }
    },
    [account, linkWalletToBackend],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedRole = window.localStorage.getItem("decompute.role") as UserRole | null;
    const savedWallet = window.localStorage.getItem("decompute.walletAddress");

    if (savedRole && ["renter", "provider", "admin"].includes(savedRole)) {
      setRoleState(savedRole);
    }

    if (savedWallet) {
      setAccount(savedWallet);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      return;
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[]) ?? [];
      const nextAccount = accounts[0] ?? null;
      setAccount(nextAccount);

      if (nextAccount) {
        window.localStorage.setItem("decompute.walletAddress", nextAccount);
        void linkWalletToBackend(nextAccount, role);
      } else {
        window.localStorage.removeItem("decompute.walletAddress");
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const nextChainId = args[0] as string;
      setChainId(Number.parseInt(nextChainId, 16));
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    void loadChainId();

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [linkWalletToBackend, loadChainId, role]);

  const value = useMemo<WalletContextValue>(
    () => ({
      account,
      chainId,
      error,
      role,
      isConnecting,
      isConnected: Boolean(account),
      isSepolia: chainId === SEPOLIA_CHAIN_ID,
      connectWallet,
      switchToSepolia,
      setRole,
      getProvider,
    }),
    [
      account,
      chainId,
      connectWallet,
      error,
      getProvider,
      isConnecting,
      role,
      setRole,
      switchToSepolia,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }

  return context;
}
