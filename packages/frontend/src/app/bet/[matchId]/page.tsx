"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";
import { toast } from "sonner";
import { ArrowLeft, Coins, TrendingUp, Swords, ChevronDown } from "lucide-react";

export default function BetPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [isLoading, setIsLoading] = useState(false);

  // Contracts not yet deployed
  const isDeploying = true;

  const handleBet = async () => {
    if (!selectedSide || !betAmount) {
      toast.error("Select an agent and enter a bet amount");
      return;
    }
    setIsLoading(true);
    try {
      throw new Error("NOT_IMPLEMENTED: waiting on BettingPool contract deploy");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to place bet");
    } finally {
      setIsLoading(false);
    }
  };

  if (isDeploying) {
    return (
      <div className="min-h-screen bg-[#0a0a14] relative">
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{ background: "radial-gradient(ellipse 50% 35% at 50% 10%, rgba(245,158,11,0.05) 0%, transparent 55%)" }}
        />
        <Nav />
        <main className="relative z-10 max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
          <Link
            href="/arena"
            className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors font-mono mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Arena
          </Link>
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <Coins className="w-7 h-7" style={{ color: "#f59e0b" }} />
          </div>
          <div className="space-y-2">
            <h2
              className="text-2xl font-semibold text-[#ededed]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Match #{matchId}
            </h2>
            <p className="text-sm text-white/35 max-w-sm mx-auto leading-relaxed">
              BettingPool contract is deploying. Betting will be available once ArenaHub goes live on 0G Galileo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const match = { matchId, agentA: "—", agentB: "—", eloA: 1200, eloB: 1200 };
  const oddsA = (1 + (match.eloB - match.eloA) / 1000).toFixed(2);
  const oddsB = (1 + (match.eloA - match.eloB) / 1000).toFixed(2);
  const payout = betAmount ? (parseFloat(betAmount) * parseFloat(selectedSide === "a" ? oddsA : oddsB)).toFixed(2) : null;

  return (
    <div className="min-h-screen bg-[#0a0a14] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 50% 35% at 50% 10%, rgba(245,158,11,0.05) 0%, transparent 55%)" }}
      />

      <Nav />

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12 pb-32 space-y-6">
        <Link
          href="/arena"
          className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Arena
        </Link>

        {/* Match header */}
        <div
          className="glass-card hud-corners rounded-xl p-6 text-center space-y-3"
          style={{ borderColor: "rgba(245,158,11,0.2)" }}
        >
          <p
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "#f59e0b" }}
          >
            Match #{match.matchId}
          </p>
          <div className="flex items-center justify-center gap-4">
            <p
              className="text-xl font-semibold text-[#ededed]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              {match.agentA}
            </p>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              <Swords className="w-4 h-4" style={{ color: "#dc2626" }} />
            </div>
            <p
              className="text-xl font-semibold text-[#ededed]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              {match.agentB}
            </p>
          </div>
        </div>

        {/* Betting form */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <h2
            className="text-base font-semibold text-[#ededed]"
            style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            Place Your Bet
          </h2>

          {/* Side selection */}
          <div className="space-y-2">
            <Label
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Choose a Side
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {(["a", "b"] as const).map((side) => {
                const name = side === "a" ? match.agentA : match.agentB;
                const elo  = side === "a" ? match.eloA : match.eloB;
                const odds = side === "a" ? oddsA : oddsB;
                const selected = selectedSide === side;
                return (
                  <button
                    key={side}
                    onClick={() => setSelectedSide(side)}
                    className="p-4 rounded-xl text-left transition-all duration-150"
                    style={{
                      background: selected ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${selected ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    <p
                      className="font-semibold text-[#ededed] text-sm mb-1"
                      style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                    >
                      {name}
                    </p>
                    <p
                      className="text-[10px] font-mono mb-2"
                      style={{ color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-space-mono), monospace" }}
                    >
                      ELO {elo}
                    </p>
                    <p
                      className="text-xl font-bold tabular"
                      style={{
                        fontFamily: "var(--font-space-mono), monospace",
                        color: side === "a" ? "#10b981" : "#ef4444",
                      }}
                    >
                      {odds}x
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Bet Amount
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              className="bg-white/[0.03] border-white/[0.07] focus:border-[#7c3aed]/40 rounded-xl text-[#ededed] placeholder:text-white/20"
              style={{ fontFamily: "var(--font-space-mono), monospace" }}
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
            />
          </div>

          {/* Token selector */}
          <div className="space-y-2">
            <Label
              className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Token
            </Label>
            <div className="relative">
              <select
                className="w-full rounded-xl p-3 text-sm cursor-pointer appearance-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "#ededed",
                  fontFamily: "var(--font-space-mono), monospace",
                  paddingRight: "2.5rem",
                  outline: "none",
                }}
                value={selectedToken}
                onChange={(e) => setSelectedToken(e.target.value)}
              >
                <option value="USDC">USDC</option>
                <option value="USDT">USDT</option>
                <option value="DAI">DAI</option>
                <option value="ETH">ETH</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b7280] pointer-events-none" />
            </div>
            <p
              className="text-[10px] font-mono"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              Swapped to 0G native via Uniswap v4 before staking
            </p>
          </div>

          {/* Payout preview */}
          {payout && selectedSide && (
            <div
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)" }}
            >
              <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: "#7c3aed" }} />
              <div>
                <p className="text-[10px] font-mono text-[#6b7280] uppercase tracking-wider">Potential Payout</p>
                <p
                  className="text-2xl font-bold tabular mt-0.5"
                  style={{ fontFamily: "var(--font-space-mono), monospace", color: "#7c3aed" }}
                >
                  {payout} <span className="text-sm font-normal text-[#6b7280]">0G</span>
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleBet}
            disabled={isLoading || !selectedSide || !betAmount}
            className="w-full py-3 rounded-xl font-semibold text-sm text-black transition-all hover:-translate-y-[1px] disabled:opacity-30"
            style={{ background: "#f59e0b", fontFamily: "var(--font-space-grotesk), sans-serif" }}
          >
            {isLoading ? "Placing Bet..." : "Place Bet"}
          </Button>
        </div>
      </main>
    </div>
  );
}
