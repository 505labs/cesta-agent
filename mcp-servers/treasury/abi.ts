// Auto-generated from contracts/src/GroupTreasury.sol
// Re-export just the ABI array for viem
export const GROUP_TREASURY_ABI = [
  // --- Events ---
  {
    type: "event",
    name: "TripCreated",
    inputs: [
      { name: "tripId", type: "uint256", indexed: true },
      { name: "organizer", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: false },
      { name: "usdc", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MemberJoined",
    inputs: [
      { name: "tripId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FundsSpent",
    inputs: [
      { name: "tripId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "category", type: "string", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TripSettled",
    inputs: [
      { name: "tripId", type: "uint256", indexed: true },
      { name: "totalSpent", type: "uint256", indexed: false },
      { name: "totalReturned", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmergencyWithdraw",
    inputs: [
      { name: "tripId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  // --- State variables ---
  {
    type: "function",
    name: "nextTripId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // --- Write functions ---
  {
    type: "function",
    name: "createTrip",
    inputs: [
      { name: "_usdc", type: "address" },
      { name: "_agent", type: "address" },
      { name: "_spendLimit", type: "uint256" },
    ],
    outputs: [{ name: "tripId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "spend",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_recipient", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_category", type: "string" },
      { name: "_description", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "emergencyWithdraw",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // --- View functions ---
  {
    type: "function",
    name: "getTrip",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "organizer", type: "address" },
          { name: "agent", type: "address" },
          { name: "usdc", type: "address" },
          { name: "spendLimit", type: "uint256" },
          { name: "totalDeposited", type: "uint256" },
          { name: "totalSpent", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "memberCount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMembers",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSpends",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "category", type: "string" },
          { name: "description", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBalance",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMemberDeposit",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_member", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // --- Mappings (auto-generated getters) ---
  {
    type: "function",
    name: "trips",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "organizer", type: "address" },
      { name: "agent", type: "address" },
      { name: "usdc", type: "address" },
      { name: "spendLimit", type: "uint256" },
      { name: "totalDeposited", type: "uint256" },
      { name: "totalSpent", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "memberCount", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposits",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "members",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "spends",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "category", type: "string" },
      { name: "description", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isMember",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },

  // --- Enhanced Treasury: Events ---
  {
    type: "event",
    name: "CategoryBudgetSet",
    inputs: [
      { name: "tripId", type: "uint256", indexed: true },
      { name: "category", type: "string", indexed: false },
      { name: "budget", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "NanopaymentProcessed",
    inputs: [
      { name: "tripId", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "category", type: "string", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteRequested",
    inputs: [
      { name: "voteId", type: "uint256", indexed: true },
      { name: "tripId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "voteId", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteExecuted",
    inputs: [
      { name: "voteId", type: "uint256", indexed: true },
      { name: "tripId", type: "uint256", indexed: true },
    ],
  },

  // --- Enhanced Treasury: Write functions ---
  {
    type: "function",
    name: "setDailyCap",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_dailyCap", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setCategoryBudget",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_category", type: "string" },
      { name: "_budget", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "nanopayment",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_recipient", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_category", type: "string" },
      { name: "_description", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requestVote",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_recipient", type: "address" },
      { name: "_amount", type: "uint256" },
      { name: "_category", type: "string" },
      { name: "_description", type: "string" },
      { name: "_threshold", type: "uint256" },
    ],
    outputs: [{ name: "voteId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "castVote",
    inputs: [{ name: "_voteId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeVote",
    inputs: [{ name: "_voteId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // --- Enhanced Treasury: View functions ---
  {
    type: "function",
    name: "getCategoryBudget",
    inputs: [
      { name: "_tripId", type: "uint256" },
      { name: "_category", type: "string" },
    ],
    outputs: [
      { name: "budget", type: "uint256" },
      { name: "spent", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDailySpending",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getNanopaymentTotal",
    inputs: [{ name: "_tripId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVoteRequest",
    inputs: [{ name: "_voteId", type: "uint256" }],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
      { name: "", type: "uint256" },
      { name: "", type: "string" },
      { name: "", type: "string" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;
