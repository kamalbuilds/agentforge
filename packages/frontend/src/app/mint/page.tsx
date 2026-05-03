"use client";

import Link from "next/link";
import { MintForm } from "@/components/mint-form";
import { ConnectButton } from "@/components/connect-button";
import { Lock, Database, Shield } from "lucide-react";

export default function MintPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(124,58,237,0.1) 0%, transparent 60%)",
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
            <Link href="/breed" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">Breed</Link>
            <Link href="/mint" className="text-sm text-[#ededed]">Mint</Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-16 pb-32">
        <div className="space-y-10">
          {/* Header */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-[#7c3aed] uppercase tracking-widest">Forge</p>
            <h1 className="text-5xl font-black text-[#ededed] tracking-tight">Mint Your Agent</h1>
            <p className="text-[#6b7280] leading-relaxed">
              Upload AI model weights. Your agent is encrypted on-device, stored
              permanently on 0G Storage, and minted as an ERC-7857 iNFT on 0G Chain.
            </p>
          </div>

          <MintForm />

          {/* How minting works */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#ededed] uppercase tracking-wider font-mono">
              Mint Flow
            </h3>
            <div className="space-y-2">
              {[
                { n: "01", text: "Upload model weights (.bin, .weights, .onnx)" },
                { n: "02", text: "Client-side encryption: AES-GCM 256-bit, key stays local" },
                { n: "03", text: "Encrypted blob uploaded to 0G Storage (permanent, censorship-resistant)" },
                { n: "04", text: "AgentNFT.mint() called on 0G Galileo with metadata + storage ref" },
                { n: "05", text: "Agent spawns at ELO 1200, ready to compete in Arena" },
              ].map((step) => (
                <div
                  key={step.n}
                  className="flex items-start gap-4 glass-card rounded-xl px-4 py-3"
                >
                  <span className="text-xs font-mono text-[#7c3aed] shrink-0 mt-0.5">
                    {step.n}
                  </span>
                  <span className="text-sm text-[#6b7280]">{step.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy info */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: <Lock className="w-4 h-4" />,
                color: "#7c3aed",
                title: "End-to-End Encrypted",
                desc: "Weights never leave your browser unencrypted",
              },
              {
                icon: <Database className="w-4 h-4" />,
                color: "#3b82f6",
                title: "0G Storage",
                desc: "Permanent decentralised storage on 0G Chain",
              },
              {
                icon: <Shield className="w-4 h-4" />,
                color: "#10b981",
                title: "ERC-7857 Standard",
                desc: "Fully composable intelligent NFT standard",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="glass-card rounded-xl p-4 space-y-2 text-center"
              >
                <div
                  className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center"
                  style={{ background: `${item.color}15`, color: item.color }}
                >
                  {item.icon}
                </div>
                <p className="text-xs font-bold text-[#ededed]">{item.title}</p>
                <p className="text-xs text-[#6b7280] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
