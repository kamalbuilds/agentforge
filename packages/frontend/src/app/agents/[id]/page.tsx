"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { LineageTree } from "@/components/lineage-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, Dna, ArrowLeft, Cpu, ExternalLink } from "lucide-react";
import { useReadContract, usePublicClient, useWriteContract, useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { AgentINFTAbi, ArenaAbi, addresses } from "@agentforge/shared";
import { toast } from "sonner";
import type { Abi } from "viem";

const CHAIN_ID = 16602 as const;

const BLOCK_PAGE = 1000n;

const MATCH_SETTLED_EVENT = {
  type: "event" as const,
  name: "MatchSettled",
  inputs: [
    { name: "matchId",      type: "uint256" as const, indexed: true },
    { name: "winner",       type: "uint256" as const, indexed: true },
    { name: "loser",        type: "uint256" as const, indexed: true },
    { name: "winnerNewElo", type: "uint32"  as const, indexed: false },
    { name: "loserNewElo",  type: "uint32"  as const, indexed: false },
    { name: "payout",       type: "uint256" as const, indexed: false },
    { name: "resultHash",   type: "bytes32" as const, indexed: false },
  ],
} as const;

interface MatchRecord {
  matchId: bigint;
  opponent: bigint;
  result: "win" | "loss";
  newElo: number;
  blockNumber: bigint;
}

function useMatchHistory(tokenId: bigint) {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicClient) return;
    setLoading(true);
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const results: MatchRecord[] = [];
        let toBlock = latest;
        while (toBlock > 0n && results.length < 50) {
          const fromBlock = toBlock > BLOCK_PAGE ? toBlock - BLOCK_PAGE : 0n;
          const [wLogs, lLogs] = await Promise.all([
            publicClient.getLogs({ address: addresses[CHAIN_ID].Arena, event: MATCH_SETTLED_EVENT, args: { winner: tokenId }, fromBlock, toBlock }),
            publicClient.getLogs({ address: addresses[CHAIN_ID].Arena, event: MATCH_SETTLED_EVENT, args: { loser: tokenId }, fromBlock, toBlock }),
          ]);
          for (const log of wLogs) {
            const a = log.args as { matchId: bigint; winner: bigint; loser: bigint; winnerNewElo: number };
            results.push({ matchId: a.matchId, opponent: a.loser, result: "win", newElo: Number(a.winnerNewElo), blockNumber: log.blockNumber ?? 0n });
          }
          for (const log of lLogs) {
            const a = log.args as { matchId: bigint; winner: bigint; loser: bigint; loserNewElo: number };
            results.push({ matchId: a.matchId, opponent: a.winner, result: "loss", newElo: Number(a.loserNewElo), blockNumber: log.blockNumber ?? 0n });
          }
          if (fromBlock === 0n) break;
          toBlock = fromBlock - 1n;
        }
        results.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
        setMatches(results);
      } catch { /* RPC error */ } finally { setLoading(false); }
    })();
  }, [publicClient, tokenId]);

  return { matches, loading };
}

