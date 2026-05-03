"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Cpu, TrendingUp } from "lucide-react";

interface AgentCardProps {
  tokenId: string | number;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  generation: number;
  owner: string;
}

export function AgentCard({
  tokenId,
  name,
  elo,
  wins,
  losses,
  generation,
  owner,
}: AgentCardProps) {
  const winRate =
    wins + losses > 0
      ? ((wins / (wins + losses)) * 100).toFixed(1)
      : "0";

  const eloPercent = Math.min((elo / 2000) * 100, 100);

  return (
    <Link href={`/agents/${tokenId}`}>
      <div className="glass-card rounded-2xl p-5 group hover:-translate-y-[2px] transition-all duration-200 cursor-pointer hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:border-[#7c3aed]/20">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="hex-clip w-10 h-10 bg-gradient-to-br from-[#7c3aed]/30 to-[#dc2626]/30 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-[#7c3aed]" />
            </div>
            <div>
              <h3 className="font-bold text-[#ededed] truncate max-w-[120px]">{name}</h3>
              <p className="text-xs text-[#6b7280] font-mono">#{tokenId}</p>
            </div>
          </div>
          <Badge className="bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20 text-xs font-mono">
            Gen {generation}
          </Badge>
        </div>

        {/* ELO bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-[#6b7280] font-mono">
              <TrendingUp className="w-3 h-3" />
              ELO
            </div>
            <span className="text-sm font-black text-[#7c3aed] font-mono">{elo}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#dc2626] transition-all"
              style={{ width: `${eloPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-[#6b7280] font-mono uppercase">W</p>
            <p className="text-lg font-black text-[#10b981] font-mono">{wins}</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-xs text-[#6b7280] font-mono uppercase">L</p>
            <p className="text-lg font-black text-[#dc2626] font-mono">{losses}</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-xs text-[#6b7280] font-mono uppercase">Win%</p>
            <p className="text-lg font-black text-[#ededed] font-mono">{winRate}%</p>
          </div>
        </div>

        {/* Owner */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <p className="text-xs text-[#6b7280] font-mono truncate max-w-[140px]">
            {owner.slice(0, 6)}...{owner.slice(-4)}
          </p>
          <span className="text-xs font-mono text-[#7c3aed] group-hover:text-[#5b21b6] transition-colors">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
