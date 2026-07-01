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
import { signInProfile, signUpProfile } from "@/lib/api";
import type { UserRole } from "@/lib/types";

type WalletContextValue = {
  account: string | null;
  chainId: number | null;
  error: string | null;
  role: UserRole;
  isConnecting: boolean;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  signUpWithWallet: (role: UserRole) => Promise<void>;
  disconnectWallet: () => void;
  clearCache: () => void;
  getProvider: () => BrowserProvider | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const WALLET_STORAGE_KEY = "decompute.walletAddress";
const ROLE_STORAGE_KEY = "decompute.role";

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
  const [role, setRoleState] = useState<UserRole>("tenant");
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

  const applyBackendUser = useCallback((user: { walletAddress: string; role: "provider" | "renter" }) => {
    const nextRole = user.role === "provider" ? "host" : "tenant";
    setAccount(user.walletAddress);
    setRoleState(nextRole);
    window.localStorage.setItem(WALLET_STORAGE_KEY, user.walletAddress);
    window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
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

      if (nextAccount) {
        const user = await signInProfile(nextAccount);
        applyBackendUser(user);
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
  }, [applyBackendUser, loadChainId]);

  const signUpWithWallet = useCallback(async (nextRole: UserRole) => {
    setError(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const nextAccount = accounts[0] ?? null;
      if (!nextAccount) throw new Error("No wallet account selected.");
      const user = await signUpProfile(nextAccount, nextRole);
      applyBackendUser(user);
      await loadChainId();
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Could not sign up wallet.");
    } finally {
      setIsConnecting(false);
    }
  }, [applyBackendUser, loadChainId]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }, []);

  const clearCache = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
    setAccount(null);
    setChainId(null);
    setError(null);
    setRoleState("tenant");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY) as UserRole | null;

    if (savedRole && ["tenant", "host"].includes(savedRole)) {
      setRoleState(savedRole);
    }

    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" })
        .then((accounts) => {
          const nextAccount = ((accounts as string[]) ?? [])[0] ?? null;
          setAccount(nextAccount);
          if (nextAccount) {
            signInProfile(nextAccount)
              .then(applyBackendUser)
              .catch(() => {
                setAccount(null);
                window.localStorage.removeItem(WALLET_STORAGE_KEY);
                window.localStorage.removeItem(ROLE_STORAGE_KEY);
              });
          } else {
            window.localStorage.removeItem(WALLET_STORAGE_KEY);
            window.localStorage.removeItem(ROLE_STORAGE_KEY);
          }
        })
        .catch(() => {
          setAccount(null);
          window.localStorage.removeItem(WALLET_STORAGE_KEY);
        });
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
        window.localStorage.setItem(WALLET_STORAGE_KEY, nextAccount);
        void signInProfile(nextAccount).then(applyBackendUser).catch(() => {
          setAccount(null);
          window.localStorage.removeItem(WALLET_STORAGE_KEY);
          window.localStorage.removeItem(ROLE_STORAGE_KEY);
        });
      } else {
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
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
  }, [applyBackendUser, loadChainId]);

  const value = useMemo<WalletContextValue>(
    () => ({
      account,
      chainId,
      error,
      role,
      isConnecting,
      isConnected: Boolean(account),
      connectWallet,
      signUpWithWallet,
      disconnectWallet,
      clearCache,
      getProvider,
    }),
    [
      account,
      chainId,
      connectWallet,
      signUpWithWallet,
      clearCache,
      disconnectWallet,
      error,
      getProvider,
      isConnecting,
      role,
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
