"use client";

import { useReadContract } from "wagmi";
import { type Address } from "viem";

// AgentNFT ABI (minimal for reading)
const AgentNFT_ABI = [
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "_tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "descriptionURI", type: "string" },
          { name: "creator", type: "address" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

// AgentReputation ABI (minimal for reading)
const AgentReputation_ABI = [
  {
    type: "function",
    name: "getAgentStats",
    inputs: [{ name: "_agentTokenId", type: "uint256" }],
    outputs: [
      { name: "avgRating", type: "uint256" },
      { name: "numRatings", type: "uint256" },
      { name: "numTrips", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

interface AgentIdentityProps {
  agentNftAddress?: Address;
  reputationAddress?: Address;
  tokenId?: bigint;
}

export default function AgentIdentity({
  agentNftAddress,
  reputationAddress,
  tokenId = 0n,
}: AgentIdentityProps) {
  const hasContracts = agentNftAddress && reputationAddress;

  const { data: agentData } = useReadContract({
    address: agentNftAddress,
    abi: AgentNFT_ABI,
    functionName: "getAgent",
    args: [tokenId],
    query: { enabled: !!hasContracts },
  });

  const { data: stats } = useReadContract({
    address: reputationAddress,
    abi: AgentReputation_ABI,
    functionName: "getAgentStats",
    args: [tokenId],
    query: { enabled: !!hasContracts },
  });

  const agent = agentData as any;
  const agentStats = stats as any;

  const avgRating = agentStats ? Number(agentStats[0]) / 100 : 0;
  const numRatings = agentStats ? Number(agentStats[1]) : 0;
  const numTrips = agentStats ? Number(agentStats[2]) : 0;

  return (
    <div className="glass-card p-4">
      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        Agent iNFT
      </h4>

      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-lg">
          R
        </div>
        <div>
          <p className="font-semibold text-sm">
            {agent?.name || "RoadTrip Co-Pilot"}
          </p>
          <p className="text-xs text-[var(--text-secondary)] font-mono">
            Token #{tokenId.toString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center py-2 rounded-lg bg-[var(--bg-secondary)]">
          <p className="text-lg font-semibold" style={{ color: "var(--accent-amber)" }}>
            {avgRating > 0 ? avgRating.toFixed(1) : "--"}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Rating</p>
        </div>
        <div className="text-center py-2 rounded-lg bg-[var(--bg-secondary)]">
          <p className="text-lg font-semibold" style={{ color: "var(--accent-blue)" }}>
            {numRatings || "--"}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Reviews</p>
        </div>
        <div className="text-center py-2 rounded-lg bg-[var(--bg-secondary)]">
          <p className="text-lg font-semibold" style={{ color: "var(--accent-green)" }}>
            {numTrips || "--"}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">Trips</p>
        </div>
      </div>

      {!hasContracts && (
        <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
          Deploy AgentNFT to 0G Chain to activate
        </p>
      )}
    </div>
  );
}