function ChallengeDialog({ myAgentId, open, onOpenChange }: { myAgentId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [stakeEth, setStakeEth]   = useState("0.01");
  const [isLoading, setIsLoading] = useState(false);

  const handlePropose = async () => {
    if (!address)      { toast.error("Connect wallet first"); return; }
    if (!publicClient) { toast.error("No RPC client"); return; }
    const stakeWei = parseEther(stakeEth || "0.01");
    setIsLoading(true);
    try {
      const hash = await writeContractAsync({
        address: addresses[CHAIN_ID].Arena,
        abi: ArenaAbi as Abi,
        functionName: "proposeMatch",
        args: [BigInt(address), BigInt(myAgentId), stakeWei],
        value: stakeWei,
        chainId: CHAIN_ID,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success("Challenge proposed! Waiting for acceptance.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Propose failed");
    } finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d0d1a] border border-white/[0.08] text-[#ededed] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[#ededed]" style={{ fontFamily: "var(--font-space-grotesk)" }}>Challenge Agent #{myAgentId}</DialogTitle>
          <DialogDescription className="text-white/40 text-xs">Enter a stake amount. The opponent must match your stake to accept.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">Your Agent ID</Label>
            <p className="text-sm text-[#ededed] font-mono">You need to own an agent to challenge. Enter your token ID.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">Stake (0G)</Label>
            <Input placeholder="0.01" value={stakeEth} onChange={(e) => setStakeEth(e.target.value)} className="bg-white/[0.03] border-white/[0.08] focus:border-[#dc2626]/50 text-[#ededed] rounded-xl" />
            <p className="text-xs text-white/25 font-mono">
              {stakeEth && !isNaN(Number(stakeEth)) ? `${formatEther(parseEther(stakeEth))} 0G will be locked` : "Enter a valid amount"}
            </p>
          </div>
          <Link href={`/arena`}>
            <Button className="w-full font-semibold py-3 rounded-xl text-white" style={{ background: "#dc2626" }}>
              Go to Arena to Challenge
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getRarity(elo: number) {
  if (elo >= 1800) return { label: "legendary", color: "#fbbf24" };
  if (elo >= 1500) return { label: "epic",      color: "#a855f7" };
  if (elo >= 1200) return { label: "rare",      color: "#3b82f6" };
  return                 { label: "common",    color: "#9ca3af" };
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tokenId = BigInt(id);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const { matches: matchHistory, loading: matchLoading } = useMatchHistory(tokenId);

  const { data: owner, isLoading: ownerLoading } = useReadContract({ address: addresses[CHAIN_ID].AgentINFT, abi: AgentINFTAbi as Abi, functionName: "ownerOf",      args: [tokenId], chainId: CHAIN_ID });
  const { data: elo }        = useReadContract({ address: addresses[CHAIN_ID].Arena,     abi: ArenaAbi      as Abi, functionName: "getElo",     args: [tokenId], chainId: CHAIN_ID });
  const { data: wins }       = useReadContract({ address: addresses[CHAIN_ID].Arena,     abi: ArenaAbi      as Abi, functionName: "wins",       args: [tokenId], chainId: CHAIN_ID });
  const { data: losses }     = useReadContract({ address: addresses[CHAIN_ID].Arena,     abi: ArenaAbi      as Abi, functionName: "losses",     args: [tokenId], chainId: CHAIN_ID });
  const { data: generation } = useReadContract({ address: addresses[CHAIN_ID].AgentINFT, abi: AgentINFTAbi  as Abi, functionName: "generation", args: [tokenId], chainId: CHAIN_ID });
  const { data: tokenData }  = useReadContract({ address: addresses[CHAIN_ID].AgentINFT, abi: AgentINFTAbi  as Abi, functionName: "getTokenData", args: [tokenId], chainId: CHAIN_ID });
  const { data: lineageData } = useReadContract({ address: addresses[CHAIN_ID].AgentINFT, abi: AgentINFTAbi as Abi, functionName: "lineage",    args: [tokenId], chainId: CHAIN_ID });

  const eloVal   = elo        !== undefined ? Number(elo as bigint)        : 1200;
  const winsVal  = wins       !== undefined ? Number(wins as bigint)       : 0;
  const lossVal  = losses     !== undefined ? Number(losses as bigint)     : 0;
  const genVal   = generation !== undefined ? Number(generation as bigint) : 0;
  const ownerAddr = (owner as string | undefined) ?? "";
  const td       = tokenData as { parentA: bigint; parentB: bigint } | undefined;
  const ancestors = (lineageData as bigint[] | undefined) ?? [];

  const winRate  = winsVal + lossVal > 0 ? ((winsVal / (winsVal + lossVal)) * 100).toFixed(1) : null;
  const rarity   = getRarity(eloVal);
  const eloPercent = Math.min(100, Math.max(0, ((eloVal - 800) / 2400) * 100));

  if (ownerLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a14]">
        <Nav />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 73px)" }}>
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-xl mx-auto animate-agent-pulse" style={{ background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Cpu className="w-6 h-6" style={{ color: "#7c3aed" }} />
            </div>
            <p className="text-[#6b7280] font-mono text-xs">Loading agent #{id}...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 60% 35% at 50% 8%, rgba(124,58,237,0.07) 0%, transparent 55%)" }}
      />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-10 pb-32 space-y-10">

        {/* Back link */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Gallery
        </Link>

        {/* ── Hero dossier panel ─────────────────────────────────────────────── */}
        <div
          className="glass-card hud-corners rounded-2xl overflow-hidden"
          style={{ borderColor: `${rarity.color}25` }}
        >
          {/* Rarity accent bar top */}
          <div className="h-[2px] w-full" style={{ background: rarity.color, opacity: 0.5 }} />

          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-8">

              {/* Left: large avatar portrait */}
              <div className="shrink-0">
                <div
                  className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(10,10,20,0.9) 100%)`,
                    border: `1.5px solid ${rarity.color}40`,
                  }}
                >
                  <Cpu
                    className="w-12 h-12 md:w-16 md:h-16 relative z-10"
                    style={{ color: rarity.color, opacity: 0.7 }}
                  />
                  {/* Glow */}
                  <div
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: `radial-gradient(circle at 50% 50%, ${rarity.color}18 0%, transparent 60%)` }}
                  />
                </div>

                {/* Rarity badge below avatar */}
                <div className="mt-3 text-center">
                  <span
                    className="status-pill"
                    style={{
                      background: `${rarity.color}15`,
                      color: rarity.color,
                      border: `1px solid ${rarity.color}30`,
                    }}
                  >
                    {rarity.label}
                  </span>
                </div>
              </div>

              {/* Right: identity + stats */}
              <div className="flex-1 space-y-5">
                {/* Name row */}
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h1
                      className="text-4xl font-semibold text-[#ededed] mb-1"
                      style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.02em" }}
                    >
                      Agent <span style={{ color: rarity.color }}>#{id}</span>
                    </h1>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className="text-xs font-mono"
                        style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-space-mono), monospace" }}
                      >
                        GEN {genVal}
                      </span>
                      {ownerAddr && (
                        <a
                          href={`https://chainscan-galileo.0g.ai/address/${ownerAddr}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-mono hover:text-white/50 transition-colors"
                          style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-space-mono), monospace" }}
                        >
                          {ownerAddr.slice(0, 8)}...{ownerAddr.slice(-6)}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="flex gap-2">
                    <Link href={`/breed?parentB=${id}`}>
                      <Button
                        className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: "rgba(16,185,129,0.1)",
                          border: "1px solid rgba(16,185,129,0.25)",
                          color: "#10b981",
                          fontFamily: "var(--font-space-grotesk), sans-serif",
                        }}
                      >
                        <Dna className="w-3.5 h-3.5 mr-1.5" />
                        Breed
                      </Button>
                    </Link>
                    <Button
                      onClick={() => setChallengeOpen(true)}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-[1px]"
                      style={{
                        background: "#dc2626",
                        fontFamily: "var(--font-space-grotesk), sans-serif",
                      }}
                    >
                      <Swords className="w-3.5 h-3.5 mr-1.5" />
                      Challenge
                    </Button>
                  </div>
                </div>

                {/* Stat grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "ELO Rating",  value: eloVal.toString(), color: rarity.color },
                    { label: "Win Rate",    value: winRate ? `${winRate}%` : "—", color: "#10b981" },
                    { label: "Wins",        value: winsVal.toString(),  color: "#10b981" },
                    { label: "Losses",      value: lossVal.toString(),  color: "#ef4444" },
                  ].map((s) => (
                    <div key={s.label} className="space-y-1">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#6b7280]">{s.label}</p>
                      <p
                        className="text-2xl font-bold tabular"
                        style={{ fontFamily: "var(--font-space-mono), monospace", color: s.color }}
                      >
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ELO progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-[#6b7280]">
                    <span>ELO Progress</span>
                    <span style={{ fontFamily: "var(--font-space-mono), monospace" }}>{eloVal} / 3200</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${eloPercent}%`, background: rarity.color }}
                    />
                  </div>
                </div>

                {/* Parent links */}
                {td && (td.parentA > 0n || td.parentB > 0n) && (
                  <div className="pt-3 border-t border-white/[0.05] flex flex-wrap gap-4 text-xs font-mono">
                    {td.parentA > 0n && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>Parent A: </span>
                        <Link href={`/agents/${td.parentA.toString()}`} className="text-[#7c3aed] hover:underline">
                          #{td.parentA.toString()}
                        </Link>
                      </div>
                    )}
                    {td.parentB > 0n && (
                      <div>
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>Parent B: </span>
                        <Link href={`/agents/${td.parentB.toString()}`} className="text-[#7c3aed] hover:underline">
                          #{td.parentB.toString()}
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Lineage ───────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2
            className="text-xl font-semibold text-[#ededed]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.01em" }}
          >
            Lineage
          </h2>
          {ancestors.length > 0 || (td && (td.parentA > 0n || td.parentB > 0n)) ? (
            <LineageTree
              root={{
                tokenId: Number(id),
                name: `Agent #${id}`,
                generation: genVal,
                parentA: td?.parentA && td.parentA > 0n
                  ? { tokenId: Number(td.parentA), name: `Agent #${td.parentA}`, generation: Math.max(0, genVal - 1) }
                  : undefined,
                parentB: td?.parentB && td.parentB > 0n
                  ? { tokenId: Number(td.parentB), name: `Agent #${td.parentB}`, generation: Math.max(0, genVal - 1) }
                  : undefined,
              }}
            />
          ) : (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-white/30 text-sm font-mono">
                {td && td.parentA === 0n && td.parentB === 0n
                  ? "Genesis agent — no parents on-chain."
                  : "Loading lineage from chain..."}
              </p>
            </div>
          )}
        </section>

        {/* ── Match history ─────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2
            className="text-xl font-semibold text-[#ededed]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.01em" }}
          >
            Match History
          </h2>
          <div className="glass-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.05] hover:bg-white/[0.01]">
                  {["Match", "Opponent", "Result", "New ELO", "Block"].map((h) => (
                    <TableHead
                      key={h}
                      className="text-[10px] font-mono uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchLoading ? (
                  <TableRow className="border-white/[0.05]">
                    <TableCell colSpan={5} className="text-center py-10">
                      <p className="text-white/25 text-sm font-mono">Loading match history...</p>
                    </TableCell>
                  </TableRow>
                ) : matchHistory.length === 0 ? (
                  <TableRow className="border-white/[0.05]">
                    <TableCell colSpan={5} className="text-center py-12">
                      <p className="text-white/25 text-sm font-mono">No matches played yet.</p>
                    </TableCell>
                  </TableRow>
                ) : matchHistory.map((m) => (
                  <TableRow key={m.matchId.toString()} className="border-white/[0.05] hover:bg-white/[0.02]">
                    <TableCell className="font-mono text-sm text-[#ededed]">#{m.matchId.toString()}</TableCell>
                    <TableCell className="font-mono text-sm text-[#ededed]">
                      <Link href={`/agents/${m.opponent.toString()}`} className="text-[#7c3aed] hover:underline">#{m.opponent.toString()}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm" style={{ color: m.result === "win" ? "#10b981" : "#ef4444" }}>
                      {m.result.toUpperCase()}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-[#ededed]">{m.newElo}</TableCell>
                    <TableCell className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{m.blockNumber.toString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>

      <ChallengeDialog myAgentId={id} open={challengeOpen} onOpenChange={setChallengeOpen} />
    </div>
  );
}
