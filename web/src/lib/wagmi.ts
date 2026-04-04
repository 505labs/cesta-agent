import { cookieStorage, createStorage, http } from "wagmi";
import { defineChain } from "viem";
import { sepolia, baseSepolia } from "viem/chains";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

// Arc Testnet — Circle's L1 with USDC as native gas token
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 6,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
      webSocket: ["wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  contracts: {
    usdc: {
      address: "0x3600000000000000000000000000000000000000",
    },
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
  testnet: true,
});

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

// Supported EVM chains — Arc Testnet first (primary), then dev chains
export const evmChains = [arcTestnet, anvilLocal, sepolia, baseSepolia] as const;

// Wagmi adapter for Reown AppKit (EVM only — Solana uses its own adapter)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks: evmChains,
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    [anvilLocal.id]: http(
      process.env.NEXT_PUBLIC_CHAIN_RPC_URL || "http://127.0.0.1:8545"
    ),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
});
