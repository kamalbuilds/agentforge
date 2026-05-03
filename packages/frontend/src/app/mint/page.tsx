"use client";

import Link from "next/link";
import { MintForm } from "@/components/mint-form";
import { Nav } from "@/components/nav";
import { Lock, Database, Shield, ChevronRight } from "lucide-react";

const MINT_STEPS = [
  { n: "01", text: "Upload model weights (.bin, .weights, .onnx)" },
  { n: "02", text: "Client-side encryption: AES-GCM 256-bit, key stays local" },
  { n: "03", text: "Encrypted blob uploaded to 0G Storage (permanent, censorship-resistant)" },
  { n: "04", text: "AgentNFT.mint() called on 0G Galileo with metadata + storage ref" },
  { n: "05", text: "Agent spawns at ELO 1200, ready to compete in Arena" },
];

const TRUST_CARDS = [
  {
    icon: Lock,
    color: "#7c3aed",
    title: "End-to-End Encrypted",
    desc: "Weights never leave your browser unencrypted. AES-GCM 256-bit.",
  },
  {
    icon: Database,
    color: "#3b82f6",
    title: "0G Storage",
    desc: "Permanent decentralised storage on 0G Chain.",
  },
  {
    icon: Shield,
    color: "#10b981",
    title: "ERC-7857 Standard",
    desc: "Fully composable intelligent NFT standard.",
  },
];

export default function MintPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 50% 35% at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 60%)" }}
      />

      <Nav />

      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-16 pb-32">
        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[1fr_400px] gap-10 xl:gap-16">

          {/* ── Left: form ───────────────────────────────────────────────── */}
          <div className="space-y-8">
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-[#7c3aed]">Forge</p>
              <h1
                className="text-5xl font-semibold text-[#ededed] tracking-tight"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif", letterSpacing: "-0.02em" }}
              >
                Mint Your Agent
              </h1>
              <p className="text-sm text-white/45 leading-relaxed max-w-lg">
                Upload AI model weights. Your agent is encrypted on-device, stored
                permanently on 0G Storage, and minted as an ERC-7857 iNFT on 0G Chain.
              </p>
            </div>

            <MintForm />

            {/* Trust signals */}
            <div className="grid grid-cols-3 gap-3">
              {TRUST_CARDS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="glass-card rounded-xl p-4 text-center space-y-2"
                  >
                    <div
                      className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center"
                      style={{ background: `${item.color}12`, border: `1px solid ${item.color}25` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <p
                      className="text-xs font-semibold text-[#ededed]"
                      style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-white/35 leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right: mint flow explainer ────────────────────────────────── */}
          <div className="space-y-5">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.12em] text-white/25 mb-4">
                Mint Flow
              </p>

              <div className="space-y-0">
                {MINT_STEPS.map((step, i) => (
                  <div key={step.n} className="relative flex gap-4">
                    {/* Vertical connector */}
                    {i < MINT_STEPS.length - 1 && (
                      <div
                        className="absolute left-[18px] top-9 w-[1px] h-full"
                        style={{ background: "rgba(124,58,237,0.15)" }}
                      />
                    )}

                    {/* Step number circle */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative z-10"
                      style={{
                        background: i === 0 ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${i === 0 ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.07)"}`,
                      }}
                    >
                      <span
                        className="text-[10px] font-mono font-bold"
                        style={{
                          color: i === 0 ? "#7c3aed" : "rgba(255,255,255,0.3)",
                          fontFamily: "var(--font-space-mono), monospace",
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>

                    {/* Step text */}
                    <div className="pb-6">
                      <p className="text-sm text-white/55 leading-relaxed pt-2">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chain info box */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}
            >
              <p className="text-xs font-mono uppercase tracking-wider text-[#7c3aed]">Chain Info</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>Network</span>
                  <span style={{ color: "#ededed", fontFamily: "var(--font-space-mono), monospace" }}>0G Galileo (16602)</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>Starting ELO</span>
                  <span style={{ color: "#ededed", fontFamily: "var(--font-space-mono), monospace" }}>1200</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>Standard</span>
                  <span style={{ color: "#ededed", fontFamily: "var(--font-space-mono), monospace" }}>ERC-7857 iNFT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
