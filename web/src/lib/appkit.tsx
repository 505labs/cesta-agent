"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { wagmiAdapter, projectId, chains } from "./wagmi";
import { AuthProvider } from "@/context/AuthContext";

// Create query client
const queryClient = new QueryClient();

// App metadata for WalletConnect modal
const metadata = {
  name: "RoadTrip Co-Pilot",
  description: "Give your car a wallet. Voice-first AI road trip agent.",
  url: "https://roadtrip-copilot.xyz",
  icons: ["/icon.svg"],
};

// Initialize Reown AppKit
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  networks: chains as any,
  defaultNetwork: chains[0],
  metadata,
  features: {
    analytics: false,
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
