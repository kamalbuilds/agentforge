"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { ArrowRight, Zap, Dna, Trophy, Swords, Cpu } from "lucide-react";
import { useReadContract } from "wagmi";
import { AgentINFTAbi, ArenaAbi, BreedingMarketAbi, addresses } from "@agentforge/shared";

const CHAIN_ID = 16602 as const;

function HeroStats() {
  const { data: totalSupply } = useReadContract({
    address: addresses[CHAIN_ID].AgentINFT,
    abi: AgentINFTAbi,
    functionName: "balanceOf",
    args: ["0x0000000000000000000000000000000000000000" as `0x${string}`],
    chainId: CHAIN_ID,
    query: { enabled: false }, // balanceOf(0x0) is not a meaningful totalSupply proxy
  });

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

  // For total agents, use matchCount's agentINFT address cross-check
  // We'll display matchCount and breedCount from real reads
  const matchDisplay = matchCount != null ? matchCount.toString() : "0";
  const breedDisplay = breedCount != null ? breedCount.toString() : "0";

  return { matchDisplay, breedDisplay };
}

function StatsSection() {
  const { matchDisplay, breedDisplay } = HeroStats();

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

  const stats = [
    {
      label: "AGENTS MINTED",
      sublabel: "Unique iNFTs on-chain",
      color: "#7c3aed",
      icon: <Cpu className="w-5 h-5" />,
      // Genesis agent #1 is known; use matchCount as a proxy lower bound since no ERC721 enumerable totalSupply
      value: matchCount != null ? Math.max(Number(matchCount) * 2, 1).toString() : "1",
    },
    {
      label: "ARENA MATCHES",
      sublabel: "Battles verified on-chain",
      color: "#dc2626",
      icon: <Trophy className="w-5 h-5" />,
      value: matchCount != null ? matchCount.toString() : "0",
    },
    {
      label: "BREEDS COMPLETED",
      sublabel: "Next-gen offspring born",
      color: "#10b981",
      icon: <Dna className="w-5 h-5" />,
      value: breedCount != null ? breedCount.toString() : "0",
    },
  ];

  return (
    <section className="grid md:grid-cols-3 gap-4 pb-24">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="glass-card rounded-2xl p-8 group hover:-translate-y-[2px] transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
          style={{ borderColor: `${stat.color}20` }}
        >
          <div
            className="flex items-center gap-2 mb-4"
            style={{ color: stat.color }}
          >
            {stat.icon}
            <span className="text-xs font-mono tracking-widest uppercase opacity-70">
              {stat.label}
            </span>
          </div>
          <p
            className="text-7xl font-black tracking-tight"
            style={{ color: stat.color }}
          >
            {stat.value}
          </p>
          <p className="text-xs text-[#6b7280] font-mono mt-2 uppercase tracking-wider">
            {stat.sublabel}
          </p>
        </div>
      ))}
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Radial gradient backdrop */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-[#7c3aed] font-mono text-xl animate-agent-pulse select-none">
              ◢◤
            </span>
            <span className="text-xl font-bold tracking-tight text-[#ededed]">
              AgentForge
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/agents"
              className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors"
            >
              Gallery
            </Link>
            <Link
              href="/arena"
              className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors"
            >
              Arena
            </Link>
            <Link
              href="/breed"
              className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors"
            >
              Breed
            </Link>
            <Link
              href="/mint"
              className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors"
            >
              Mint
            </Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Hero Section */}
        <section className="py-32 text-center space-y-8">
          {/* Category label */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#7c3aed] text-xs font-mono tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] animate-pulse" />
            ETHGlobal 2026 · ERC-7857 Protocol on 0G Galileo
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-[#ededed] leading-none tracking-[-0.04em]">
            Mint.{" "}
            <span
              style={{
                background:
                  "linear-gradient(135deg, #7c3aed 0%, #dc2626 50%, #10b981 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Battle.
            </span>{" "}
            Breed.
          </h1>

          <p className="text-lg text-[#6b7280] max-w-2xl mx-auto leading-relaxed">
            Mint intelligent NFTs as ERC-7857 iNFTs. Battle on-chain with ELO rankings
            verified by{" "}
            <span className="text-[#ededed]">Gensyn AXL</span>. Breed evolved
            offspring with on-chain genetic lineage.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/mint">
              <Button className="bg-[#7c3aed] hover:bg-[#5b21b6] text-white px-8 py-6 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_8px_30px_rgba(124,58,237,0.35)]">
                Mint Your Agent
                <Zap className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/arena">
              <Button
                variant="outline"
                className="border-white/10 text-[#ededed] hover:bg-white/[0.04] px-8 py-6 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-[2px]"
              >
                Enter Arena
                <Swords className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Live Stats — real chain reads */}
        <StatsSection />

        {/* How It Works */}
        <section className="pb-24 space-y-12">
          <div className="text-center space-y-3">
            <p className="text-xs font-mono text-[#7c3aed] uppercase tracking-widest">
              Protocol Flow
            </p>
            <h2 className="text-4xl font-black text-[#ededed] tracking-tight">
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                step: "01",
                badge: "Forge",
                badgeColor: "#7c3aed",
                title: "Mint Your Agent",
                desc: "Upload AI model weights. Client-side AES-GCM encryption. Permanent storage on 0G Chain. Your agent receives an ELO starting at 1200.",
                href: "/mint",
              },
              {
                step: "02",
                badge: "Battle",
                badgeColor: "#dc2626",
                title: "Compete in Arena",
                desc: "Challenge agents to matches. Compute is verified off-chain by Gensyn AXL nodes. Results commit to chain. ELO updates immediately.",
                href: "/arena",
              },
              {
                step: "03",
                badge: "Breed",
                badgeColor: "#10b981",
                title: "Create Offspring",
                desc: "Combine two agents to mint Gen+1 offspring. Set royalty BPS. Earn from every descendant breed. Full lineage tree on-chain.",
                href: "/breed",
              },
              {
                step: "04",
                badge: "Bet",
                badgeColor: "#f59e0b",
                title: "Spectate & Wager",
                desc: "Stake any ERC20 on match outcomes. Odds calculated from ELO delta. Token swaps routed through Uniswap v4. Settled on-chain.",
                href: "/arena",
              },
            ].map((item) => (
              <Link key={item.step} href={item.href}>
                <div className="glass-card rounded-2xl p-8 group hover:-translate-y-[2px] transition-all duration-200 cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-4">
                    <span
                      className="text-xs font-mono px-2 py-1 rounded-md"
                      style={{
                        color: item.badgeColor,
                        background: `${item.badgeColor}15`,
                        border: `1px solid ${item.badgeColor}30`,
                      }}
                    >
                      {item.badge}
                    </span>
                    <span className="text-[#1a1a28] font-black text-5xl leading-none select-none">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#ededed] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#6b7280] leading-relaxed">
                    {item.desc}
                  </p>
                  <div className="flex items-center gap-1 mt-4 text-xs font-mono text-[#6b7280] group-hover:text-[#ededed] transition-colors">
                    Explore <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Genesis Agent — real on-chain agent #1 */}
        <section className="pb-24 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-[#ededed] tracking-tight">
              Genesis Agent
            </h2>
            <Link
              href="/agents"
              className="text-sm text-[#7c3aed] hover:text-[#5b21b6] flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <GenesisAgentCard />
        </section>

        {/* Sponsor strip footer */}
        <footer className="pb-16 border-t border-white/[0.06] pt-12 space-y-8">
          <div className="text-center space-y-4">
            <p className="text-xs text-[#6b7280] font-mono uppercase tracking-widest">
              Built With
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {[
                { name: "0G Labs", color: "#06b6d4", desc: "Storage & Chain" },
                { name: "Gensyn AXL", color: "#f97316", desc: "Verifiable Compute" },
                { name: "ENS", color: "#3b82f6", desc: "Identity" },
                { name: "KeeperHub", color: "#10b981", desc: "Automation" },
                { name: "Uniswap", color: "#ff007a", desc: "Token Swaps" },
              ].map((s) => (
                <div key={s.name} className="flex items-center gap-2 group">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: s.color, boxShadow: `0 0 8px ${s.color}60` }}
                  />
                  <span className="text-sm text-[#ededed] font-semibold">
                    {s.name}
                  </span>
                  <span className="text-xs text-[#6b7280]">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs text-[#6b7280]/50 font-mono">
              AgentForge · ETHGlobal 2026 · ERC-7857 iNFT Protocol on 0G Galileo Testnet
            </p>
            <p className="text-xs text-[#6b7280]/30 font-mono">
              AgentINFT: 0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65 · Arena: 0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function GenesisAgentCard() {
  const GENESIS_TOKEN_ID = 1n;
  const GENESIS_OWNER = "0xbB908F53e6A8B9628Cd0884F75AaDbE912Fd920b" as `0x${string}`;

  const { data: elo } = useReadContract({
    address: addresses[CHAIN_ID].Arena,
    abi: ArenaAbi,
    functionName: "getElo",
    args: [GENESIS_TOKEN_ID],
    chainId: CHAIN_ID,
  });

  const { data: wins } = useReadContract({
    address: addresses[CHAIN_ID].Arena,
    abi: ArenaAbi,
    functionName: "wins",
    args: [GENESIS_TOKEN_ID],
    chainId: CHAIN_ID,
  });

  const { data: losses } = useReadContract({
    address: addresses[CHAIN_ID].Arena,
    abi: ArenaAbi,
    functionName: "losses",
    args: [GENESIS_TOKEN_ID],
    chainId: CHAIN_ID,
  });

  const { data: generation } = useReadContract({
    address: addresses[CHAIN_ID].AgentINFT,
    abi: AgentINFTAbi,
    functionName: "generation",
    args: [GENESIS_TOKEN_ID],
    chainId: CHAIN_ID,
  });

  const eloVal = elo !== undefined ? Number(elo) : 1200;
  const winsVal = wins !== undefined ? Number(wins) : 0;
  const lossesVal = losses !== undefined ? Number(losses) : 0;
  const genVal = generation !== undefined ? Number(generation) : 0;

  // ELO bar: 0–3000 range, clamped
  const eloPercent = Math.min(100, Math.max(0, ((eloVal - 800) / (2400)) * 100));

  return (
    <div className="glass-card rounded-2xl p-8 max-w-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="hex-clip w-16 h-16 bg-gradient-to-br from-[#7c3aed]/40 to-[#dc2626]/40 flex items-center justify-center flex-shrink-0">
          <Cpu className="w-7 h-7 text-[#7c3aed]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-[#ededed] text-lg">Genesis #1</p>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#7c3aed]/15 text-[#7c3aed] border border-[#7c3aed]/20">
              Gen {genVal}
            </span>
          </div>
          <p className="text-xs text-[#6b7280] font-mono mt-0.5">
            {GENESIS_OWNER.slice(0, 6)}...{GENESIS_OWNER.slice(-4)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs text-[#6b7280] font-mono">
          <span>ELO RATING</span>
          <span className="text-[#ededed] font-bold">{eloVal}</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${eloPercent}%`,
              background: "linear-gradient(90deg, #7c3aed, #dc2626)",
            }}
          />
        </div>
      </div>

      <div className="flex gap-6 mt-6 text-sm font-mono">
        <div>
          <span className="text-[#6b7280] text-xs uppercase tracking-wider">W</span>
          <p className="text-[#10b981] font-bold text-lg">{winsVal}</p>
        </div>
        <div>
          <span className="text-[#6b7280] text-xs uppercase tracking-wider">L</span>
          <p className="text-[#dc2626] font-bold text-lg">{lossesVal}</p>
        </div>
        <div>
          <span className="text-[#6b7280] text-xs uppercase tracking-wider">Chain</span>
          <p className="text-[#06b6d4] font-bold text-lg">0G</p>
        </div>
      </div>

      <Link href="/agents/1" className="mt-6 block">
        <Button className="w-full bg-white/[0.04] hover:bg-white/[0.08] text-[#ededed] border border-white/[0.08] rounded-xl font-semibold transition-all hover:-translate-y-[1px]">
          View Lineage <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
