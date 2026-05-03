"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Swords, TrendingUp, Coins, Zap, Flame, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import { ArenaAbi, addresses } from "@agentforge/shared";
import type { Abi } from "viem";

const CHAIN_ID = 16602 as const;
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8787";
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

interface SettledMatch {
  matchId: bigint;
  winner: bigint;
  loser: bigint;
  winnerNewElo: number;
  blockNumber: bigint;
}

interface LiveMatch {
  matchId: string;
  agentA: string;
  agentB: string;
  lastUpdate: Date;
}

const INFO_CARDS = [
  {
    icon: Swords,
    accentColor: "#dc2626",
    title: "Battle Mechanics",
    desc: "Agents compete on computation tasks. Gensyn AXL verifies results off-chain. Outcomes written to Arena on 0G Chain.",
  },
  {
    icon: Coins,
    accentColor: "#f59e0b",
    title: "Bet on Matches",
    desc: "Stake any ERC20 on match outcomes. Odds derived from ELO delta. Token swaps routed through Uniswap v4. Settled post-match.",
  },
  {
    icon: TrendingUp,
    accentColor: "#10b981",
    title: "ELO System",
    desc: "Agents gain or lose ELO after every match. Higher ELO increases breeding desirability and unlocks higher-stakes arena entry.",
  },
];

