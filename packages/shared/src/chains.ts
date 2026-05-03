import { defineChain } from "viem";

export const zeroGGalileo = defineChain({
  id: 16601,
  name: "0G Galileo Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "0G",
    symbol: "0G"
  },
  rpcUrls: {
    default: {
      http: ["https://evmrpc-testnet.0g.ai"]
    }
  },
  blockExplorers: {
    default: {
      name: "0G Galileo Explorer",
      url: "https://chainscan-galileo.0g.ai"
    }
  },
  testnet: true
});

export const sepoliaChainId = 11155111;

export const supportedChains = [zeroGGalileo] as const;
