"use client";

import { useReadContract, useWriteContract, useAccount } from "wagmi";
import { parseUnits, type Address } from "viem";
import GroupTreasuryABI from "@/abi/GroupTreasury.json";

// Contract addresses from env
const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

// Minimal ERC20 ABI for approve
const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// --- Read Hooks ---

export function useTripData(tripId: bigint) {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: GroupTreasuryABI,
    functionName: "getTrip",
    args: [tripId],
  });
}

export function useTripBalance(tripId: bigint) {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: GroupTreasuryABI,
    functionName: "getBalance",
    args: [tripId],
  });
}

export function useTripMembers(tripId: bigint) {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: GroupTreasuryABI,
    functionName: "getMembers",
    args: [tripId],
  });
}

export function useTripSpends(tripId: bigint) {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: GroupTreasuryABI,
    functionName: "getSpends",
    args: [tripId],
  });
}

export function useMemberDeposit(tripId: bigint, member: Address) {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: GroupTreasuryABI,
    functionName: "getMemberDeposit",
    args: [tripId, member],
  });
}

export function useNextTripId() {
  return useReadContract({
    address: TREASURY_ADDRESS,
    abi: GroupTreasuryABI,
    functionName: "nextTripId",
  });
}

export function useUsdcBalance(address: Address | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useUsdcAllowance(owner: Address | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: owner ? [owner, TREASURY_ADDRESS] : undefined,
    query: { enabled: !!owner },
  });
}

// --- Write Hooks ---

export function useDeposit() {
  const { writeContractAsync, isPending, isSuccess, error } =
    useWriteContract();

  const approveUsdc = async (amount: string) => {
    const parsed = parseUnits(amount, 6); // USDC has 6 decimals
    return writeContractAsync({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [TREASURY_ADDRESS, parsed],
    });
  };

  const deposit = async (tripId: bigint, amount: string) => {
    const parsed = parseUnits(amount, 6);
    return writeContractAsync({
      address: TREASURY_ADDRESS,
      abi: GroupTreasuryABI,
      functionName: "deposit",
      args: [tripId, parsed],
    });
  };

  return { approveUsdc, deposit, isPending, isSuccess, error };
}

export function useCreateTripOnChain() {
  const { writeContractAsync, isPending, isSuccess, error } =
    useWriteContract();

  const createTrip = async (agentAddress: Address, spendLimit: string) => {
    const parsed = parseUnits(spendLimit, 6);
    return writeContractAsync({
      address: TREASURY_ADDRESS,
      abi: GroupTreasuryABI,
      functionName: "createTrip",
      args: [USDC_ADDRESS, agentAddress, parsed],
    });
  };

  return { createTrip, isPending, isSuccess, error };
}

export { TREASURY_ADDRESS, USDC_ADDRESS };
