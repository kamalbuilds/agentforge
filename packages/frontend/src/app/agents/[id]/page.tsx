"use client";

import { use } from "react";
import Link from "next/link";
import { ConnectButton } from "@/components/connect-button";
import { LineageTree } from "@/components/lineage-tree";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, Dna, ArrowLeft, Cpu } from "lucide-react";
import { useReadContract, useReadContracts } from "wagmi";
import { AgentINFTAbi, ArenaAbi, addresses } from "@agentforge/shared";
import type { Abi } from "viem";

const CHAIN_ID = 16602 as const;

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tokenId = BigInt(id);

  const { data: owner, isLoading: ownerLoading } = useReadContract({
    address: addresses[CHAIN_ID].AgentINFT,
    abi: AgentINFTAbi as Abi,
    functionName: "ownerOf",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const { data: elo } = useReadContract({
    address: addresses[CHAIN_ID].Arena,
    abi: ArenaAbi as Abi,
    functionName: "getElo",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const { data: wins } = useReadContract({
    address: addresses[CHAIN_ID].Arena,
    abi: ArenaAbi as Abi,
    functionName: "wins",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const { data: losses } = useReadContract({
    address: addresses[CHAIN_ID].Arena,
    abi: ArenaAbi as Abi,
    functionName: "losses",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const { data: generation } = useReadContract({
    address: addresses[CHAIN_ID].AgentINFT,
    abi: AgentINFTAbi as Abi,
    functionName: "generation",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const { data: tokenData } = useReadContract({
    address: addresses[CHAIN_ID].AgentINFT,
    abi: AgentINFTAbi as Abi,
    functionName: "getTokenData",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const { data: lineageData } = useReadContract({
    address: addresses[CHAIN_ID].AgentINFT,
    abi: AgentINFTAbi as Abi,
    functionName: "lineage",
    args: [tokenId],
    chainId: CHAIN_ID,
  });

  const eloVal = elo !== undefined ? Number(elo as bigint) : 1200;
  const winsVal = wins !== undefined ? Number(wins as bigint) : 0;
  const lossesVal = losses !== undefined ? Number(losses as bigint) : 0;
  const genVal = generation !== undefined ? Number(generation as bigint) : 0;
  const ownerAddr = (owner as string | undefined) ?? "";
  const td = tokenData as { parentA: bigint; parentB: bigint } | undefined;
  const ancestors = (lineageData as bigint[] | undefined) ?? [];

  const winRate =
    winsVal + lossesVal > 0
      ? ((winsVal / (winsVal + lossesVal)) * 100).toFixed(1)
      : "—";

  const eloPercent = Math.min(100, Math.max(0, ((eloVal - 800) / 2400) * 100));

  if (ownerLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="text-[#7c3aed] text-4xl font-mono animate-agent-pulse block">◢◤</span>
          <p className="text-[#6b7280] font-mono text-sm">Loading agent #{id}...</p>
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
            "radial-gradient(ellipse 60% 40% at 50% 10%, rgba(124,58,237,0.08) 0%, transparent 60%)",
        }}
      />

      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#7c3aed] font-mono text-xl animate-agent-pulse">◢◤</span>
            <span className="text-xl font-bold tracking-tight text-[#ededed]">AgentForge</span>
          </Link>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 pb-32 space-y-10">
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#ededed] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Gallery
        </Link>

        {/* Hero Panel */}
        <div className="glass-card rounded-2xl p-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Hex avatar */}
            <div className="hex-clip w-24 h-24 bg-gradient-to-br from-[#7c3aed]/40 to-[#dc2626]/40 flex items-center justify-center shrink-0">
              <Cpu className="w-10 h-10 text-[#7c3aed]" />
            </div>

            <div className="flex-1 space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-4xl font-black text-[#ededed] tracking-tight">
                      Agent #{id}
                    </h1>
                    <Badge className="bg-[#7c3aed]/20 text-[#7c3aed] border border-[#7c3aed]/30 text-xs font-mono">
                      Gen {genVal}
                    </Badge>
                  </div>
                  {ownerAddr && (
                    <p className="text-sm text-[#6b7280] font-mono">
                      Owner: {ownerAddr.slice(0, 6)}...{ownerAddr.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <Link href="/breed">
                    <Button className="bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 rounded-xl font-semibold transition-all">
                      <Dna className="w-4 h-4 mr-2" />
                      Breed
                    </Button>
                  </Link>
                  <Link href="/arena">
                    <Button className="bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-semibold transition-all hover:-translate-y-[2px]">
                      <Swords className="w-4 h-4 mr-2" />
                      Challenge
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "ELO Rating", value: eloVal.toString(), color: "#7c3aed" },
                  { label: "Win Rate", value: winRate === "—" ? "—" : `${winRate}%`, color: "#10b981" },
                  { label: "Wins", value: winsVal.toString(), color: "#10b981" },
                  { label: "Losses", value: lossesVal.toString(), color: "#dc2626" },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <p className="text-xs text-[#6b7280] font-mono uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <p
                      className="text-2xl font-black font-mono"
                      style={{ color: stat.color }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* ELO bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[#6b7280] font-mono">
                  <span>ELO Progress</span>
                  <span>{eloVal} / 3200</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#dc2626] transition-all duration-500"
                    style={{ width: `${eloPercent}%` }}
                  />
                </div>
              </div>

              {/* Token data */}
              {td && (
                <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-3 text-xs font-mono">
                  {td.parentA > 0n && (
                    <div>
                      <span className="text-[#6b7280]">Parent A: </span>
                      <Link
                        href={`/agents/${td.parentA.toString()}`}
                        className="text-[#7c3aed] hover:underline"
                      >
                        #{td.parentA.toString()}
                      </Link>
                    </div>
                  )}
                  {td.parentB > 0n && (
                    <div>
                      <span className="text-[#6b7280]">Parent B: </span>
                      <Link
                        href={`/agents/${td.parentB.toString()}`}
                        className="text-[#7c3aed] hover:underline"
                      >
                        #{td.parentB.toString()}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lineage — ancestors from chain */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-[#ededed] tracking-tight">
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
            <div className="glass-card rounded-2xl p-8 text-center">
              {td && td.parentA === 0n && td.parentB === 0n ? (
                <p className="text-[#6b7280] text-sm font-mono">
                  Genesis agent — no parents on-chain.
                </p>
              ) : (
                <p className="text-[#6b7280] text-sm font-mono">
                  Loading lineage from chain...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Match History placeholder — events require viem getLogs */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-[#ededed] tracking-tight">
            Match History
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Match</TableHead>
                  <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Opponent</TableHead>
                  <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Result</TableHead>
                  <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">ELO Change</TableHead>
                  <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider text-right">Block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <MatchHistoryRows tokenId={tokenId} wins={winsVal} losses={lossesVal} />
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}

function MatchHistoryRows({
  tokenId,
  wins,
  losses,
}: {
  tokenId: bigint;
  wins: number;
  losses: number;
}) {
  if (wins + losses === 0) {
    return (
      <TableRow className="border-white/[0.06]">
        <TableCell colSpan={5} className="text-center py-12 text-[#6b7280] text-sm">
          No matches played yet
        </TableCell>
      </TableRow>
    );
  }

  // Summary row when matches exist but full event log fetch not yet wired
  return (
    <TableRow className="border-white/[0.06]">
      <TableCell colSpan={5} className="text-center py-8 text-[#6b7280] text-sm font-mono">
        {wins + losses} match(es) on-chain · W:{wins} L:{losses} · full log on{" "}
        <a
          href={`https://chainscan-galileo.0g.ai/address/${addresses[CHAIN_ID].Arena}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#7c3aed] hover:underline"
        >
          0G Explorer
        </a>
      </TableCell>
    </TableRow>
  );
}
