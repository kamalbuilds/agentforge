import { createPublicClient, http } from "viem";
import { zeroGGalileo } from "@agentforge/shared";
import { getConfig } from "../config.js";

const config = getConfig();

export const clients = {
  zeroG: createPublicClient({
    chain: zeroGGalileo,
    transport: http(config.RPC_URL_0G),
  }),
};
