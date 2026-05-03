/**
 * Arena runner: long-poll for MATCH_PROPOSE, auto-accept if ELO delta < 200, run matches.
 */
import { keccak256, encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { ethers } from "ethers";
import { getConfig } from "../config.js";
import { logger } from "../logger.js";
import { recv, sendEnvelope } from "../axl/client.js";
import {
  buildEnvelope,
  operatorKeyToEd25519,
  decodeMessage,
  type MatchPropose,
  type MatchAccept,
  type Move,
  type AXLMessage,
} from "../axl/protocol.js";
import { resolveAgentEns } from "../ens/resolver.js";
import { getOnchainElo, encodeReportResult, getArenaAddress } from "../onchain/contracts.js";
import { executeTx } from "../onchain/keeperhub.js";
import { TraderStrategy } from "../strategies/trader.js";
import { DebaterStrategy } from "../strategies/debater.js";
import type { AgentStrategy, MatchState } from "../strategies/base.js";

const MAX_STAKE_WEI = BigInt("10000000000000000000"); // 10 ETH
const ARENA_TOPIC = "arena";
const ELO_DELTA_THRESHOLD = 200;
const MAX_ROUNDS = 5;

export async function startArenaRunner() {
  const config = getConfig();
  const ourTokenId = Number(config.AGENT_TOKEN_ID);
  const edPrivKey = operatorKeyToEd25519(config.AGENT_OPERATOR_KEY);

  logger.info({ tokenId: ourTokenId }, "Arena runner started, listening for MATCH_PROPOSE");

  // Long-poll loop
  while (true) {
    try {
      const messages = await recv(ARENA_TOPIC, 30_000);

      for (const msg of messages) {
        if (!msg.payload) continue;

        try {
          const parsed = decodeMessage(msg.payload);
          if (parsed.type !== "MATCH_PROPOSE") continue;

          const proposal = parsed as MatchPropose;

          // Check if proposal is for us
          if (proposal.toAgent !== ourTokenId) {
            logger.debug({ toAgent: proposal.toAgent }, "Proposal not for us");
            continue;
          }

          logger.info({ fromAgent: proposal.fromAgent, stake: proposal.stake }, "MATCH_PROPOSE received");

          // Check stake
          const stakeWei = BigInt(proposal.stake);
          if (stakeWei > MAX_STAKE_WEI) {
            logger.info(
              { stake: stakeWei.toString(), max: MAX_STAKE_WEI.toString() },
              "Stake too high, rejecting"
            );
            continue;
          }

          // Fetch opponent ELO
          const opponentElo = await getOnchainElo(BigInt(proposal.fromAgent)).catch(() => 1000);
          const ourElo = await getOnchainElo(BigInt(ourTokenId)).catch(() => 1000);
          const eloDelta = opponentElo - ourElo;

          logger.info(
            { opponentElo, ourElo, eloDelta, threshold: ELO_DELTA_THRESHOLD },
            "ELO check"
          );

          if (eloDelta >= ELO_DELTA_THRESHOLD) {
            logger.info({ eloDelta }, "Opponent ELO delta too high, rejecting");
            continue;
          }

          // Accept match
          const matchId = `${ourTokenId}-${proposal.fromAgent}-${proposal.timestamp}`;
          const acceptMsg: MatchAccept = {
            type: "MATCH_ACCEPT",
            matchId,
            fromAgent: ourTokenId,
            signature: "",
          };

          const envelope = await buildEnvelope(acceptMsg, edPrivKey);
          await sendEnvelope(msg.from, envelope, ARENA_TOPIC);

          logger.info({ matchId, opponent: proposal.fromAgent }, "MATCH_ACCEPT sent");

          // Run match
          await runMatch({
            matchId,
            opponentTokenId: proposal.fromAgent,
            stake: stakeWei,
            ourTokenId,
            edPrivKey,
          });
        } catch (err) {
          logger.warn({ err, payload: msg.payload }, "Error processing arena message");
        }
      }
    } catch (err) {
      logger.warn({ err }, "Error in arena recv loop");
      // Continue polling
    }
  }
}

async function runMatch(opts: {
  matchId: string;
  opponentTokenId: number;
  stake: bigint;
  ourTokenId: number;
  edPrivKey: Uint8Array;
}) {
  const config = getConfig();
  const strategy = createStrategy(config as ReturnType<typeof getConfig>);

  logger.info(
    { matchId: opts.matchId, opponent: opts.opponentTokenId },
    "Running match"
  );

  const state: MatchState = {
    matchId: opts.matchId,
    myTokenId: opts.ourTokenId,
    opponentTokenId: opts.opponentTokenId,
    round: 0,
    history: [],
    context: {},
  };

  strategy.onMatchStart(state);

  const moves: Move[] = [];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      state.round = round;

      // Decide move
      const decision = await strategy.decideMove(state);

      const moveMsg: Move = {
        type: "MOVE",
        matchId: opts.matchId,
        agent: opts.ourTokenId,
        payload: decision.payload,
      };

      moves.push(moveMsg);
      state.history.push({
        agent: opts.ourTokenId,
        round,
        payload: decision.payload,
        timestamp: Date.now(),
      });

      logger.debug({ matchId: opts.matchId, round }, "Sent MOVE");

      // TODO: receive opponent move and add to history
      // This requires bidirectional AXL message exchange
      // For now, assume strategy decides it's done after MAX_ROUNDS
    }

    // Match complete - determine winner (simplified: higher token ID)
    const winner = opts.ourTokenId >= opts.opponentTokenId ? opts.ourTokenId : opts.opponentTokenId;
    const won = winner === opts.ourTokenId;

    // Encode result
    const resultBytes = keccak256(
      encodeAbiParameters(
        parseAbiParameters("uint256 matchId, uint256 winner, uint256[] moves"),
        [BigInt(opts.matchId), BigInt(winner), moves.map((m) => BigInt(m.agent))]
      )
    );

    // Sign result with ECDSA operator key
    const provider = new ethers.JsonRpcProvider(config.ZG_RPC_URL);
    const signer = new ethers.Wallet(config.AGENT_OPERATOR_KEY, provider);
    const sig = await signer.signMessage(resultBytes);

    // Submit onchain via KeeperHub
    const calldata = encodeReportResult({
      matchId: BigInt(opts.matchId),
      winnerTokenId: BigInt(winner),
      resultHash: resultBytes,
      operatorSig: sig as Hex,
    });

    const result = await executeTx(getArenaAddress(), calldata, BigInt(0));
    logger.info({ matchId: opts.matchId, txHash: result.transactionHash, won }, "Match result submitted");

    strategy.onMatchEnd(opts.matchId, won);
  } catch (err) {
    logger.error({ err, matchId: opts.matchId }, "Error running match");
    strategy.onMatchEnd(opts.matchId, false);
    throw err;
  }
}

function createStrategy(config: ReturnType<typeof getConfig>): AgentStrategy {
  const strategy = (process.env.STRATEGY ?? "trader").toLowerCase();

  if (strategy === "debater") {
    return new DebaterStrategy({
      computeProviderAddress: config.ZG_COMPUTE_PROVIDER,
    });
  }

  return new TraderStrategy({
    computeProviderAddress: config.ZG_COMPUTE_PROVIDER,
  });
}
