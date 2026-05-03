import type { Address, Hex } from "viem";

export type AgentLifecycleState =
  | "minted"
  | "training"
  | "breeding_locked"
  | "arena_locked"
  | "retired";

export type Agent = {
  tokenId: bigint;
  owner: Address;
  name: string;
  ensName?: string;
  genomeRoot: Hex;
  storageUri: string;
  lifecycleState: AgentLifecycleState;
  generation: number;
  createdAt: string;
  updatedAt: string;
};

export type MatchStatus =
  | "queued"
  | "committed"
  | "challenge_window"
  | "settled"
  | "disputed";

export type Match = {
  matchId: Hex;
  arenaId: Hex;
  agentA: bigint;
  agentB: bigint;
  stakeToken: Address;
  stakeAmount: bigint;
  transcriptRoot?: Hex;
  resultRoot?: Hex;
  winner?: bigint;
  status: MatchStatus;
  queuedAt: string;
  settledAt?: string;
};

export type BreedingRequestStatus =
  | "requested"
  | "computing"
  | "ready"
  | "finalized"
  | "cancelled";

export type BreedingRequest = {
  requestId: Hex;
  requester: Address;
  parentA: bigint;
  parentB: bigint;
  parentGenomeRoots: readonly [Hex, Hex];
  childGenomeRoot?: Hex;
  feeToken: Address;
  feeAmount: bigint;
  status: BreedingRequestStatus;
  requestedAt: string;
  finalizedAt?: string;
};
