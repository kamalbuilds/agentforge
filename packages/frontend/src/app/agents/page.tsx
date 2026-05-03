"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Nav } from "@/components/nav";
import { Search, Plus, Cpu, ChevronDown } from "lucide-react";

const PORTRAIT_ROTATION = [
  "/agents/aurelius.png",
  "/agents/vesper.png",
  "/agents/borealis.png",
  "/agents/cassia.png",
  "/agents/drogon.png",
];
function portraitFor(tokenId: bigint | number): string {
  const id = typeof tokenId === "bigint" ? Number(tokenId) : tokenId;
  const idx = (Number.isFinite(id) ? id - 1 : 0) % PORTRAIT_ROTATION.length;
  return PORTRAIT_ROTATION[(idx + PORTRAIT_ROTATION.length) % PORTRAIT_ROTATION.length];
}
import { usePublicClient, useReadContracts } from "wagmi";
import { AgentINFTAbi, ArenaAbi, addresses } from "@agentforge/shared";
import type { Abi } from "viem";

const CHAIN_ID = 16602 as const;

interface AgentOnChain {
  tokenId: bigint;
  owner: string;
  elo: number;
  wins: number;
  losses: number;
  generation: number;
}

// Derive rarity tier from ELO
function getRarity(elo: number) {
  if (elo >= 1800) return { label: "legendary", color: "#fbbf24" };
  if (elo >= 1500) return { label: "epic",      color: "#a855f7" };
  if (elo >= 1200) return { label: "rare",      color: "#3b82f6" };
  return                 { label: "common",    color: "#9ca3af" };
}

