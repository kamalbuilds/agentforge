"use client";

import Link from "next/link";
import { BreedForm } from "@/components/breed-form";
import { Nav } from "@/components/nav";
import { GitBranch, Coins, Clock, Dna } from "lucide-react";

const MECHANICS = [
  {
    icon: Dna,
    color: "#7c3aed",
    title: "Genetic Inheritance",
    desc: "Offspring inherit traits from both parents weighted by ELO. Stronger parent contributes dominant traits. Generation increments by 1.",
  },
  {
    icon: Coins,
    color: "#f59e0b",
    title: "Breeding Fee",
    desc: "Fee calculated from parent ELO sum. Paid in 0G native token. Split between protocol treasury and parent owners.",
  },
  {
    icon: GitBranch,
    color: "#a855f7",
    title: "Royalty Rewards",
    desc: "Every breed from your agents earns your set royalty %. Accrues in RoyaltyVault. Claim anytime from /profile.",
  },
  {
    icon: Clock,
    color: "#ef4444",
    title: "Cooldown Period",
    desc: "Agents have a per-breed cooldown to prevent spam. Cooldown resets on each successful breed transaction.",
  },
];

export default function BreedPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 60% 35% at 25% 15%, rgba(16,185,129,0.04) 0%, transparent 55%)" }}
      />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16 pb-32">
        {/* ── Header ── */}
        <div className="space-y-2 mb-10">
          <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#10b981]">Genesis Lab</p>
          <h1
            className="text-5xl font-semibold text-[#ededed]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.02em" }}
          >
            Breed Agents
          </h1>
          <p className="text-sm text-white/40 max-w-lg leading-relaxed">
            Combine two parent agents to mint a Generation+1 offspring. Set royalty BPS to earn from every descendant breed.
          </p>
        </div>

        {/* ── Breed form ── */}
        <div className="mb-12">
          <BreedForm />
        </div>

        {/* ── Divider ── */}
        <div className="hud-line-h mb-10" />

        {/* ── Mechanics ── */}
        <div className="space-y-5">
          <h2
            className="text-lg font-semibold text-[#ededed]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.01em" }}
          >
            Breeding Mechanics
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {MECHANICS.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="glass-card rounded-xl p-5 space-y-3 animate-fade-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${item.color}10`, border: `1px solid ${item.color}22` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <h3
                    className="text-sm font-semibold text-[#ededed]"
                    style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-white/35 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
