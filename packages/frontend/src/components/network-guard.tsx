"use client";

import { useChainId, useSwitchChain, useAccount } from "wagmi";
import { TARGET_CHAIN_ID } from "@/lib/wagmi";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  // Only gate when wallet is connected and on wrong chain
  if (isConnected && chainId !== TARGET_CHAIN_ID) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="glass-card rounded-2xl p-10 max-w-sm w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-[#dc2626]" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#ededed]">Wrong Network</h2>
            <p className="text-sm text-[#6b7280] leading-relaxed">
              AgentForge runs on{" "}
              <span className="text-[#3b82f6] font-semibold">
                0G Galileo Testnet
              </span>
              . Switch networks to continue.
            </p>
          </div>
          <Button
            onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
            disabled={isPending}
            className="w-full bg-[#7c3aed] hover:bg-[#5b21b6] text-white font-semibold py-3 rounded-xl transition-all"
          >
            {isPending ? "Switching..." : "Switch to 0G Galileo"}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
