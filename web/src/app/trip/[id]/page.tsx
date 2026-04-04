"use client";

import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useAuth } from "@/context/AuthContext";
import ConnectButton from "@/components/ConnectButton";
import TreasuryDashboard from "@/components/TreasuryDashboard";
import SpendingFeed from "@/components/SpendingFeed";
import VoiceInterface from "@/components/VoiceInterface";
import ZeroGStatus from "@/components/ZeroGStatus";
import AgentIdentity from "@/components/AgentIdentity";
import { type Address } from "viem";

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const { isConnected } = useAccount();
  const { token } = useAuth();

  const tripId = BigInt(params.id as string);
  const tripIdStr = params.id as string;

  // 0G contract addresses (set after deployment to 0G Galileo)
  const agentNftAddress = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS as Address | undefined;
  const reputationAddress = process.env.NEXT_PUBLIC_AGENT_REPUTATION_ADDRESS as Address | undefined;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <h2 className="text-xl font-semibold mb-4">Connect your wallet</h2>
        <p className="text-[var(--text-secondary)] mb-6">
          You need to connect a wallet to view this trip.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
            R
          </div>
          <div>
            <span className="text-lg font-semibold tracking-tight">
              Trip #{tripIdStr}
            </span>
          </div>
        </div>
        <ConnectButton />
      </nav>

      {/* Main Content - 2 column layout on desktop */}
      <div className="flex-1 p-4 lg:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left column: Treasury + Spending */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-green)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                  <path d="M12 18V6" />
                </svg>
                Treasury
              </h2>
              <TreasuryDashboard tripId={tripId} />
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-amber)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
                Spending
              </h2>
              <SpendingFeed tripId={tripId} />
            </div>
          </div>

          {/* Right column: Voice Interface + 0G Status */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-blue)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                Co-Pilot
              </h2>
              <VoiceInterface tripId={tripIdStr} token={token ?? undefined} />
            </div>

            <AgentIdentity
              agentNftAddress={agentNftAddress}
              reputationAddress={reputationAddress}
              tokenId={0n}
            />

            <ZeroGStatus />
          </div>
        </div>
      </div>
    </div>
  );
}
