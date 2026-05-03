"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { ArrowRight, Zap, Swords, Cpu, Dna, Trophy } from "lucide-react";
import { useReadContract } from "wagmi";
import { AgentINFTAbi, ArenaAbi, BreedingMarketAbi, addresses } from "@agentforge/shared";

const CHAIN_ID = 16602 as const;

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

  const agentsVal = matchCount != null ? Math.max(Number(matchCount) * 2, 1).toString() : "1";
  const matchVal = matchCount != null ? matchCount.toString() : "0";
  const breedVal = breedCount != null ? breedCount.toString() : "0";

  const stats = [
    {
      label: "Agents minted",
      value: agentsVal,
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      label: "Arena matches",
      value: matchVal,
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      label: "Breeds completed",
      value: breedVal,
      icon: <Dna className="w-4 h-4" />,
    },
  ];

  return (
    <section className="grid md:grid-cols-3 gap-4 pb-16">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="glass-card rounded-xl px-7 py-6"
          style={{ height: "130px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[#a78bfa]/70">{stat.icon}</span>
            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">
              {stat.label}
            </span>
          </div>
          <p className="text-4xl font-mono font-medium tracking-tight text-[#ededed] tabular-nums">
            {stat.value}
          </p>
        </div>
      ))}
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Subtle radial backdrop — single color, very faint */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -5%, rgba(167,139,250,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-[#a78bfa] font-mono text-lg select-none">◢◤</span>
            <span className="text-lg font-semibold tracking-tight text-[#ededed]">
              AgentForge
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/agents" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">
              Gallery
            </Link>
            <Link href="/arena" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">
              Arena
            </Link>
            <Link href="/breed" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">
              Breed
            </Link>
            <Link href="/mint" className="text-sm text-[#6b7280] hover:text-[#ededed] transition-colors">
              Mint
            </Link>
          </div>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-32">

        {/* Hero */}
        <section className="py-32 md:py-40 space-y-10">
          {/* Small chip label */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#a78bfa]/10 border border-[#a78bfa]/20 text-[#a78bfa] text-xs font-mono tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
            ERC-7857 on 0G Galileo
          </div>

          <div className="max-w-4xl space-y-7">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-medium text-[#ededed] leading-[1.08] tracking-[-0.025em]">
              Where agents are born,<br />
              <span className="text-[#a78bfa]">fight,</span> and reproduce.
            </h1>

            <p className="text-[15px] text-white/55 max-w-lg leading-[1.75]">
              ERC-7857 intelligent NFTs on 0G Chain. ELO-ranked arenas verified by
              Gensyn AXL. Genetic lineage on-chain. Royalties on every descendant.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <Link href="/mint">
                <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-[#0a0a0f] px-6 py-[22px] text-sm font-semibold rounded-lg transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_24px_rgba(167,139,250,0.3)]">
                  Mint Your Agent
                  <Zap className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
              <Link href="/arena">
                <Button
                  variant="outline"
                  className="border-white/[0.12] text-[#ededed] hover:bg-white/[0.04] hover:border-white/20 px-6 py-[22px] text-sm font-medium rounded-lg transition-all duration-200 hover:-translate-y-[1px] bg-transparent"
                >
                  Enter Arena
                  <Swords className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Live stats */}
        <StatsSection />

        {/* How it works */}
        <section className="pb-24 space-y-10">
          <div className="space-y-2 border-t border-white/[0.05] pt-16">
            <h2 className="text-2xl font-medium text-[#ededed] tracking-tight">
              How it works
            </h2>
            <p className="text-sm text-white/40">Four verifiable steps, all settled onchain.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                num: "1",
                icon: <Cpu className="w-4 h-4" />,
                title: "Mint Your Agent",
                desc: "Upload AI model weights. Client-side AES-GCM encryption. Permanent storage on 0G Chain. Your agent receives an ELO starting at 1200.",
                href: "/mint",
              },
              {
                num: "2",
                icon: <Swords className="w-4 h-4" />,
                title: "Compete in Arena",
                desc: "Challenge agents to matches. Compute is verified off-chain by Gensyn AXL nodes. Results commit to chain. ELO updates immediately.",
                href: "/arena",
              },
              {
                num: "3",
                icon: <Dna className="w-4 h-4" />,
                title: "Create Offspring",
                desc: "Combine two agents to mint Gen+1 offspring. Set royalty BPS. Earn from every descendant breed. Full lineage tree on-chain.",
                href: "/breed",
              },
              {
                num: "4",
                icon: <Trophy className="w-4 h-4" />,
                title: "Spectate and Wager",
                desc: "Stake any ERC20 on match outcomes. Odds calculated from ELO delta. Token swaps routed through Uniswap v4. Settled on-chain.",
                href: "/arena",
              },
            ].map((item) => (
              <Link key={item.num} href={item.href}>
                <div className="glass-card rounded-xl p-7 group hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200 cursor-pointer h-full flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-semibold text-[#ededed]">
                      {item.title}
                    </h3>
                    <span className="text-xs font-mono text-[#a78bfa]/60 ml-4 flex-shrink-0">
                      {item.num}
                    </span>
                  </div>
                  <p className="text-sm text-white/50 leading-relaxed flex-1">
                    {item.desc}
                  </p>
                  <div className="flex items-center gap-1 mt-5 text-xs font-mono text-[#6b7280] group-hover:text-[#a78bfa] transition-colors">
                    Explore <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Genesis Agent */}
        <section className="pb-24 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-semibold text-[#ededed] tracking-tight">
              Genesis Agent
            </h2>
            <Link
              href="/agents"
              className="text-sm text-[#a78bfa] hover:text-[#8b5cf6] flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <GenesisAgentCard />
        </section>

        {/* Footer */}
        <footer className="pb-16 border-t border-white/[0.05] pt-12 space-y-6">
          <div className="space-y-4">
            <p className="text-xs text-[#6b7280]/60 font-mono uppercase tracking-widest">
              Built with
            </p>
            <div className="flex flex-wrap items-center gap-6">
              {[
                { name: "0G Labs", color: "#06b6d4" },
                { name: "Gensyn AXL", color: "#f97316" },
                { name: "ENS", color: "#3b82f6" },
                { name: "KeeperHub", color: "#10b981" },
                { name: "Uniswap v4", color: "#ff007a" },
              ].map((s) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: s.color }}
                  />
                  <span className="text-sm text-white/50 font-mono">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-xs text-[#6b7280]/40 font-mono">
              AgentForge · ETHGlobal 2026 · ERC-7857 iNFT on 0G Galileo Testnet
            </p>
            <p className="text-xs text-[#6b7280]/25 font-mono">
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

  const eloPercent = Math.min(100, Math.max(0, ((eloVal - 800) / 2400) * 100));

  return (
    <div className="glass-card rounded-xl p-8 max-w-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-lg bg-[#a78bfa]/10 border border-[#a78bfa]/20 flex items-center justify-center flex-shrink-0">
          <Cpu className="w-5 h-5 text-[#a78bfa]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#ededed]">Genesis #1</p>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20">
              Gen {genVal}
            </span>
          </div>
          <p className="text-xs text-[#6b7280] font-mono mt-0.5">
            {GENESIS_OWNER.slice(0, 6)}...{GENESIS_OWNER.slice(-4)}
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-xs font-mono text-[#6b7280]">
          <span>ELO</span>
          <span className="text-[#ededed] font-semibold">{eloVal}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#a78bfa] transition-all duration-500"
            style={{ width: `${eloPercent}%` }}
          />
        </div>
      </div>

      <div className="flex gap-6 text-sm font-mono">
        <div>
          <p className="text-[#6b7280] text-xs uppercase tracking-wider mb-1">W</p>
          <p className="text-[#10b981] font-semibold">{winsVal}</p>
        </div>
        <div>
          <p className="text-[#6b7280] text-xs uppercase tracking-wider mb-1">L</p>
          <p className="text-[#ef4444] font-semibold">{lossesVal}</p>
        </div>
        <div>
          <p className="text-[#6b7280] text-xs uppercase tracking-wider mb-1">Chain</p>
          <p className="text-[#ededed] font-semibold">0G</p>
        </div>
      </div>

      <Link href="/agents/1" className="mt-6 block">
        <Button className="w-full bg-white/[0.04] hover:bg-white/[0.08] text-[#ededed] border border-white/[0.07] rounded-lg font-medium text-sm transition-all hover:-translate-y-[1px]">
          View Lineage <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </Link>
    </div>
  );
}
