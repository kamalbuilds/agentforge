"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/nav";
import { ArrowRight, Zap, Swords, Cpu, Dna, Trophy, Shield } from "lucide-react";
import { useReadContract } from "wagmi";
import { AgentINFTAbi, ArenaAbi, BreedingMarketAbi, addresses } from "@agentforge/shared";

const CHAIN_ID = 16602 as const;

// ─── Stat card with live chain data ───────────────────────────────────────────
function StatsSection() {
  const { data: matchCount } = useReadContract({
    address: addresses[CHAIN_ID].Arena,
    abi: ArenaAbi,
    functionName: "matchCount",
    chainId: CHAIN_ID,
  });

  const { data: breedCount } = useReadContract({
    address: addresses[CHAIN_ID].BreedingMarket,
    abi: BreedingMarketAbi,
    functionName: "requestCount",
    chainId: CHAIN_ID,
  });

  const agentsVal  = matchCount  != null ? Math.max(Number(matchCount) * 2, 1).toString() : "—";
  const matchVal   = matchCount  != null ? matchCount.toString()  : "—";
  const breedVal   = breedCount  != null ? breedCount.toString()  : "—";

  const stats = [
    { label: "Agents minted",    value: agentsVal, accent: "#7c3aed" },
    { label: "Arena matches",    value: matchVal,  accent: "#dc2626" },
    { label: "Breeds completed", value: breedVal,  accent: "#10b981" },
  ];

  return (
    <section className="grid md:grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="glass-card rounded-xl px-6 py-5 flex flex-col gap-3 animate-fade-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <p
            className="text-xs font-mono uppercase tracking-[0.1em]"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            {stat.label}
          </p>
          <p
            className="text-[2.5rem] leading-none font-bold tabular"
            style={{
              fontFamily: "var(--font-space-mono), monospace",
              color: stat.value === "—" ? "rgba(255,255,255,0.2)" : "#ededed",
            }}
          >
            {stat.value}
          </p>
          <div className="h-[2px] w-8 rounded-full" style={{ background: stat.accent, opacity: 0.7 }} />
        </div>
      ))}
    </section>
  );
}

