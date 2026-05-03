"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectButton } from "@/components/connect-button";
import { toast } from "sonner";
import { ArrowLeft, Coins, TrendingUp } from "lucide-react";

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
      // Real flow once deployed:
      // 1. Fetch Uniswap v4 quote for token→0G swap
      // 2. Approve token spend on BettingPool
      // 3. BettingPool.placeBet(matchId, side, amount)
      throw new Error("NOT_IMPLEMENTED: waiting on BettingPool contract deploy");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to place bet"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isDeploying) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] relative">
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 10%, rgba(245,158,11,0.06) 0%, transparent 60%)",
          }}
        />
        <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[#7c3aed] font-mono text-xl animate-agent-pulse">◢◤</span>
              <span className="text-xl font-bold tracking-tight text-[#ededed]">AgentForge</span>
            </Link>
            <ConnectButton />
          </div>
        </nav>
        <main className="relative z-10 max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
          <Link
            href="/arena"
            className="inline-flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#ededed] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Arena
          </Link>
          <div className="w-16 h-16 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center mx-auto">
            <Coins className="w-7 h-7 text-[#f59e0b]" />
          </div>
          <h2 className="text-2xl font-bold text-[#ededed]">Match #{matchId}</h2>
          <p className="text-[#6b7280] max-w-sm mx-auto text-sm">
            BettingPool contract is deploying. Betting will be available once
            ArenaHub goes live on 0G Galileo.
          </p>
        </main>
      </div>
    );
  }

  // Loaded from ArenaHub.getMatch(matchId) once deployed
  const match = {
    matchId,
    agentA: "—",
    agentB: "—",
    eloA: 1200,
    eloB: 1200,
  };

  const oddsA = (1 + (match.eloB - match.eloA) / 1000).toFixed(2);
  const oddsB = (1 + (match.eloA - match.eloB) / 1000).toFixed(2);
  const payout = betAmount
    ? (parseFloat(betAmount) * parseFloat(selectedSide === "a" ? oddsA : oddsB)).toFixed(2)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 10%, rgba(245,158,11,0.06) 0%, transparent 60%)",
        }}
      />
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#7c3aed] font-mono text-xl animate-agent-pulse">◢◤</span>
            <span className="text-xl font-bold tracking-tight text-[#ededed]">AgentForge</span>
          </Link>
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-16 pb-32 space-y-8">
        <Link
          href="/arena"
          className="inline-flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#ededed] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Arena
        </Link>

        {/* Match header */}
        <div className="glass-card rounded-2xl p-8 text-center space-y-2">
          <p className="text-xs font-mono text-[#f59e0b] uppercase tracking-widest">
            Match #{match.matchId}
          </p>
          <h1 className="text-3xl font-black text-[#ededed] tracking-tight">
            {match.agentA}{" "}
            <span className="text-[#6b7280]">vs</span>{" "}
            {match.agentB}
          </h1>
        </div>

        {/* Betting form */}
        <div className="glass-card rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-bold text-[#ededed]">Place Your Bet</h2>

          {/* Side selection */}
          <div className="space-y-2">
            <Label className="text-[#6b7280] text-xs font-mono uppercase tracking-wider">
              Choose a Side
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {(["a", "b"] as const).map((side) => {
                const name = side === "a" ? match.agentA : match.agentB;
                const elo = side === "a" ? match.eloA : match.eloB;
                const odds = side === "a" ? oddsA : oddsB;
                const isSelected = selectedSide === side;
                return (
                  <button
                    key={side}
                    onClick={() => setSelectedSide(side)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? "border-[#7c3aed] bg-[#7c3aed]/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <p className="font-bold text-[#ededed] text-sm">{name}</p>
                    <p className="text-xs text-[#6b7280] font-mono mt-1">
                      ELO: {elo}
                    </p>
                    <p className="text-lg font-black mt-2" style={{ color: side === "a" ? "#10b981" : "#dc2626" }}>
                      {odds}x
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-[#6b7280] text-xs font-mono uppercase tracking-wider">
              Bet Amount
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              className="bg-white/[0.03] border-white/[0.08] focus:border-[#7c3aed]/50 rounded-xl text-[#ededed] placeholder:text-[#6b7280]"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
            />
          </div>

          {/* Token */}
          <div className="space-y-2">
            <Label className="text-[#6b7280] text-xs font-mono uppercase tracking-wider">
              Token
            </Label>
            <select
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-[#ededed] focus:border-[#7c3aed]/50 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/30 text-sm cursor-pointer appearance-none transition-colors hover:bg-white/[0.05]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                paddingRight: '2.5rem',
              }}
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
            >
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="DAI">DAI</option>
              <option value="ETH">ETH</option>
            </select>
            <p className="text-xs text-[#6b7280] font-mono">
              Swapped to 0G native via Uniswap v4 before staking
            </p>
          </div>

          {/* Payout preview */}
          {payout && selectedSide && (
            <div className="flex items-center gap-3 glass-card rounded-xl p-4 border border-[#7c3aed]/20">
              <TrendingUp className="w-4 h-4 text-[#7c3aed]" />
              <div>
                <p className="text-xs text-[#6b7280] font-mono">Potential Payout</p>
                <p className="text-2xl font-black text-[#7c3aed]">
                  {payout} 0G
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleBet}
            disabled={isLoading || !selectedSide || !betAmount}
            className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-black font-bold rounded-xl py-3 transition-all hover:-translate-y-[2px]"
          >
            {isLoading ? "Placing Bet..." : "Place Bet"}
          </Button>
        </div>
      </main>
    </div>
  );
}
