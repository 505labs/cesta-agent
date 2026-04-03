"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { wagmiAdapter, projectId, evmChains } from "./wagmi";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { solana, solanaDevnet } from "@reown/appkit/networks";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { AuthProvider } from "@/context/AuthContext";

// Create query client
const queryClient = new QueryClient();

// Solana adapter
const solanaWeb3JsAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

// App metadata for WalletConnect modal
const metadata = {
  name: "RoadTrip Co-Pilot",
  description: "Give your car a wallet. Voice-first AI road trip agent.",
  url: "https://roadtrip-copilot.xyz",
  icons: ["/icon.svg"],
};

// All networks: EVM chains + Solana chains
const allNetworks = [...evmChains, solana, solanaDevnet] as const;

// Initialize Reown AppKit with both EVM + Solana adapters
createAppKit({
  adapters: [wagmiAdapter, solanaWeb3JsAdapter],
  projectId,
  networks: allNetworks as any,
  defaultNetwork: evmChains[0],
  metadata,
  features: {
    analytics: false,
    swaps: true,
    onramp: true,
  },
});

export default function AppKitProvider({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
