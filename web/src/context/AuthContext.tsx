"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { getNonce, verifySiwe } from "@/lib/api";
import { createSiweMessage } from "@/lib/siwe";

interface AuthState {
  token: string | null;
  walletAddress: string | null;
  isAuthenticating: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  walletAddress: null,
  isAuthenticating: false,
  error: null,
  signIn: async () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const TOKEN_KEY = "roadtrip_auth_token";
const WALLET_KEY = "roadtrip_auth_wallet";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [token, setToken] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedWallet = localStorage.getItem(WALLET_KEY);
    if (savedToken && savedWallet) {
      setToken(savedToken);
      setWalletAddress(savedWallet);
    }
  }, []);

  // Clear auth when wallet disconnects or address changes
  useEffect(() => {
    if (!isConnected) {
      setToken(null);
      setWalletAddress(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(WALLET_KEY);
    } else if (
      address &&
      walletAddress &&
      address.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      setToken(null);
      setWalletAddress(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(WALLET_KEY);
    }
  }, [isConnected, address, walletAddress]);

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;
    setIsAuthenticating(true);
    setError(null);

    try {
      const { nonce } = await getNonce();
      const domain = window.location.host;
      const uri = window.location.origin;

      const message = createSiweMessage({
        address,
        chainId,
        nonce,
        domain,
        uri,
      });

      const signature = await signMessageAsync({ message });

      const { token: newToken, wallet_address } = await verifySiwe(
        message,
        signature
      );

      setToken(newToken);
      setWalletAddress(wallet_address);
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(WALLET_KEY, wallet_address);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Sign-in failed";
      console.error("SIWE sign-in failed:", err);
      setError(message);
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(() => {
    setToken(null);
    setWalletAddress(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WALLET_KEY);
    disconnect();
  }, [disconnect]);

  // Auto sign-in when wallet connects and no token exists
  useEffect(() => {
    if (isConnected && address && !token && !isAuthenticating) {
      signIn();
    }
  }, [isConnected, address, token, isAuthenticating, signIn]);

  return (
    <AuthContext.Provider
      value={{ token, walletAddress, isAuthenticating, error, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
