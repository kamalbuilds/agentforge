"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConnectButton } from "@/components/connect-button";
import { Wallet, Gift, Plus, Dna, Cpu } from "lucide-react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { AgentINFTAbi, ArenaAbi, RoyaltyVaultAbi, addresses } from "@agentforge/shared";
import type { Abi } from "viem";
import { formatEther } from "viem";

const CHAIN_ID = 16601 as const;

interface OwnedAgent {
  tokenId: bigint;
  elo: number;
  wins: number;
  losses: number;
  generation: number;
}

function OwnedAgentCard({ agent }: { agent: OwnedAgent }) {
  const eloPercent = Math.min(100, Math.max(0, ((agent.elo - 800) / 2400) * 100));
  return (
    <Link href={`/agents/${agent.tokenId.toString()}`}>
      <div className="glass-card rounded-xl p-5 hover:-translate-y-[2px] transition-all duration-200 cursor-pointer">
        <div className="flex items-center gap-3 mb-4">
          <div className="hex-clip w-12 h-12 bg-gradient-to-br from-[#7c3aed]/30 to-[#dc2626]/30 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-[#7c3aed]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-[#ededed] font-mono text-sm">
                #{agent.tokenId.toString()}
              </p>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20">
                Gen {agent.generation}
              </span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[#ededed] font-bold font-mono">{agent.elo}</p>
            <p className="text-xs text-[#6b7280] font-mono">ELO</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${eloPercent}%`,
                background: "linear-gradient(90deg, #7c3aed, #dc2626)",
              }}
            />
          </div>
          <div className="flex gap-4 text-xs text-[#6b7280] font-mono">
            <span>W: <span className="text-[#10b981] font-bold">{agent.wins}</span></span>
            <span>L: <span className="text-[#dc2626] font-bold">{agent.losses}</span></span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function OwnedAgentsSection({ address }: { address: `0x${string}` }) {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !address) return;
    setLoading(true);
    publicClient
      .getLogs({
        address: addresses[CHAIN_ID].AgentINFT,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "tokenId", type: "uint256", indexed: true },
          ],
        } as const,
        args: { to: address },
        fromBlock: 0n,
        toBlock: "latest",
      })
      .then(async (logs) => {
        const candidateIds = logs
          .map((l) => (l.args as { tokenId?: bigint }).tokenId)
          .filter((id): id is bigint => id !== undefined);

        // Filter to currently owned (check ownerOf for each)
        const ownerResults = await Promise.all(
          candidateIds.map((id) =>
            publicClient.readContract({
              address: addresses[CHAIN_ID].AgentINFT,
              abi: AgentINFTAbi as Abi,
              functionName: "ownerOf",
              args: [id],
            }).catch(() => null)
          )
        );
        const owned = candidateIds.filter(
          (_, i) => ownerResults[i]?.toString().toLowerCase() === address.toLowerCase()
        );
        setTokenIds(owned);
        setLoading(false);
      })
      .catch((err) => {
        console.error("getLogs error:", err);
        setLoading(false);
      });
  }, [publicClient, address]);

  const eloContracts = tokenIds.map((id) => ({
    address: addresses[CHAIN_ID].Arena as `0x${string}`,
    abi: ArenaAbi as Abi,
    functionName: "getElo" as const,
    args: [id],
    chainId: CHAIN_ID,
  }));
  const winsContracts = tokenIds.map((id) => ({
    address: addresses[CHAIN_ID].Arena as `0x${string}`,
    abi: ArenaAbi as Abi,
    functionName: "wins" as const,
    args: [id],
    chainId: CHAIN_ID,
  }));
  const lossesContracts = tokenIds.map((id) => ({
    address: addresses[CHAIN_ID].Arena as `0x${string}`,
    abi: ArenaAbi as Abi,
    functionName: "losses" as const,
    args: [id],
    chainId: CHAIN_ID,
  }));
  const genContracts = tokenIds.map((id) => ({
    address: addresses[CHAIN_ID].AgentINFT as `0x${string}`,
    abi: AgentINFTAbi as Abi,
    functionName: "generation" as const,
    args: [id],
    chainId: CHAIN_ID,
  }));

  const { data: elosData } = useReadContracts({ contracts: eloContracts });
  const { data: winsData } = useReadContracts({ contracts: winsContracts });
  const { data: lossesData } = useReadContracts({ contracts: lossesContracts });
  const { data: gensData } = useReadContracts({ contracts: genContracts });

  const agents: OwnedAgent[] = tokenIds.map((id, i) => ({
    tokenId: id,
    elo: Number((elosData?.[i]?.result as bigint | undefined) ?? 1200n),
    wins: Number((winsData?.[i]?.result as bigint | undefined) ?? 0n),
    losses: Number((lossesData?.[i]?.result as bigint | undefined) ?? 0n),
    generation: Number((gensData?.[i]?.result as bigint | undefined) ?? 0n),
  }));

  return { agents, loading };
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [claimHash, setClaimHash] = useState<`0x${string}` | undefined>();

  const { data: pendingRoyaltiesRaw } = useReadContract({
    address: addresses[CHAIN_ID].RoyaltyVault,
    abi: RoyaltyVaultAbi as Abi,
    functionName: "pending",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  const { writeContractAsync, isPending: isClaimPending } = useWriteContract();
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({ hash: claimHash });

  const pendingRoyalties = pendingRoyaltiesRaw !== undefined
    ? formatEther(pendingRoyaltiesRaw as bigint)
    : "0";
  const hasPending = pendingRoyaltiesRaw !== undefined && (pendingRoyaltiesRaw as bigint) > 0n;

  const { agents, loading } = isConnected && address
    ? OwnedAgentsSection({ address })
    : { agents: [], loading: false };

  const handleClaimRoyalties = async () => {
    if (!address) return;
    try {
      const hash = await writeContractAsync({
        address: addresses[CHAIN_ID].RoyaltyVault,
        abi: RoyaltyVaultAbi as Abi,
        functionName: "claim",
        args: [address],
        chainId: CHAIN_ID,
      });
      setClaimHash(hash);
      toast.success("Royalty claim submitted!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claim failed");
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="glass-card rounded-2xl p-10 max-w-sm w-full text-center space-y-6">
          <Wallet className="w-10 h-10 text-[#7c3aed] mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#ededed]">Connect Wallet</h2>
            <p className="text-sm text-[#6b7280]">
              Connect to view your agents and claim royalties.
            </p>
          </div>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#7c3aed] font-mono text-xl animate-agent-pulse">◢◤</span>
            <span className="text-xl font-bold tracking-tight text-[#ededed]">AgentForge</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/agents" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Gallery</Link>
            <Link href="/arena" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Arena</Link>
            <Link href="/breed" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Breed</Link>
            <Link href="/mint" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Mint</Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <p className="text-xs font-mono text-[#10b981] uppercase tracking-widest">Profile</p>
            <h1 className="text-5xl font-black text-[#ededed] tracking-tight">My Agents</h1>
            <p className="text-[#6b7280] font-mono text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/mint">
              <Button className="bg-[#7c3aed] hover:bg-[#5b21b6] text-white rounded-xl font-semibold transition-all hover:-translate-y-[2px]">
                <Plus className="w-4 h-4 mr-2" />
                Mint Agent
              </Button>
            </Link>
            <Link href="/breed">
              <Button className="bg-white/[0.03] border border-white/[0.08] text-[#ededed] hover:bg-white/[0.06] rounded-xl font-semibold">
                <Dna className="w-4 h-4 mr-2" />
                Breed
              </Button>
            </Link>
          </div>
        </div>

        {/* Royalties Card — RoyaltyVault.pending(address) live read */}
        <div className="glass-card rounded-2xl p-8 border border-[#10b981]/20">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#10b981]" />
                <h2 className="text-lg font-bold text-[#ededed]">Breeding Royalties</h2>
              </div>
              <p className="text-5xl font-black text-[#10b981] font-mono">
                {parseFloat(pendingRoyalties).toFixed(4)}
                <span className="text-xl text-[#6b7280] ml-2">0G</span>
              </p>
              <p className="text-xs text-[#6b7280] font-mono">
                RoyaltyVault.pending({address?.slice(0, 6)}...{address?.slice(-4)}) · live read
              </p>
            </div>
            <Button
              onClick={handleClaimRoyalties}
              disabled={isClaimPending || isClaimConfirming || !hasPending}
              className="bg-[#10b981] hover:bg-[#059669] text-black font-bold rounded-xl px-8 py-3 transition-all hover:-translate-y-[2px] disabled:opacity-40"
            >
              {isClaimPending || isClaimConfirming ? "Claiming..." : "Claim Royalties"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="owned" className="w-full">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
            <TabsTrigger
              value="owned"
              className="rounded-lg text-sm data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white"
            >
              Owned ({agents.length})
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-lg text-sm data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white"
            >
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Owned Agents */}
          <TabsContent value="owned" className="mt-6">
            {loading ? (
              <div className="text-center py-16">
                <span className="text-[#7c3aed] text-3xl font-mono animate-agent-pulse block mb-3">◢◤</span>
                <p className="text-[#6b7280] font-mono text-sm">Scanning chain for your agents...</p>
              </div>
            ) : agents.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <OwnedAgentCard key={agent.tokenId.toString()} agent={agent} />
                ))}
              </div>
            ) : (
              <div className="text-center py-24 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto">
                  <Wallet className="w-7 h-7 text-[#6b7280]" />
                </div>
                <p className="text-[#ededed] font-bold">No agents yet</p>
                <p className="text-sm text-[#6b7280]">
                  Mint your first ERC-7857 iNFT agent to start competing.
                </p>
                <Link href="/mint">
                  <Button className="mt-2 bg-[#7c3aed] hover:bg-[#5b21b6] text-white rounded-xl font-semibold transition-all hover:-translate-y-[2px]">
                    Mint First Agent
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="mt-6">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { label: "Total Agents", value: agents.length.toString(), color: "#7c3aed" },
                {
                  label: "Total Battles",
                  value: agents.reduce((s, a) => s + a.wins + a.losses, 0).toString(),
                  color: "#dc2626",
                },
                {
                  label: "Avg Win Rate",
                  value:
                    agents.length > 0 && agents.reduce((s, a) => s + a.wins + a.losses, 0) > 0
                      ? `${((agents.reduce((s, a) => s + a.wins, 0) / agents.reduce((s, a) => s + a.wins + a.losses, 1)) * 100).toFixed(1)}%`
                      : "—",
                  color: "#10b981",
                },
              ].map((stat) => (
                <div key={stat.label} className="glass-card rounded-2xl p-6 space-y-2">
                  <p className="text-xs text-[#6b7280] font-mono uppercase tracking-wider">{stat.label}</p>
                  <p className="text-4xl font-black font-mono" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
