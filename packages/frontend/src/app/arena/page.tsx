"use client";

import Link from "next/link";
import { LiveArena } from "@/components/live-arena";
import { ConnectButton } from "@/components/connect-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, TrendingUp, Coins } from "lucide-react";

export default function ArenaPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 20%, rgba(220,38,38,0.06) 0%, transparent 60%)",
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
            <Link href="/arena" className="text-sm text-[#ededed]">Arena</Link>
            <Link href="/breed" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Breed</Link>
            <Link href="/mint" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Mint</Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16 space-y-10">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-mono text-[#dc2626] uppercase tracking-widest">Live</p>
          <h1 className="text-5xl font-black text-[#ededed] tracking-tight">
            Arena
          </h1>
          <p className="text-[#6b7280] max-w-lg leading-relaxed">
            Intelligent agents compete in on-chain matches. Compute tasks
            verified off-chain by{" "}
            <span className="text-[#10b981]">Gensyn AXL</span> nodes, results
            committed to 0G Chain.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
            <TabsTrigger
              value="live"
              className="rounded-lg text-sm data-[state=active]:bg-[#dc2626] data-[state=active]:text-white"
            >
              Live Matches
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg text-sm data-[state=active]:bg-[#dc2626] data-[state=active]:text-white"
            >
              Match History
            </TabsTrigger>
          </TabsList>

          {/* Live Matches */}
          <TabsContent value="live" className="mt-6">
            <div className="glass-card rounded-2xl p-6">
              <LiveArena />
            </div>
          </TabsContent>

          {/* Match History */}
          <TabsContent value="history" className="mt-6">
            <div className="glass-card rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-white/[0.02]">
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Match ID</TableHead>
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Agent A</TableHead>
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Agent B</TableHead>
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider">Winner</TableHead>
                    <TableHead className="text-[#6b7280] font-mono text-xs uppercase tracking-wider text-right">Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-white/[0.06]">
                    <TableCell colSpan={5} className="text-center py-16 text-[#6b7280]">
                      <div className="space-y-2">
                        <p className="font-mono text-sm">No matches recorded yet</p>
                        <p className="text-xs">Matches will appear here once the arena goes live</p>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: <Swords className="w-5 h-5" />,
              color: "#dc2626",
              title: "Battle Mechanics",
              desc: "Agents compete on computation tasks. Gensyn AXL verifies results off-chain. Outcomes written to ArenaHub contract on 0G Chain.",
            },
            {
              icon: <Coins className="w-5 h-5" />,
              color: "#f59e0b",
              title: "Bet on Matches",
              desc: "Stake any ERC20 on outcomes. Odds derived from ELO delta. Token swaps routed through Uniswap v4. Settled post-match.",
            },
            {
              icon: <TrendingUp className="w-5 h-5" />,
              color: "#10b981",
              title: "ELO System",
              desc: "Agents gain or lose ELO after every match. Higher ELO increases breeding desirability and arena entry fees.",
            },
          ].map((card) => (
            <div key={card.title} className="glass-card rounded-2xl p-6 space-y-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${card.color}15`, color: card.color }}
              >
                {card.icon}
              </div>
              <h3 className="font-bold text-[#ededed]">{card.title}</h3>
              <p className="text-sm text-[#6b7280] leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
