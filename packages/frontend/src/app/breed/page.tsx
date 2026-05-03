"use client";

import Link from "next/link";
import { BreedForm } from "@/components/breed-form";
import { ConnectButton } from "@/components/connect-button";
import { GitBranch, Coins, Clock, Dna } from "lucide-react";

export default function BreedPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 30% 20%, rgba(16,185,129,0.06) 0%, transparent 60%)",
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
            <Link href="/arena" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Arena</Link>
            <Link href="/breed" className="text-sm text-[#ededed]">Breed</Link>
            <Link href="/mint" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Mint</Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <div className="space-y-10">
          {/* Header */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-[#10b981] uppercase tracking-widest">Genesis Lab</p>
            <h1 className="text-5xl font-black text-[#ededed] tracking-tight">Breed Agents</h1>
            <p className="text-[#6b7280] leading-relaxed max-w-xl">
              Combine two parent agents to mint a Generation+1 offspring. Set
              royalty BPS to earn from every descendant breed.
            </p>
          </div>

          {/* Main Form */}
          <BreedForm />

          {/* Mechanics */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#ededed] tracking-tight">Breeding Mechanics</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  icon: <Dna className="w-4 h-4" />,
                  color: "#10b981",
                  title: "Genetic Inheritance",
                  desc: "Offspring inherit traits from both parents weighted by ELO. Stronger parent contributes dominant traits. Generation increments by 1.",
                },
                {
                  icon: <Coins className="w-4 h-4" />,
                  color: "#f59e0b",
                  title: "Breeding Fee",
                  desc: "Fee calculated from parent ELO sum. Paid in 0G native token. Split between protocol treasury and parent owners.",
                },
                {
                  icon: <GitBranch className="w-4 h-4" />,
                  color: "#7c3aed",
                  title: "Royalty Rewards",
                  desc: "Every breed from your agents earns your set royalty %. Accrues in RoyaltyVault. Claim anytime from /profile.",
                },
                {
                  icon: <Clock className="w-4 h-4" />,
                  color: "#dc2626",
                  title: "Cooldown Period",
                  desc: "Agents have a per-breed cooldown to prevent spam. Cooldown resets on each successful breed transaction.",
                },
              ].map((item) => (
                <div key={item.title} className="glass-card rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${item.color}15`, color: item.color }}
                    >
                      {item.icon}
                    </div>
                    <h3 className="text-sm font-bold text-[#ededed]">{item.title}</h3>
                  </div>
                  <p className="text-xs text-[#6b7280] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
