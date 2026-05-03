"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Nav } from "@/components/nav";
import { Wallet, Gift, Plus, Dna, Cpu, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { AgentINFTAbi, ArenaAbi, RoyaltyVaultAbi, addresses } from "@agentforge/shared";
import type { Abi } from "viem";
import { formatEther } from "viem";

const CHAIN_ID = 16602 as const;

interface OwnedAgent { tokenId: bigint; elo: number; wins: number; losses: number; generation: number; }

function getRarity(elo: number) {
  if (elo >= 1800) return { label: "legendary", color: "#fbbf24" };
  if (elo >= 1500) return { label: "epic",      color: "#a855f7" };
  if (elo >= 1200) return { label: "rare",      color: "#3b82f6" };
  return                 { label: "common",    color: "#9ca3af" };
}

function MiniAgentCard({ agent }: { agent: OwnedAgent }) {
  const rarity = getRarity(agent.elo);
  const eloPercent = Math.min(100, Math.max(0, ((agent.elo - 800) / 2400) * 100));

  return (
    <Link href={`/agents/${agent.tokenId.toString()}`}>
      <div
        className="glass-card rounded-xl p-4 cursor-pointer card-hover flex flex-col gap-3"
        style={{ borderColor: `${rarity.color}25` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="agent-avatar shrink-0"
            style={{ borderColor: `${rarity.color}40` }}
          >
            <Cpu className="w-5 h-5 relative z-10" style={{ color: rarity.color, opacity: 0.8 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-semibold text-[#ededed] text-sm"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              #{agent.tokenId.toString()}
            </p>
            <span
              className="text-[9px] font-mono"
              style={{ color: rarity.color, letterSpacing: "0.06em" }}
            >
              {rarity.label.toUpperCase()} · GEN {agent.generation}
            </span>
          </div>
          <div className="text-right">
            <p
              className="text-sm font-bold tabular"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: rarity.color }}
            >
              {agent.elo}
            </p>
            <p className="text-[9px] font-mono text-[#6b7280] uppercase tracking-wider">ELO</p>
          </div>
        </div>

        <div className="h-[2px] rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${eloPercent}%`, background: rarity.color }}
          />
        </div>

        <div className="flex gap-4 text-xs font-mono">
          <span>
            <span className="text-[#6b7280]">W </span>
            <span style={{ color: "#10b981", fontFamily: "var(--font-space-mono), monospace" }}>{agent.wins}</span>
          </span>
          <span>
            <span className="text-[#6b7280]">L </span>
            <span style={{ color: "#ef4444", fontFamily: "var(--font-space-mono), monospace" }}>{agent.losses}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function useOwnedAgents(address: `0x${string}`) {
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
        const ownerResults = await Promise.all(
          candidateIds.map((id) =>
            publicClient.readContract({ address: addresses[CHAIN_ID].AgentINFT, abi: AgentINFTAbi as Abi, functionName: "ownerOf", args: [id] }).catch(() => null)
          )
        );
        const owned = candidateIds.filter((_, i) => ownerResults[i]?.toString().toLowerCase() === address.toLowerCase());
        setTokenIds(owned);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [publicClient, address]);

  const eloContracts    = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].Arena      as `0x${string}`, abi: ArenaAbi     as Abi, functionName: "getElo"    as const, args: [id], chainId: CHAIN_ID }));
  const winsContracts   = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].Arena      as `0x${string}`, abi: ArenaAbi     as Abi, functionName: "wins"      as const, args: [id], chainId: CHAIN_ID }));
  const lossesContracts = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].Arena      as `0x${string}`, abi: ArenaAbi     as Abi, functionName: "losses"    as const, args: [id], chainId: CHAIN_ID }));
  const genContracts    = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].AgentINFT  as `0x${string}`, abi: AgentINFTAbi as Abi, functionName: "generation" as const, args: [id], chainId: CHAIN_ID }));

  const { data: elosData    } = useReadContracts({ contracts: eloContracts    });
  const { data: winsData    } = useReadContracts({ contracts: winsContracts   });
  const { data: lossesData  } = useReadContracts({ contracts: lossesContracts });
  const { data: gensData    } = useReadContracts({ contracts: genContracts    });

  const agents: OwnedAgent[] = tokenIds.map((id, i) => ({
    tokenId:    id,
    elo:        Number((elosData?.[i]?.result    as bigint | undefined) ?? 1200n),
    wins:       Number((winsData?.[i]?.result    as bigint | undefined) ?? 0n),
    losses:     Number((lossesData?.[i]?.result  as bigint | undefined) ?? 0n),
    generation: Number((gensData?.[i]?.result    as bigint | undefined) ?? 0n),
  }));

  return { agents, loading };
}

