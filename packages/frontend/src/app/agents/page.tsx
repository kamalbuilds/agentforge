"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectButton } from "@/components/connect-button";
import { Search, Plus, Cpu } from "lucide-react";
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

function AgentRow({ agent }: { agent: AgentOnChain }) {
  const eloPercent = Math.min(100, Math.max(0, ((agent.elo - 800) / 2400) * 100));
  return (
    <Link href={`/agents/${agent.tokenId.toString()}`}>
      <div className="glass-card rounded-xl p-5 hover:-translate-y-[2px] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] cursor-pointer group">
        <div className="flex items-center gap-4">
          <div className="hex-clip w-12 h-12 bg-gradient-to-br from-[#7c3aed]/30 to-[#dc2626]/30 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-[#7c3aed]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-[#ededed] font-mono text-sm">
                #{agent.tokenId.toString()}
              </p>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20">
                Gen {agent.generation}
              </span>
            </div>
            <p className="text-xs text-[#6b7280] font-mono truncate">
              {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[#ededed] font-bold font-mono">{agent.elo}</p>
            <p className="text-xs text-[#6b7280] font-mono">ELO</p>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
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

function AgentsGrid() {
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
        args: {
          from: "0x0000000000000000000000000000000000000000",
        },
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

  // Batch read per-token data for all tokenIds
  const ownerContracts = tokenIds.map((id) => ({
    address: addresses[CHAIN_ID].AgentINFT as `0x${string}`,
    abi: AgentINFTAbi as Abi,
    functionName: "ownerOf" as const,
    args: [id],
    chainId: CHAIN_ID,
  }));

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

  const { data: ownersData } = useReadContracts({ contracts: ownerContracts });
  const { data: elosData } = useReadContracts({ contracts: eloContracts });
  const { data: winsData } = useReadContracts({ contracts: winsContracts });
  const { data: lossesData } = useReadContracts({ contracts: lossesContracts });
  const { data: gensData } = useReadContracts({ contracts: genContracts });

  const agents: AgentOnChain[] = tokenIds.map((id, i) => ({
    tokenId: id,
    owner: (ownersData?.[i]?.result as string | undefined) ?? "0x0000000000000000000000000000000000000000",
    elo: ownersData?.[i]?.result !== undefined
      ? Number((elosData?.[i]?.result as bigint | undefined) ?? 1200n)
      : 1200,
    wins: Number((winsData?.[i]?.result as bigint | undefined) ?? 0n),
    losses: Number((lossesData?.[i]?.result as bigint | undefined) ?? 0n),
    generation: Number((gensData?.[i]?.result as bigint | undefined) ?? 0n),
  }));

  return { agents, loadingLogs, logsError };
}

export default function AgentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"elo" | "generation" | "tokenId">("elo");
  const { agents, loadingLogs, logsError } = AgentsGrid();

  const filteredAgents = agents
    .filter(
      (agent) =>
        agent.tokenId.toString().includes(searchTerm) ||
        agent.owner.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "elo") return b.elo - a.elo;
      if (sortBy === "generation") return b.generation - a.generation;
      return Number(a.tokenId - b.tokenId);
    });

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 80% 20%, rgba(124,58,237,0.07) 0%, transparent 60%)",
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
            <Link href="/agents" className="text-sm text-[#ededed]">Gallery</Link>
            <Link href="/arena" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Arena</Link>
            <Link href="/breed" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Breed</Link>
            <Link href="/mint" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Mint</Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="space-y-8 mb-12">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-xs font-mono text-[#7c3aed] uppercase tracking-widest">Registry</p>
              <h1 className="text-5xl font-black text-[#ededed] tracking-tight">Agent Gallery</h1>
              <p className="text-[#6b7280] max-w-lg leading-relaxed">
                All minted ERC-7857 iNFT agents on 0G Galileo (chainId 16602). Sorted by ELO ranking.
              </p>
            </div>
            <Link href="/mint">
              <Button className="bg-[#7c3aed] hover:bg-[#5b21b6] text-white rounded-xl px-6 py-3 font-semibold transition-all hover:-translate-y-[2px]">
                <Plus className="w-4 h-4 mr-2" />
                Mint Agent
              </Button>
            </Link>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
              <Input
                placeholder="Search by token ID or owner address..."
                className="pl-10 bg-white/[0.03] border-white/[0.08] focus:border-[#7c3aed]/50 rounded-xl text-[#ededed] placeholder:text-[#6b7280]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["elo", "generation", "tokenId"] as const).map((sort) => (
                <Button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`capitalize rounded-xl text-xs font-mono ${
                    sortBy === sort
                      ? "bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
                      : "bg-white/[0.03] border border-white/[0.08] text-[#6b7280] hover:text-[#ededed] hover:bg-white/[0.06]"
                  }`}
                >
                  {sort === "elo" ? "ELO" : sort === "generation" ? "Gen" : "ID"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loadingLogs ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center mx-auto">
              <span className="text-[#7c3aed] text-2xl font-mono animate-agent-pulse">◢◤</span>
            </div>
            <p className="text-[#6b7280] font-mono text-sm">Scanning 0G Galileo chain for agents...</p>
          </div>
        ) : logsError ? (
          <div className="text-center py-24 space-y-4">
            <p className="text-[#dc2626] font-mono text-sm">{logsError}</p>
            <p className="text-[#6b7280] text-xs font-mono">
              AgentINFT: {addresses[CHAIN_ID].AgentINFT}
            </p>
          </div>
        ) : filteredAgents.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentRow key={agent.tokenId.toString()} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center mx-auto">
              <Cpu className="w-8 h-8 text-[#7c3aed]" />
            </div>
            <h3 className="text-xl font-bold text-[#ededed]">
              {searchTerm ? "No agents found" : "No agents minted yet"}
            </h3>
            <p className="text-[#6b7280] max-w-sm mx-auto text-sm">
              {searchTerm
                ? "Try a different token ID or address."
                : "Be the first to mint an ERC-7857 iNFT agent on 0G Galileo."}
            </p>
            {!searchTerm && (
              <Link href="/mint">
                <Button className="mt-2 bg-[#7c3aed] hover:bg-[#5b21b6] text-white rounded-xl font-semibold transition-all hover:-translate-y-[2px]">
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
