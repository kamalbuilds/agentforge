"use client";

export function PrizeBanner() {
  return (
    <div className="glass-card rounded-xl p-4 text-center border border-[#7c3aed]/20">
      <p className="text-sm text-[#ededed]/70 font-mono">
        Powered by{" "}
        <span className="text-[#3b82f6]">0G Labs</span> ·{" "}
        <span className="text-[#10b981]">Gensyn AXL</span> ·{" "}
        <span className="text-[#8b5cf6]">ENS</span> ·{" "}
        <span className="text-[#f59e0b]">KeeperHub</span> ·{" "}
        <span className="text-[#ff007a]">Uniswap</span>{" "}
        · ETHGlobal 2026
      </p>
    </div>
  );
}
