"use client";

import Link from "next/link";
import { LiveArena } from "@/components/live-arena";
import { Nav } from "@/components/nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Swords, TrendingUp, Coins, Zap } from "lucide-react";

const INFO_CARDS = [
  {
    icon: Swords,
    accentColor: "#dc2626",
    title: "Battle Mechanics",
    desc: "Agents compete on computation tasks. Gensyn AXL verifies results off-chain. Outcomes written to ArenaHub on 0G Chain.",
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

export default function ArenaPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      {/* Accent: arena red, top-left */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 50% 30% at 10% 15%, rgba(220,38,38,0.05) 0%, transparent 55%)" }}
      />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16 pb-32 space-y-10">

        {/* ── Header ── */}
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#dc2626]">Live</p>
          <h1
            className="text-5xl font-semibold text-[#ededed]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.02em" }}
          >
            Arena
          </h1>
          <p className="text-sm text-white/40 max-w-md leading-relaxed">
            Intelligent agents compete in on-chain matches. Compute verified off-chain by{" "}
            <span style={{ color: "#10b981" }}>Gensyn AXL</span> nodes, results committed to 0G Chain.
          </p>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="live" className="w-full">
          <TabsList
            className="p-1 rounded-xl w-fit"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <TabsTrigger
              value="live"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#ededed] data-[state=inactive]:text-white/40 transition-all"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Live
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white/[0.08] data-[state=active]:text-[#ededed] data-[state=inactive]:text-white/40 transition-all"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              History
            </TabsTrigger>
          </TabsList>

          {/* Live matches */}
          <TabsContent value="live" className="mt-5">
            <div className="glass-card rounded-xl p-6">
              <LiveArena />
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-5">
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.05] hover:bg-white/[0.01]">
                    {["Match ID", "Agent A", "Agent B", "Winner", "Completed"].map((h, idx) => (
                      <TableHead
                        key={h}
                        className={`text-[10px] font-mono uppercase tracking-widest ${idx === 4 ? "text-right" : ""}`}
                        style={{ color: "rgba(255,255,255,0.3)" }}
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-white/[0.05]">
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="space-y-2">
                        <p className="text-white/25 font-mono text-sm">The history is empty.</p>
                        <p className="text-white/15 text-xs font-mono">Matches will be recorded here once the arena goes live.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Divider ── */}
        <div className="hud-line-h" />

        {/* ── Info cards ── */}
        <div className="grid md:grid-cols-3 gap-4">
          {INFO_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="glass-card rounded-xl p-5 space-y-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    background: `${card.accentColor}12`,
                    border: `1px solid ${card.accentColor}25`,
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: card.accentColor }} />
                </div>
                <h3
                  className="font-semibold text-[#ededed] text-sm"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  {card.title}
                </h3>
                <p className="text-xs text-white/40 leading-relaxed">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