// ─── Not-connected state ──────────────────────────────────────────────────────
function NotConnected() {
  return (
    <div className="min-h-screen bg-[#0a0a14]">
      <Nav />
      <div className="flex items-center justify-center px-6" style={{ minHeight: "calc(100vh - 73px)" }}>
        <div
          className="glass-card hud-corners rounded-2xl p-10 max-w-xs w-full text-center space-y-6"
          style={{ borderColor: "rgba(124,58,237,0.2)" }}
        >
          <div
            className="w-14 h-14 rounded-xl mx-auto flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}
          >
            <Wallet className="w-6 h-6" style={{ color: "#7c3aed" }} />
          </div>
          <div className="space-y-1">
            <h2
              className="text-lg font-semibold text-[#ededed]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Connect Wallet
            </h2>
            <p className="text-sm text-white/35">
              Connect to view your agents and claim royalties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
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

  const pendingRoyalties = pendingRoyaltiesRaw !== undefined ? formatEther(pendingRoyaltiesRaw as bigint) : "0";
  const hasPending = pendingRoyaltiesRaw !== undefined && (pendingRoyaltiesRaw as bigint) > 0n;

  const { agents, loading } = isConnected && address ? useOwnedAgents(address) : { agents: [], loading: false };

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

  if (!isConnected) return <NotConnected />;

  const totalBattles = agents.reduce((s, a) => s + a.wins + a.losses, 0);
  const totalWins    = agents.reduce((s, a) => s + a.wins, 0);
  const avgWinRate   = totalBattles > 0 ? ((totalWins / totalBattles) * 100).toFixed(1) : null;
  const highestElo   = agents.length > 0 ? Math.max(...agents.map((a) => a.elo)) : null;

  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 50% 30% at 50% 0%, rgba(16,185,129,0.04) 0%, transparent 55%)" }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: "url('/profile/royalty-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.05, mixBlendMode: "overlay" }}
      />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16 pb-32 space-y-10">

        {/* ── Identity bar ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#10b981]">Profile</p>
            <h1
              className="text-5xl font-semibold text-[#ededed]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.02em" }}
            >
              My Agents
            </h1>
            <p
              className="text-xs font-mono mt-1"
              style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-space-mono), monospace" }}
            >
              {address?.slice(0, 8)}...{address?.slice(-6)}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/mint">
              <Button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#7c3aed", fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Mint
              </Button>
            </Link>
            <Link href="/breed">
              <Button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#ededed",
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                }}
              >
                <Dna className="w-3.5 h-3.5" />
                Breed
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Royalties card ── */}
        <div
          className="glass-card rounded-2xl p-6 md:p-8"
          style={{ borderColor: hasPending ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4" style={{ color: "#10b981" }} />
                <span
                  className="text-sm font-semibold text-[#ededed]"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  Breeding Royalties
                </span>
              </div>
              <p
                className="text-4xl font-bold tabular"
                style={{
                  fontFamily: "var(--font-space-mono), monospace",
                  color: hasPending ? "#10b981" : "rgba(255,255,255,0.25)",
                }}
              >
                {parseFloat(pendingRoyalties).toFixed(4)}
                <span className="text-lg ml-2 font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                  0G
                </span>
              </p>
              <p
                className="text-[10px] font-mono"
                style={{ color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-space-mono), monospace" }}
              >
                RoyaltyVault.pending({address?.slice(0, 6)}...{address?.slice(-4)})
              </p>
            </div>
            <Button
              onClick={handleClaimRoyalties}
              disabled={isClaimPending || isClaimConfirming || !hasPending}
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-[1px] disabled:opacity-30"
              style={{
                background: "#10b981",
                color: "#000",
                fontFamily: "var(--font-space-grotesk), sans-serif",
              }}
            >
              {isClaimPending || isClaimConfirming ? "Claiming..." : "Claim Royalties"}
            </Button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="owned" className="w-full">
          <TabsList
            className="p-1 rounded-xl w-fit mb-6"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <TabsTrigger
              value="owned"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#ededed] data-[state=inactive]:text-white/40"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Owned ({agents.length})
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#ededed] data-[state=inactive]:text-white/40"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="owned">
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass-card rounded-xl p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="skeleton w-12 h-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-20 rounded" />
                        <div className="skeleton h-3 w-14 rounded" />
                      </div>
                    </div>
                    <div className="skeleton h-1 rounded-full" />
                  </div>
                ))}
              </div>
            ) : agents.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agents.map((agent) => (
                  <MiniAgentCard key={agent.tokenId.toString()} agent={agent} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 space-y-4">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <Wallet className="w-7 h-7 text-[#6b7280]" />
                </div>
                <p
                  className="text-[#ededed] font-semibold"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  No agents yet
                </p>
                <p className="text-sm text-white/30 max-w-xs mx-auto">
                  Mint your first ERC-7857 iNFT agent to start competing in the arena.
                </p>
                <Link href="/mint">
                  <Button
                    className="mt-1 px-5 py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "#7c3aed", fontFamily: "var(--font-space-grotesk), sans-serif" }}
                  >
                    Mint First Agent
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { label: "Agents Owned",   value: agents.length.toString(),     color: "#7c3aed"  },
                { label: "Total Battles",  value: totalBattles.toString(),      color: "#dc2626"  },
                { label: "Avg Win Rate",   value: avgWinRate ? `${avgWinRate}%` : "—", color: "#10b981" },
                { label: "Highest ELO",    value: highestElo?.toString() ?? "—", color: "#fbbf24" },
              ].map((stat) => (
                <div key={stat.label} className="glass-card rounded-xl p-5 space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#6b7280]">{stat.label}</p>
                  <p
                    className="text-3xl font-bold tabular"
                    style={{ fontFamily: "var(--font-space-mono), monospace", color: stat.color }}
                  >
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