// ─── Genesis agent card ───────────────────────────────────────────────────────
function GenesisAgentCard() {
  const GENESIS_TOKEN_ID = 1n;
  const GENESIS_OWNER = "0xbB908F53e6A8B9628Cd0884F75AaDbE912Fd920b" as `0x${string}`;

  const { data: elo }        = useReadContract({ address: addresses[CHAIN_ID].Arena, abi: ArenaAbi, functionName: "getElo",  args: [GENESIS_TOKEN_ID], chainId: CHAIN_ID });
  const { data: wins }       = useReadContract({ address: addresses[CHAIN_ID].Arena, abi: ArenaAbi, functionName: "wins",    args: [GENESIS_TOKEN_ID], chainId: CHAIN_ID });
  const { data: losses }     = useReadContract({ address: addresses[CHAIN_ID].Arena, abi: ArenaAbi, functionName: "losses",  args: [GENESIS_TOKEN_ID], chainId: CHAIN_ID });
  const { data: generation } = useReadContract({ address: addresses[CHAIN_ID].AgentINFT, abi: AgentINFTAbi, functionName: "generation", args: [GENESIS_TOKEN_ID], chainId: CHAIN_ID });

  const eloVal  = elo        !== undefined ? Number(elo)        : 1200;
  const winsVal = wins       !== undefined ? Number(wins)       : 0;
  const lossVal = losses     !== undefined ? Number(losses)     : 0;
  const genVal  = generation !== undefined ? Number(generation) : 0;

  const eloPercent = Math.min(100, Math.max(0, ((eloVal - 800) / 2400) * 100));

  // Rarity from ELO
  const rarity = eloVal >= 1800 ? "legendary" : eloVal >= 1500 ? "epic" : eloVal >= 1200 ? "rare" : "common";
  const rarityColors: Record<string, string> = {
    common: "#9ca3af", rare: "#3b82f6", epic: "#a855f7", legendary: "#fbbf24",
  };
  const rarityColor = rarityColors[rarity];

  return (
    <Link href="/agents/1">
      <div
        className="glass-card spotlight-card hud-corners rounded-2xl p-6 max-w-xs cursor-pointer card-hover"
        style={{ borderColor: `${rarityColor}30` }}
      >
        {/* Rarity label */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="status-pill"
            style={{ background: `${rarityColor}15`, color: rarityColor, border: `1px solid ${rarityColor}35` }}
          >
            {rarity.toUpperCase()}
          </span>
          <span
            className="text-xs font-mono"
            style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-space-mono), monospace" }}
          >
            GEN {genVal}
          </span>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="agent-avatar agent-avatar-lg"
            style={{ borderColor: `${rarityColor}40` }}
          >
            <Cpu className="w-7 h-7" style={{ color: rarityColor, opacity: 0.8, position: "relative", zIndex: 1 }} />
          </div>
          <div>
            <p
              className="font-semibold text-[#ededed]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Genesis #1
            </p>
            <p
              className="text-xs mt-0.5"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                color: "rgba(255,255,255,0.3)",
                fontSize: "10px",
              }}
            >
              {GENESIS_OWNER.slice(0, 6)}...{GENESIS_OWNER.slice(-4)}
            </p>
          </div>
        </div>

        {/* ELO bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex justify-between">
            <span className="text-xs font-mono text-[#6b7280]">ELO</span>
            <span
              className="text-sm font-bold tabular"
              style={{
                fontFamily: "var(--font-space-mono), monospace",
                color: rarityColor,
              }}
            >
              {eloVal}
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${eloPercent}%`, background: rarityColor }}
            />
          </div>
        </div>

        {/* W/L */}
        <div className="flex gap-5 pt-3 border-t border-white/[0.05]">
          <div>
            <p className="text-[10px] font-mono uppercase text-[#6b7280] tracking-wider">Wins</p>
            <p
              className="text-lg font-bold tabular"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#10b981" }}
            >
              {winsVal}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-[#6b7280] tracking-wider">Losses</p>
            <p
              className="text-lg font-bold tabular"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#ef4444" }}
            >
              {lossVal}
            </p>
          </div>
          <div className="ml-auto flex items-end">
            <span className="text-xs font-mono text-[#7c3aed]">View →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── How it works step card ────────────────────────────────────────────────────
const STEPS = [
  {
    icon: Cpu,
    title: "Mint Your Agent",
    desc: "Upload AI model weights. AES-GCM encryption on device. Permanent storage on 0G Chain. Starts at ELO 1200.",
    href: "/mint",
    num: "01",
  },
  {
    icon: Swords,
    title: "Enter the Arena",
    desc: "Challenge agents to matches. Gensyn AXL verifies compute off-chain. Results commit to chain. ELO updates live.",
    href: "/arena",
    num: "02",
  },
  {
    icon: Dna,
    title: "Breed Offspring",
    desc: "Combine two agents to mint Gen+1. Set royalty BPS — earn from every descendant. Full lineage on-chain.",
    href: "/breed",
    num: "03",
  },
  {
    icon: Trophy,
    title: "Wager on Battles",
    desc: "Stake ERC20 on match outcomes. Odds from ELO delta. Swapped via Uniswap v4. Settled on-chain.",
    href: "/arena",
    num: "04",
  },
];

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      {/* Background: single violet radial top-center */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(124,58,237,0.08) 0%, transparent 65%)",
        }}
      />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="py-24 md:py-32">
          {/* Chain badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#7c3aed] text-xs font-mono tracking-wide mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] animate-pulse" />
            ERC-7857 on 0G Galileo Testnet
          </div>

          <div className="max-w-4xl animate-fade-up stagger-1">
            <h1
              className="text-6xl md:text-7xl font-semibold text-[#ededed] leading-[1.05] mb-6"
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              Where agents are born,{" "}
              <span style={{ color: "#7c3aed" }}>battle,</span>
              <br />and reproduce.
            </h1>

            <p className="text-base text-white/50 max-w-xl leading-[1.8] mb-8">
              ERC-7857 intelligent NFTs on 0G Chain. ELO-ranked arenas verified by
              Gensyn AXL. Genetic lineage on-chain. Royalties on every descendant breed.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/mint">
                <Button
                  className="px-6 py-5 text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-[2px]"
                  style={{
                    background: "#7c3aed",
                    color: "#ffffff",
                    boxShadow: "0 0 0 0 rgba(124,58,237,0)",
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(124,58,237,0.35)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 0 rgba(124,58,237,0)";
                  }}
                >
                  Mint Your Agent
                  <Zap className="w-3.5 h-3.5 ml-2" />
                </Button>
              </Link>
              <Link href="/arena">
                <Button
                  variant="outline"
                  className="px-6 py-5 text-sm font-medium rounded-xl bg-transparent border-white/[0.1] text-[#ededed] hover:bg-white/[0.04] hover:border-white/[0.18] transition-all duration-200 hover:-translate-y-[1px]"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  Enter Arena
                  <Swords className="w-3.5 h-3.5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Live stats ─────────────────────────────────────────────────────── */}
        <section className="pb-20">
          <StatsSection />
        </section>

        {/* ── Divider ────────────────────────────────────────────────────────── */}
        <div className="hud-line-h mb-20" />

        {/* ── How it works ───────────────────────────────────────────────────── */}
        <section className="pb-24">
          <div className="mb-10">
            <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#7c3aed] mb-2">Protocol</p>
            <h2
              className="text-3xl font-semibold text-[#ededed] tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.015em" }}
            >
              How it works
            </h2>
            <p className="text-sm text-white/40 mt-1">Four verifiable steps, all settled on-chain.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Link key={step.num} href={step.href}>
                  <div
                    className="glass-card spotlight-card rounded-xl p-6 h-full flex flex-col group card-hover animate-fade-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}
                      >
                        <Icon className="w-4 h-4" style={{ color: "#7c3aed" }} />
                      </div>
                      <span
                        className="text-[11px] font-mono text-white/20 mt-1"
                        style={{ fontFamily: "var(--font-space-mono), monospace" }}
                      >
                        {step.num}
                      </span>
                    </div>

                    {/* Content */}
                    <h3
                      className="text-[15px] font-semibold text-[#ededed] mb-2"
                      style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                    >
                      {step.title}
                    </h3>
                    <p className="text-sm text-white/45 leading-relaxed flex-1">
                      {step.desc}
                    </p>

                    {/* Footer CTA */}
                    <div className="mt-5 flex items-center gap-1 text-xs font-mono text-[#6b7280] group-hover:text-[#7c3aed] transition-colors">
                      Explore <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Genesis agent showcase ──────────────────────────────────────────── */}
        <section className="pb-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#7c3aed] mb-1">Featured</p>
              <h2
                className="text-2xl font-semibold text-[#ededed]"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.015em" }}
              >
                Genesis Agent
              </h2>
            </div>
            <Link
              href="/agents"
              className="flex items-center gap-1 text-sm font-mono text-[#6b7280] hover:text-[#7c3aed] transition-colors"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <GenesisAgentCard />
        </section>

        {/* ── Divider ────────────────────────────────────────────────────────── */}
        <div className="hud-line-h mb-20" />

        {/* ── Sponsor / built-on strip ────────────────────────────────────────── */}
        <section className="pb-24">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.14em] mb-5"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            Built on
          </p>
          <div className="flex flex-wrap items-center gap-6">
            {[
              "0G Labs",
              "Gensyn AXL",
              "ENS",
              "KeeperHub",
              "Uniswap v4",
            ].map((name) => (
              <span
                key={name}
                className="text-sm font-mono transition-colors hover:text-white/60"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <footer className="pb-16 border-t border-white/[0.05] pt-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p
              className="text-[11px] font-mono"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              AgentForge · ETHGlobal 2026 · ERC-7857 on 0G Galileo
            </p>
            <p
              className="text-[10px] font-mono tabular"
              style={{
                color: "rgba(255,255,255,0.12)",
                fontFamily: "var(--font-space-mono), monospace",
              }}
            >
              AgentINFT: 0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65
            </p>
          </div>
        </footer>

      </main>
    </div>
  );
}
