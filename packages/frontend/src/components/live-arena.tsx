"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame, Wifi, WifiOff, Swords } from "lucide-react";

interface LiveMatch {
  matchId: string;
  agentA: string;
  agentB: string;
  lastUpdate: Date;
}

export function LiveArena() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8787";

  useEffect(() => {
    const eventSource = new EventSource(`${GATEWAY_URL}/arena/stream`);
    eventSource.onopen    = () => setIsConnected(true);
    eventSource.onmessage = (event) => {
      try {
        const match: LiveMatch = { ...JSON.parse(event.data), lastUpdate: new Date() };
        setMatches((prev) => [match, ...prev.slice(0, 9)]);
      } catch {}
    };
    eventSource.onerror = () => setIsConnected(false);
    return () => eventSource.close();
  }, []);

  return (
    <div className="space-y-4">
      {/* Connection indicator */}
      <div className="flex items-center gap-2">
        {isConnected
          ? <Wifi className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
          : <WifiOff className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />
        }
        <span
          className="text-[10px] font-mono"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          {isConnected ? "Connected to arena stream" : "Awaiting connection..."}
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full ml-auto"
          style={{
            background: isConnected ? "#10b981" : "rgba(255,255,255,0.15)",
            boxShadow: isConnected ? "0 0 6px rgba(16,185,129,0.5)" : "none",
          }}
        />
      </div>

      {matches.length > 0 ? (
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.matchId}
              className="rounded-xl p-4 flex items-center justify-between animate-fade-up"
              style={{
                background: "rgba(220,38,38,0.05)",
                border: "1px solid rgba(220,38,38,0.15)",
              }}
            >
              <div>
                <p
                  className="font-semibold text-[#ededed] text-sm"
                  style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
                >
                  {match.agentA}
                  <span style={{ color: "#6b7280", margin: "0 8px" }}>vs</span>
                  {match.agentB}
                </p>
                <p
                  className="text-[10px] font-mono mt-0.5"
                  style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-space-mono), monospace" }}
                >
                  Match #{match.matchId} · {match.lastUpdate.toLocaleTimeString()}
                </p>
              </div>
              <div
                className="status-pill status-live animate-pulse"
              >
                <Flame className="w-2.5 h-2.5" />
                LIVE
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Creature collector empty state (not generic "No Active Matches")
        <div className="text-center py-14 space-y-4">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)" }}
          >
            <Swords className="w-6 h-6" style={{ color: "#dc2626", opacity: 0.6 }} />
          </div>
          <div className="space-y-1">
            <p
              className="font-semibold text-[#ededed]"
              style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              The arena is quiet.
            </p>
            <p className="text-sm text-white/30 max-w-xs mx-auto leading-relaxed">
              Be the first to issue a challenge. Connect your wallet and mint an agent to begin.
            </p>
          </div>
          <Link href="/mint">
            <Button
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white mt-1"
              style={{ background: "#7c3aed", fontFamily: "var(--font-space-grotesk), sans-serif" }}
            >
              Mint an Agent
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
