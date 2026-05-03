/**
 * Abstract AgentStrategy base class.
 * Subclasses implement decideMove and evaluateOpponent.
 */
import type { AXLRecvMessage } from "../axl/client.js";
import { logger } from "../logger.js";

export interface MatchState {
  matchId: string;
  myTokenId: number;
  opponentTokenId: number;
  round: number;
  history: MoveRecord[];
  /** Any domain-specific state (e.g. prices for trader, transcript for debater) */
  context: Record<string, unknown>;
}

export interface MoveRecord {
  agent: number;
  round: number;
  payload: string;
  timestamp: number;
}

export interface MoveDecision {
  payload: string;
}

export interface OpponentProfile {
  tokenId: number;
  /** ELO from ENS text record */
  elo?: number;
  wins?: number;
  losses?: number;
  bloodline?: string;
  ensName?: string;
}

export abstract class AgentStrategy {
  protected readonly strategyName: string;

  constructor(strategyName: string) {
    this.strategyName = strategyName;
  }

  /**
   * Decide the next move given current match state.
   * Must return a non-empty payload string.
   */
  abstract decideMove(state: MatchState): Promise<MoveDecision>;

  /**
   * Evaluate an opponent before accepting/rejecting a match.
   * Returns a numeric score (higher = more desirable opponent).
   */
  abstract evaluateOpponent(opponentTokenId: number): Promise<number>;

  /**
   * Handle incoming AXL messages relevant to this strategy.
   * Default: no-op. Subclasses can override to maintain state.
   */
  onMessage(_msg: AXLRecvMessage): void {
    // default no-op
  }

  /**
   * Called when a match starts. Set up any per-match state.
   */
  onMatchStart(state: MatchState): void {
    logger.info(
      { strategy: this.strategyName, matchId: state.matchId },
      "match started"
    );
  }

  /**
   * Called when a match ends with result.
   */
  onMatchEnd(matchId: string, won: boolean): void {
    logger.info(
      { strategy: this.strategyName, matchId, won },
      "match ended"
    );
  }
}
