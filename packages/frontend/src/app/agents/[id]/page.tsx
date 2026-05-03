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
import { Swords, Dna, ArrowLeft } from "lucide-react";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Contracts not yet deployed — show deploying state
  const isDeploying = true;

  if (isDeploying) {
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
        <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 text-center space-y-6">
          <Link
            href="/agents"
            className="inline-flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#ededed] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Gallery
          </Link>
          <div className="w-16 h-16 rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center mx-auto">
            <span className="text-[#7c3aed] text-2xl font-mono animate-agent-pulse">◢◤</span>
          </div>
          <h2 className="text-2xl font-bold text-[#ededed]">Agent #{id}</h2>
          <p className="text-[#6b7280] max-w-sm mx-auto text-sm">
            Contracts deploying to 0G Galileo Testnet (chainId 16601). Agent
            data will load once AgentNFT contract is live.
          </p>
        </main>
      </div>
    );
  }

  // Placeholder data shape — populated from wagmi useReadContract once deployed
  const agent = {
    tokenId: id,
    name: `Agent-${id}`,
    elo: 1200,
    wins: 0,
    losses: 0,
    generation: 0,
    owner: "0x0000000000000000000000000000000000000000",
  };

  const winRate =
    agent.wins + agent.losses > 0
      ? ((agent.wins / (agent.wins + agent.losses)) * 100).toFixed(1)
      : "—";

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

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-10">
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
              <span className="text-[#ededed] font-mono text-3xl font-black">
                {agent.name.slice(0, 2).toUpperCase()}
              </span>
            </div>

            <div className="flex-1 space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-4xl font-black text-[#ededed] tracking-tight">
                      {agent.name}
                    </h1>
                    <Badge className="bg-[#7c3aed]/20 text-[#7c3aed] border border-[#7c3aed]/30 text-xs font-mono">
                      Gen {agent.generation}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#6b7280] font-mono">
                    Token #{agent.tokenId}
                  </p>
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
                  { label: "ELO Rating", value: agent.elo.toString(), color: "#7c3aed" },
                  { label: "Win Rate", value: winRate === "—" ? "—" : `${winRate}%`, color: "#10b981" },
                  { label: "Wins", value: agent.wins.toString(), color: "#10b981" },
                  { label: "Losses", value: agent.losses.toString(), color: "#dc2626" },
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
                  <span>{agent.elo} / 2000</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#dc2626] transition-all"
                    style={{ width: `${Math.min((agent.elo / 2000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lineage Tree */}
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-[#ededed] tracking-tight">
            Lineage
          </h2>
          <LineageTree
            root={{
              tokenId: Number(id),
              name: agent.name,
              generation: agent.generation,
              parentA: undefined,
              parentB: undefined,
            }}
          />
        </div>

        {/* Match History */}
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
                  <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-white/[0.06]">
                  <TableCell
                    colSpan={5}
                    className="text-center py-12 text-[#6b7280] text-sm"
                  >
                    No matches played yet
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
