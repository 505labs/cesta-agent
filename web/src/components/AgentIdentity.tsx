"use client";

import { useReadContract } from "wagmi";
import { type Address } from "viem";

// 0G Chain — AgentNFT ABI (minimal for reading)
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

// 0G Chain — AgentReputation ABI (minimal for reading)
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

// Arc — ERC-8004 IdentityRegistry ABI (minimal for reading)
const ArcIdentityRegistry_ABI = [
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentWallet",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

interface AgentIdentityProps {
  // 0G Chain identity
  agentNftAddress?: Address;
  reputationAddress?: Address;
  tokenId?: bigint;
  // Arc ERC-8004 identity
  arcIdentityAddress?: Address;
  arcAgentId?: bigint;
}

const ARC_IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address;

export default function AgentIdentity({
  agentNftAddress,
  reputationAddress,
  tokenId = 0n,
  arcIdentityAddress = ARC_IDENTITY_REGISTRY,
  arcAgentId,
}: AgentIdentityProps) {
  const has0GContracts = agentNftAddress && reputationAddress;
  const hasArcIdentity = !!arcAgentId;

  // 0G Chain reads
  const { data: agentData } = useReadContract({
    address: agentNftAddress,
    abi: AgentNFT_ABI,
    functionName: "getAgent",
    args: [tokenId],
    query: { enabled: !!has0GContracts },
  });

  const { data: stats } = useReadContract({
    address: reputationAddress,
    abi: AgentReputation_ABI,
    functionName: "getAgentStats",
    args: [tokenId],
    query: { enabled: !!has0GContracts },
  });

  // Arc ERC-8004 reads
  const { data: arcOwner } = useReadContract({
    address: arcIdentityAddress,
    abi: ArcIdentityRegistry_ABI,
    functionName: "ownerOf",
    args: [arcAgentId!],
    query: { enabled: hasArcIdentity },
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
        Agent Identity
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
            {has0GContracts ? `0G #${tokenId.toString()}` : ""}
            {has0GContracts && hasArcIdentity ? " · " : ""}
            {hasArcIdentity ? `Arc #${arcAgentId!.toString()}` : ""}
          </p>
        </div>
      </div>

      {/* Identity badges */}
      <div className="flex gap-2 mb-3">
        {has0GContracts && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            0G iNFT
          </span>
        )}
        {hasArcIdentity && arcOwner && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Arc ERC-8004
          </span>
        )}
      </div>

      {/* Stats from 0G reputation */}
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

      {!has0GContracts && !hasArcIdentity && (
        <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
          Deploy AgentNFT to 0G Chain or register on Arc to activate
        </p>
      )}
    </div>
  );
}