// ─── Single agent card (Olas Pearl pattern) ────────────────────────────────────
function AgentCard({ agent }: { agent: AgentOnChain }) {
  const rarity = getRarity(agent.elo);
  const eloPercent = Math.min(100, Math.max(0, ((agent.elo - 800) / 2400) * 100));
  const winRate = agent.wins + agent.losses > 0
    ? ((agent.wins / (agent.wins + agent.losses)) * 100).toFixed(0)
    : null;

  return (
    <Link href={`/agents/${agent.tokenId.toString()}`}>
      <div
        className="glass-card spotlight-card rounded-xl p-5 cursor-pointer card-hover flex flex-col gap-4"
        style={{ borderColor: `${rarity.color}28` }}
      >
        {/* Top: avatar + meta */}
        <div className="flex items-start gap-3">
          <div
            className="agent-avatar shrink-0 relative overflow-hidden"
            style={{ borderColor: `${rarity.color}40` }}
          >
            <Image
              src={portraitFor(agent.tokenId)}
              alt={`Agent ${agent.tokenId.toString()}`}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p
                className="font-semibold text-[#ededed] text-sm"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                Agent #{agent.tokenId.toString()}
              </p>
            </div>
            <p
              className="text-[10px] truncate"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                color: "rgba(255,255,255,0.28)",
              }}
            >
              {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
            </p>
          </div>

          {/* Rarity + gen chips */}
          <div className="flex flex-col items-end gap-1.5">
            <span
              className="status-pill"
              style={{
                background: `${rarity.color}12`,
                color: rarity.color,
                border: `1px solid ${rarity.color}30`,
                fontSize: "9px",
              }}
            >
              {rarity.label}
            </span>
            <span
              className="text-[9px] font-mono"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              GEN {agent.generation}
            </span>
          </div>
        </div>

        {/* ELO bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono text-[#6b7280] uppercase tracking-wider">ELO</span>
            <span
              className="text-sm font-bold tabular"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                color: rarity.color,
              }}
            >
              {agent.elo}
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${eloPercent}%`, background: rarity.color }}
            />
          </div>
        </div>

        {/* W / L / Win% */}
        <div className="flex items-center gap-0 border-t border-white/[0.05] pt-3">
          <div className="flex-1 text-center">
            <p className="text-[9px] font-mono uppercase text-[#6b7280] tracking-wider mb-0.5">W</p>
            <p
              className="text-base font-bold tabular"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#10b981" }}
            >
              {agent.wins}
            </p>
          </div>
          <div className="w-px h-8 bg-white/[0.05]" />
          <div className="flex-1 text-center">
            <p className="text-[9px] font-mono uppercase text-[#6b7280] tracking-wider mb-0.5">L</p>
            <p
              className="text-base font-bold tabular"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#ef4444" }}
            >
              {agent.losses}
            </p>
          </div>
          {winRate !== null && (
            <>
              <div className="w-px h-8 bg-white/[0.05]" />
              <div className="flex-1 text-center">
                <p className="text-[9px] font-mono uppercase text-[#6b7280] tracking-wider mb-0.5">Win%</p>
                <p
                  className="text-base font-bold tabular"
                  style={{ fontFamily: "var(--font-space-mono), monospace", color: "#ededed" }}
                >
                  {winRate}%
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Chain data fetcher ────────────────────────────────────────────────────────
function useAgentsData() {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicClient) return;
    setLoadingLogs(true);
    setLogsError(null);

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
        args: { from: "0x0000000000000000000000000000000000000000" },
        fromBlock: 0n,
        toBlock: "latest",
      })
      .then((logs) => {
        const ids = logs
          .map((l) => (l.args as { tokenId?: bigint }).tokenId)
          .filter((id): id is bigint => id !== undefined);
        setTokenIds(ids);
        setLoadingLogs(false);
      })
      .catch((err) => {
        console.error("getLogs error:", err);
        setLogsError("Failed to fetch agents from chain.");
        setLoadingLogs(false);
      });
  }, [publicClient]);

  const ownerContracts  = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].AgentINFT as `0x${string}`, abi: AgentINFTAbi as Abi, functionName: "ownerOf"   as const, args: [id], chainId: CHAIN_ID }));
  const eloContracts    = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].Arena      as `0x${string}`, abi: ArenaAbi      as Abi, functionName: "getElo"    as const, args: [id], chainId: CHAIN_ID }));
  const winsContracts   = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].Arena      as `0x${string}`, abi: ArenaAbi      as Abi, functionName: "wins"      as const, args: [id], chainId: CHAIN_ID }));
  const lossesContracts = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].Arena      as `0x${string}`, abi: ArenaAbi      as Abi, functionName: "losses"    as const, args: [id], chainId: CHAIN_ID }));
  const genContracts    = tokenIds.map((id) => ({ address: addresses[CHAIN_ID].AgentINFT  as `0x${string}`, abi: AgentINFTAbi  as Abi, functionName: "generation" as const, args: [id], chainId: CHAIN_ID }));

  const { data: ownersData  } = useReadContracts({ contracts: ownerContracts  });
  const { data: elosData    } = useReadContracts({ contracts: eloContracts    });
  const { data: winsData    } = useReadContracts({ contracts: winsContracts   });
  const { data: lossesData  } = useReadContracts({ contracts: lossesContracts });
  const { data: gensData    } = useReadContracts({ contracts: genContracts    });

  const agents: AgentOnChain[] = tokenIds.map((id, i) => ({
    tokenId:    id,
    owner:      (ownersData?.[i]?.result as string | undefined) ?? "0x0000000000000000000000000000000000000000",
    elo:        ownersData?.[i]?.result !== undefined ? Number((elosData?.[i]?.result  as bigint | undefined) ?? 1200n) : 1200,
    wins:       Number((winsData?.[i]?.result   as bigint | undefined) ?? 0n),
    losses:     Number((lossesData?.[i]?.result as bigint | undefined) ?? 0n),
    generation: Number((gensData?.[i]?.result   as bigint | undefined) ?? 0n),
  }));

  return { agents, loadingLogs, logsError };
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"elo" | "generation" | "tokenId">("elo");
  const { agents, loadingLogs, logsError } = useAgentsData();

  const filteredAgents = agents
    .filter(
      (a) =>
        a.tokenId.toString().includes(searchTerm) ||
        a.owner.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "elo")        return b.elo - a.elo;
      if (sortBy === "generation") return b.generation - a.generation;
      return Number(a.tokenId - b.tokenId);
    });

  const totalAgents = filteredAgents.length;

  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 60% 30% at 80% 15%, rgba(124,58,237,0.05) 0%, transparent 55%)" }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: "url('/agents/lineage-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.05, mixBlendMode: "overlay" }}
      />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16 pb-32">

        {/* ── Header ── */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#7c3aed] mb-2">Registry</p>
            <h1
              className="text-5xl font-semibold text-[#ededed] tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.02em" }}
            >
              Agent Gallery
            </h1>
            {!loadingLogs && totalAgents > 0 && (
              <p className="text-sm text-white/35 mt-1 font-mono">
                {totalAgents} agent{totalAgents !== 1 ? "s" : ""} on 0G Galileo
              </p>
            )}
          </div>
          <Link href="/mint">
            <Button
              className="flex items-center gap-2 px-5 py-4 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-[2px]"
              style={{
                background: "#7c3aed",
                fontFamily: "var(--font-space-grotesk), sans-serif",
              }}
            >
              <Plus className="w-4 h-4" />
              Mint Agent
            </Button>
          </Link>
        </div>

        {/* ── Filters bar ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
            <Input
              placeholder="Search by token ID or owner address..."
              className="pl-10 bg-white/[0.03] border-white/[0.07] focus:border-[#7c3aed]/40 rounded-xl text-[#ededed] placeholder:text-white/25 text-sm"
              style={{ fontFamily: "var(--font-space-mono), monospace" }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-white/25 mr-1">Sort:</span>
            {(["elo", "generation", "tokenId"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-150"
                style={{
                  background: sortBy === s ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${sortBy === s ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color: sortBy === s ? "#a78bfa" : "#6b7280",
                }}
              >
                {s === "elo" ? "ELO" : s === "generation" ? "Gen" : "ID"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {loadingLogs ? (
          <div className="text-center py-32 space-y-4">
            {/* Skeleton shimmer grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-5 space-y-4" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex gap-3">
                    <div className="skeleton w-12 h-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-24 rounded" />
                      <div className="skeleton h-3 w-16 rounded" />
                    </div>
                  </div>
                  <div className="skeleton h-1 rounded-full" />
                  <div className="flex gap-2">
                    <div className="skeleton h-8 flex-1 rounded" />
                    <div className="skeleton h-8 flex-1 rounded" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[#6b7280] font-mono text-xs mt-8">Scanning 0G Galileo chain...</p>
          </div>
        ) : logsError ? (
          <div className="text-center py-32 space-y-3">
            <p className="text-[#ef4444] font-mono text-sm">{logsError}</p>
            <p className="text-[#6b7280] text-xs font-mono">
              AgentINFT: {addresses[CHAIN_ID].AgentINFT}
            </p>
          </div>
        ) : filteredAgents.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredAgents.map((agent, i) => (
              <div
                key={agent.tokenId.toString()}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
              >
                <AgentCard agent={agent} />
              </div>
            ))}
          </div>
        ) : (
          // Creature collector empty state
          <div className="text-center py-32 space-y-5">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto hud-corners"
              style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}
            >
              <Cpu className="w-9 h-9" style={{ color: "#7c3aed", opacity: 0.7 }} />
            </div>
            <div className="space-y-2">
              <h3
                className="text-xl font-semibold text-[#ededed]"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                {searchTerm ? "No agents found" : "The arena awaits its first agent."}
              </h3>
              <p className="text-sm text-white/35 max-w-sm mx-auto leading-relaxed">
                {searchTerm
                  ? "Try a different token ID or address."
                  : "Be the first to mint an ERC-7857 iNFT on 0G Galileo. Your agent starts at ELO 1200 and begins climbing."}
              </p>
            </div>
            {!searchTerm && (
              <Link href="/mint">
                <Button
                  className="mt-2 px-6 py-4 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#7c3aed", fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  Mint First Agent
                </Button>
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
