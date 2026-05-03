"use client";

import Link from "next/link";

interface LineageNode {
  tokenId: number;
  name: string;
  generation: number;
  parentA?: LineageNode;
  parentB?: LineageNode;
}

interface LineageTreeProps {
  root: LineageNode;
}

export function LineageTree({ root }: LineageTreeProps) {
  const hasParents = root.parentA || root.parentB;

  return (
    <div className="glass-card rounded-2xl p-6 overflow-x-auto">
      {hasParents ? (
        <svg
          viewBox="0 0 600 220"
          className="w-full max-w-2xl mx-auto"
          style={{ minHeight: "220px" }}
        >
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="rgba(255,255,255,0.02)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="600" height="220" fill="url(#grid)" />

          {/* Connector lines */}
          <g stroke="rgba(124,58,237,0.3)" strokeWidth="1.5" fill="none" strokeDasharray="4,4">
            {root.parentA && (
              <path d="M 300 80 C 300 110 160 110 160 140" />
            )}
            {root.parentB && (
              <path d="M 300 80 C 300 110 440 110 440 140" />
            )}
          </g>

          {/* Root node */}
          <g transform="translate(220, 10)">
            <rect x="0" y="0" width="160" height="70" rx="10"
              fill="rgba(124,58,237,0.12)"
              stroke="rgba(124,58,237,0.4)"
              strokeWidth="1.5"
            />
            <text x="80" y="20" textAnchor="middle" fill="rgba(124,58,237,0.7)" fontSize="10" fontFamily="monospace">
              Gen {root.generation}
            </text>
            <text x="80" y="40" textAnchor="middle" fill="#ededed" fontSize="13" fontWeight="700">
              {root.name.length > 12 ? root.name.slice(0, 12) + "…" : root.name}
            </text>
            <text x="80" y="58" textAnchor="middle" fill="#6b7280" fontSize="10" fontFamily="monospace">
              #{root.tokenId}
            </text>
          </g>

          {/* Parent A */}
          {root.parentA && (
            <g transform="translate(80, 140)">
              <rect x="0" y="0" width="160" height="65" rx="8"
                fill="rgba(255,255,255,0.02)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text x="80" y="18" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">
                Parent A · Gen {root.parentA.generation}
              </text>
              <text x="80" y="36" textAnchor="middle" fill="#ededed" fontSize="12" fontWeight="600">
                {root.parentA.name.length > 14 ? root.parentA.name.slice(0, 14) + "…" : root.parentA.name}
              </text>
              <text x="80" y="52" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">
                #{root.parentA.tokenId}
              </text>
            </g>
          )}

          {/* Parent B */}
          {root.parentB && (
            <g transform="translate(360, 140)">
              <rect x="0" y="0" width="160" height="65" rx="8"
                fill="rgba(255,255,255,0.02)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text x="80" y="18" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">
                Parent B · Gen {root.parentB.generation}
              </text>
              <text x="80" y="36" textAnchor="middle" fill="#ededed" fontSize="12" fontWeight="600">
                {root.parentB.name.length > 14 ? root.parentB.name.slice(0, 14) + "…" : root.parentB.name}
              </text>
              <text x="80" y="52" textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace">
                #{root.parentB.tokenId}
              </text>
            </g>
          )}
        </svg>
      ) : (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl select-none opacity-20 font-black text-[#7c3aed]">◢◤</div>
          <p className="text-sm font-bold text-[#ededed]">Genesis Agent</p>
          <p className="text-xs text-[#6b7280]">
            This is a first-generation agent with no ancestors. Its lineage
            begins here.
          </p>
          <Link
            href="/breed"
            className="inline-flex text-xs font-mono text-[#7c3aed] hover:text-[#5b21b6] transition-colors"
          >
            Breed to create offspring →
          </Link>
        </div>
      )}
    </div>
  );
}
