import { cookieStorage, createStorage, http } from "wagmi";
import { defineChain } from "viem";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

// Local Anvil chain for development
export const anvilLocal = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_CHAIN_RPC_URL || "http://127.0.0.1:8545",
      ],
    },
  },
  testnet: true,
});

// WalletConnect project ID
export const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

if (!projectId) {
  console.warn(
    "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — WalletConnect will not work"
  );
}

// Supported chains
export const chains = [anvilLocal] as const;

// Wagmi adapter for Reown AppKit
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks: chains,
  transports: {
    [anvilLocal.id]: http(
      process.env.NEXT_PUBLIC_CHAIN_RPC_URL || "http://127.0.0.1:8545"
    ),
  },
});
