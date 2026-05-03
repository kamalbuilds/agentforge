/**
 * Debater strategy: two LLM agents argue a topic.
 * A third judge model scores the debate.
 * All inference via 0G Compute.
 */
import { AgentStrategy, type MatchState, type MoveDecision } from "./base.js";
import { inference } from "../compute/zgCompute.js";
import { resolveAgentEns } from "../ens/resolver.js";
import { logger } from "../logger.js";

export interface DebateMovePayload {
  argument: string;
  round: number;
  stance: "FOR" | "AGAINST";
}

export interface JudgeScoreResult {
  winner: "FOR" | "AGAINST";
  forScore: number;
  againstScore: number;
  reasoning: string;
}

const DEFAULT_TOPICS = [
  "AI should be allowed to vote in democratic elections",
  "Decentralized finance will replace traditional banking by 2035",
  "Proof-of-work consensus is superior to proof-of-stake",
  "Smart contracts should be legally binding without human oversight",
];

export class DebaterStrategy extends AgentStrategy {
  private readonly computeProviderAddress: string;
  /** Provider address for the judge model (can differ from debater) */
  private readonly judgeProviderAddress: string;
  private stance: "FOR" | "AGAINST" = "FOR";
  private topic: string = DEFAULT_TOPICS[0]!;

  constructor(opts: {
    computeProviderAddress: string;
    judgeProviderAddress?: string;
  }) {
    super("debater");
    this.computeProviderAddress = opts.computeProviderAddress;
    this.judgeProviderAddress =
      opts.judgeProviderAddress ?? opts.computeProviderAddress;
  }

  override onMatchStart(state: MatchState): void {
    super.onMatchStart(state);
    // Assign stance based on tokenId parity
    this.stance = state.myTokenId % 2 === 0 ? "FOR" : "AGAINST";
    // Pick topic from context or hash-derive one
    if (typeof state.context["topic"] === "string") {
      this.topic = state.context["topic"];
    } else {
      const idx =
        (state.myTokenId + state.opponentTokenId) % DEFAULT_TOPICS.length;
      this.topic = DEFAULT_TOPICS[idx]!;
    }
    logger.info(
      { matchId: state.matchId, stance: this.stance, topic: this.topic },
      "debater match started"
    );
  }

  async decideMove(state: MatchState): Promise<MoveDecision> {
    const opponentHistory = state.history
      .filter((h) => h.agent === state.opponentTokenId)
      .slice(-3)
      .map((h) => {
        try {
          const parsed = JSON.parse(h.payload) as { argument?: string };
          return parsed.argument ?? h.payload;
        } catch {
          return h.payload;
        }
      });

    const myHistory = state.history
      .filter((h) => h.agent === state.myTokenId)
      .slice(-2)
      .map((h) => {
        try {
          const parsed = JSON.parse(h.payload) as { argument?: string };
          return parsed.argument ?? h.payload;
        } catch {
          return h.payload;
        }
      });

    const isFirstMove = myHistory.length === 0;

    const prompt = isFirstMove
      ? `You are a skilled debater. Your position: ${this.stance} the motion.

Motion: "${this.topic}"

Make a compelling opening argument (2-3 sentences max). Be direct and persuasive.
Respond with valid JSON only: {"argument":"<your opening argument>"}`
      : `You are a skilled debater. Your position: ${this.stance} the motion.

Motion: "${this.topic}"

Your previous arguments:
${myHistory.join("\n---\n")}

Opponent's recent arguments:
${opponentHistory.join("\n---\n")}

Round ${state.round}: Rebut the opponent and advance your position (2-3 sentences max).
Respond with valid JSON only: {"argument":"<your rebuttal and next argument>"}`;

    const result = await inference(this.computeProviderAddress, prompt);

    let argument = result.output;
    try {
      const parsed = JSON.parse(result.output) as { argument?: string };
      if (parsed.argument) argument = parsed.argument;
    } catch {
      // Use raw output
    }

    const payload: DebateMovePayload = {
      argument,
      round: state.round,
      stance: this.stance,
    };

    logger.info(
      { matchId: state.matchId, round: state.round, stance: this.stance },
      "debater made move"
    );

    return { payload: JSON.stringify(payload) };
  }

  async evaluateOpponent(opponentTokenId: number): Promise<number> {
    try {
      const profile = await resolveAgentEns(opponentTokenId);
      const elo = profile.elo ?? 1000;
      return elo / 2000; // normalize to 0-1 range
    } catch {
      return 0.5;
    }
  }

  /**
   * Judge a completed debate using a separate model.
   * Returns structured scoring with winner and reasoning.
   */
  async judgeDebate(
    topic: string,
    forArguments: string[],
    againstArguments: string[]
  ): Promise<JudgeScoreResult> {
    const prompt = `You are an impartial debate judge.

Motion: "${topic}"

FOR arguments:
${forArguments.map((a, i) => `[Round ${i + 1}] ${a}`).join("\n\n")}

AGAINST arguments:
${againstArguments.map((a, i) => `[Round ${i + 1}] ${a}`).join("\n\n")}

Score each side 0-100 on: logic, evidence, rhetoric, rebuttal quality.
Declare a winner. Respond with valid JSON only:
{"winner":"FOR"|"AGAINST","forScore":<number>,"againstScore":<number>,"reasoning":"<2 sentences>"}`;

    const result = await inference(this.judgeProviderAddress, prompt);

    let judgeResult: JudgeScoreResult = {
      winner: "FOR",
      forScore: 50,
      againstScore: 50,
      reasoning: result.output,
    };

    try {
      const parsed = JSON.parse(result.output) as Partial<JudgeScoreResult>;
      if (parsed.winner === "FOR" || parsed.winner === "AGAINST") {
        judgeResult = {
          winner: parsed.winner,
          forScore: Number(parsed.forScore ?? 50),
          againstScore: Number(parsed.againstScore ?? 50),
          reasoning: parsed.reasoning ?? result.output,
        };
      }
    } catch {
      // Keep default
    }

    logger.info({ winner: judgeResult.winner, topic }, "debate judged");

    return judgeResult;
  }
}
