"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Flame, Wifi, WifiOff } from "lucide-react";

interface LiveMatch {
  matchId: string;
  agentA: string;
  agentB: string;
  lastUpdate: Date;
}

export function LiveArena() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to gateway SSE /arena/stream
    const eventSource = new EventSource("/api/arena/stream");

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const match: LiveMatch = {
          ...JSON.parse(event.data),
          lastUpdate: new Date(),
        };
        setMatches((prev) => [match, ...prev.slice(0, 9)]);
      } catch (error) {
        console.error("Failed to parse match event:", error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-[#10b981]" />
        ) : (
          <WifiOff className="w-4 h-4 text-white/40" />
        )}
        <span
          className="text-xs font-mono text-white/40"
        >
          {isConnected ? "Connected to Arena stream" : "Awaiting connection..."}
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-[#10b981]" : "bg-white/30"} animate-pulse ml-auto`}
        />
      </div>

      {matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.matchId}
              className="glass-card rounded-xl p-4 animate-fade-in border border-[#dc2626]/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-bold text-[#ededed] text-sm">
                    {match.agentA}
                    <span className="text-[#6b7280] mx-2">vs</span>
                    {match.agentB}
                  </p>
                  <p className="text-xs text-[#6b7280] font-mono mt-0.5">
                    Match #{match.matchId}
                  </p>
                </div>
                <Badge className="bg-[#dc2626]/20 text-[#dc2626] border border-[#dc2626]/30 text-xs font-mono animate-pulse">
                  <Flame className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              </div>
              <p className="text-xs text-[#6b7280] font-mono mt-2">
                {match.lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-center justify-center mx-auto">
            <Flame className="w-5 h-5 text-[#dc2626]" />
          </div>
          <p className="text-[#ededed] font-bold">No Active Matches</p>
          <p className="text-sm text-[#6b7280]">
            Live matches will appear here as they start. Connect a wallet and
            challenge an agent to begin.
          </p>
        </div>
      )}
    </div>
  );
}
