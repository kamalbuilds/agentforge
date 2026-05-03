import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { zeroGGalileo } from "@agentforge/shared";
import { sepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "agentforge-dev";

// 0G Galileo is the primary chain. Sepolia kept as fallback for testnet devs.
export const wagmiConfig = getDefaultConfig({
  appName: "AgentForge",
  projectId,
  chains: [zeroGGalileo, sepolia],
  ssr: true,
});

export const TARGET_CHAIN_ID = 16601; // 0G Galileo Testnet
