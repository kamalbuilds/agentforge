import type { Address } from "viem";
import { agentForgeAddresses } from "@agentforge/shared";

// ABI stubs - in production these would be imported from contract artifacts
// For now we define minimal ABIs for reading agent data
export const AGENT_NFT_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

export const ARENA_HUB_ABI = [
  {
    type: "function",
    name: "matchCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const BREEDING_HUB_ABI = [
  {
    type: "function",
    name: "requestBreed",
    inputs: [
      { name: "parentA", type: "uint256" },
      { name: "parentB", type: "uint256" },
      { name: "royaltyBps", type: "uint16" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
  },
] as const;

export interface ContractConfig {
  address: Address | undefined;
  abi: readonly unknown[];
  chainId: number;
}

export const getContractConfig = (
  contractName: string,
  chainId: number
): ContractConfig | null => {
  const addresses =
    agentForgeAddresses[chainId as keyof typeof agentForgeAddresses];
  if (!addresses) return null;

  const address =
    addresses[contractName as keyof typeof addresses] as Address | undefined;

  let abi: readonly unknown[] = [];
  switch (contractName) {
    case "agentNft":
      abi = AGENT_NFT_ABI;
      break;
    case "arenaHub":
      abi = ARENA_HUB_ABI;
      break;
    case "breedingHub":
      abi = BREEDING_HUB_ABI;
      break;
  }

  return { address, abi, chainId };
};