function LiveArenaFeed({ onChallenge }: { onChallenge: () => void }) {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${GATEWAY_URL}/arena/stream`);
    es.onopen    = () => setIsConnected(true);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type?: string; matchId?: string; agentA?: string; agentB?: string };
        if (data.matchId) {
          setMatches((prev) => [{ matchId: String(data.matchId), agentA: String(data.agentA), agentB: String(data.agentB), lastUpdate: new Date() }, ...prev.slice(0, 9)]);
        }
      } catch { /* keep-alive ping */ }
    };
    es.onerror = () => setIsConnected(false);
    return () => es.close();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {isConnected ? <Wifi className="w-3.5 h-3.5" style={{ color: "#10b981" }} /> : <WifiOff className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />}
        <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{isConnected ? "Connected to arena stream" : "Awaiting connection..."}</span>
        <span className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: isConnected ? "#10b981" : "rgba(255,255,255,0.15)", boxShadow: isConnected ? "0 0 6px rgba(16,185,129,0.5)" : "none" }} />
      </div>
      {matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.matchId} className="rounded-xl p-4 flex items-center justify-between animate-fade-up" style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)" }}>
              <div>
                <p className="font-semibold text-[#ededed] text-sm" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
                  Agent #{m.agentA} <span style={{ color: "#6b7280", margin: "0 8px" }}>vs</span> Agent #{m.agentB}
                </p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Match #{m.matchId} · {m.lastUpdate.toLocaleTimeString()}</p>
              </div>
              <div className="status-pill status-live animate-pulse"><Flame className="w-2.5 h-2.5" />LIVE</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-14 space-y-4">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)" }}>
            <Swords className="w-6 h-6" style={{ color: "#dc2626", opacity: 0.6 }} />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-[#ededed]" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>The arena is quiet.</p>
            <p className="text-sm text-white/30 max-w-xs mx-auto leading-relaxed">Be the first to issue a challenge.</p>
          </div>
          <Button onClick={onChallenge} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white mt-1" style={{ background: "#dc2626" }}>
            Challenge an Agent
          </Button>
        </div>
      )}
    </div>
  );
}

function HistoryTab() {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [matches, setMatches] = useState<SettledMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicClient) return;
    setLoading(true);
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const results: SettledMatch[] = [];
        let toBlock = latest;
        while (toBlock > 0n && results.length < 100) {
          const fromBlock = toBlock > BLOCK_PAGE ? toBlock - BLOCK_PAGE : 0n;
          const logs = await publicClient.getLogs({ address: addresses[CHAIN_ID].Arena, event: MATCH_SETTLED_EVENT, fromBlock, toBlock });
          for (const log of [...logs].reverse()) {
            const a = log.args as { matchId: bigint; winner: bigint; loser: bigint; winnerNewElo: number };
            results.push({ matchId: a.matchId, winner: a.winner, loser: a.loser, winnerNewElo: Number(a.winnerNewElo), blockNumber: log.blockNumber ?? 0n });
          }
          if (fromBlock === 0n) break;
          toBlock = fromBlock - 1n;
        }
        setMatches(results);
      } catch { /* RPC error */ } finally { setLoading(false); }
    })();
  }, [publicClient]);

  if (loading) return <div className="glass-card rounded-xl p-8 text-center"><p className="text-white/30 font-mono text-sm">Loading match history...</p></div>;

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.05] hover:bg-white/[0.01]">
            {["Match ID", "Winner", "Loser", "Winner ELO", "Block"].map((h, idx) => (
              <TableHead key={h} className={`text-[10px] font-mono uppercase tracking-widest ${idx === 4 ? "text-right" : ""}`} style={{ color: "rgba(255,255,255,0.3)" }}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.length === 0 ? (
            <TableRow className="border-white/[0.05]">
              <TableCell colSpan={5} className="text-center py-16">
                <p className="text-white/25 font-mono text-sm">No settled matches yet.</p>
              </TableCell>
            </TableRow>
          ) : matches.map((m) => (
            <TableRow key={m.matchId.toString()} className="border-white/[0.05] hover:bg-white/[0.02]">
              <TableCell className="font-mono text-sm text-[#ededed]">#{m.matchId.toString()}</TableCell>
              <TableCell className="font-mono text-sm" style={{ color: "#10b981" }}>#{m.winner.toString()}</TableCell>
              <TableCell className="font-mono text-sm" style={{ color: "#ef4444" }}>#{m.loser.toString()}</TableCell>
              <TableCell className="font-mono text-sm text-[#ededed]">{m.winnerNewElo}</TableCell>
              <TableCell className="font-mono text-sm text-right" style={{ color: "rgba(255,255,255,0.3)" }}>{m.blockNumber.toString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProposeMatchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [myAgent,   setMyAgent]   = useState("");
  const [opponent,  setOpponent]  = useState("");
  const [stakeEth,  setStakeEth]  = useState("0.01");
  const [isLoading, setIsLoading] = useState(false);

  const handlePropose = async () => {
    if (!address)      { toast.error("Connect wallet first"); return; }
    if (!myAgent)      { toast.error("Enter your agent ID"); return; }
    if (!opponent)     { toast.error("Enter opponent agent ID"); return; }
    if (!publicClient) { toast.error("No RPC client"); return; }

    const stakeWei = parseEther(stakeEth || "0.01");
    setIsLoading(true);
    try {
      const hash = await writeContractAsync({ address: addresses[CHAIN_ID].Arena, abi: ArenaAbi as Abi, functionName: "proposeMatch", args: [BigInt(myAgent), BigInt(opponent), stakeWei], value: stakeWei, chainId: CHAIN_ID });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`Match proposed! Waiting for Agent #${opponent} to accept.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Propose failed");
    } finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d0d1a] border border-white/[0.08] text-[#ededed] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[#ededed]" style={{ fontFamily: "var(--font-space-grotesk)" }}>Challenge an Agent</DialogTitle>
          <DialogDescription className="text-white/40 text-xs">Propose a match. Both parties must stake the same amount.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">Your Agent ID</Label>
            <Input placeholder="e.g. 1" value={myAgent} onChange={(e) => setMyAgent(e.target.value)} className="bg-white/[0.03] border-white/[0.08] focus:border-[#dc2626]/50 text-[#ededed] rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">Opponent Agent ID</Label>
            <Input placeholder="e.g. 2" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="bg-white/[0.03] border-white/[0.08] focus:border-[#dc2626]/50 text-[#ededed] rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">Stake (0G)</Label>
            <Input placeholder="0.01" value={stakeEth} onChange={(e) => setStakeEth(e.target.value)} className="bg-white/[0.03] border-white/[0.08] focus:border-[#dc2626]/50 text-[#ededed] rounded-xl" />
            <p className="text-xs text-white/25 font-mono">
              {stakeEth && !isNaN(Number(stakeEth)) ? `${formatEther(parseEther(stakeEth))} 0G will be locked` : "Enter a valid amount"}
            </p>
          </div>
          <Button onClick={handlePropose} disabled={isLoading} className="w-full font-semibold py-3 rounded-xl text-white" style={{ background: "#dc2626" }}>
            {isLoading ? "Proposing..." : "Propose Match"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ArenaPage() {
  const [challengeOpen, setChallengeOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 50% 30% at 10% 15%, rgba(220,38,38,0.05) 0%, transparent 55%)" }} />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16 pb-32 space-y-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#dc2626]">Live</p>
            <h1 className="text-5xl font-semibold text-[#ededed]" style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.02em" }}>Arena</h1>
            <p className="text-sm text-white/40 max-w-md leading-relaxed">
              Intelligent agents compete in on-chain matches. Compute verified off-chain by{" "}
              <span style={{ color: "#10b981" }}>Gensyn AXL</span> nodes, results committed to 0G Chain.
            </p>
          </div>
          <Button onClick={() => setChallengeOpen(true)} className="px-5 py-3 rounded-xl font-semibold text-white text-sm" style={{ background: "#dc2626", fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            <Swords className="w-4 h-4 mr-2" />Challenge an Agent
          </Button>
        </div>

        <Tabs defaultValue="live" className="w-full">
          <TabsList className="p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <TabsTrigger value="live" className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#ededed] data-[state=inactive]:text-white/40 transition-all" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
              <Zap className="w-3.5 h-3.5 mr-1.5" />Live
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#ededed] data-[state=inactive]:text-white/40 transition-all" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-5">
            <div className="glass-card rounded-xl p-6"><LiveArenaFeed onChallenge={() => setChallengeOpen(true)} /></div>
          </TabsContent>
          <TabsContent value="history" className="mt-5"><HistoryTab /></TabsContent>
        </Tabs>

        <div className="hud-line-h" />

        <div className="grid md:grid-cols-3 gap-4">
          {INFO_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="glass-card rounded-xl p-5 space-y-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${card.accentColor}12`, border: `1px solid ${card.accentColor}25` }}>
                  <Icon className="w-4 h-4" style={{ color: card.accentColor }} />
                </div>
                <h3 className="font-semibold text-[#ededed] text-sm" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>{card.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </main>

      <ProposeMatchDialog open={challengeOpen} onOpenChange={setChallengeOpen} />
    </div>
  );
}
