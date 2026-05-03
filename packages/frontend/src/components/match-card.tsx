"use client";

import { Badge } from "@/components/ui/badge";
import { Swords, Flame } from "lucide-react";

interface MatchCardProps {
  matchId: string | number;
  agentA: string;
  agentB: string;
  statusA: string;
  statusB: string;
  winner?: string | null;
  isLive?: boolean;
}

export function MatchCard({
  matchId,
  agentA,
  agentB,
  statusA,
  statusB,
  winner,
  isLive = false,
}: MatchCardProps) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-[#6b7280]">Match #{matchId}</span>
        {isLive ? (
          <Badge className="bg-[#dc2626]/20 text-[#dc2626] border border-[#dc2626]/30 text-xs font-mono animate-pulse">
            <Flame className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
        ) : winner ? (
          <Badge className="bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 text-xs font-mono">
            {winner} Won
          </Badge>
        ) : null}
      </div>

      {/* Combatants */}
      <div className="grid grid-cols-3 gap-2 items-center">
        <div
          className={`p-3 rounded-lg text-center ${
            winner === agentA
              ? "bg-[#10b981]/10 border border-[#10b981]/20"
              : "bg-white/[0.02] border border-white/[0.06]"
          }`}
        >
          <p className="text-[10px] text-[#6b7280] font-mono mb-0.5">AGENT A</p>
          <p className="text-sm font-bold text-[#ededed] truncate">{agentA}</p>
          <p className="text-[10px] text-[#6b7280] mt-0.5">{statusA}</p>
        </div>

        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center">
            <Swords className="w-4 h-4 text-[#6b7280]" />
          </div>
        </div>

        <div
          className={`p-3 rounded-lg text-center ${
            winner === agentB
              ? "bg-[#10b981]/10 border border-[#10b981]/20"
              : "bg-white/[0.02] border border-white/[0.06]"
          }`}
        >
          <p className="text-[10px] text-[#6b7280] font-mono mb-0.5">AGENT B</p>
          <p className="text-sm font-bold text-[#ededed] truncate">{agentB}</p>
          <p className="text-[10px] text-[#6b7280] mt-0.5">{statusB}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center">
        <span className="text-[10px] text-[#6b7280] font-mono">
          {isLive ? "Battle in progress..." : "Match complete"}
        </span>
        <span className="text-[10px] text-[#7c3aed] font-mono">
          #{matchId}
        </span>
      </div>
    </div>
  );
}
