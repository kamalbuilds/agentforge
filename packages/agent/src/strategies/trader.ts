/**
 * Trader strategy: uses 0G Compute inference to decide BUY/SELL/HOLD
 * on a token pair by fetching real Uniswap quotes and LLM analysis.
 */
import { AgentStrategy, type MatchState, type MoveDecision } from "./base.js";
import { inference } from "../compute/zgCompute.js";
import { getQuote } from "../onchain/uniswap.js";
import { resolveAgentEns } from "../ens/resolver.js";
import { logger } from "../logger.js";

// Well-known token addresses on mainnet (used for quote reference)
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MAINNET_CHAIN_ID = 1;

export type TradeAction = "BUY" | "SELL" | "HOLD";

export interface TradeDecisionPayload {
  action: TradeAction;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  reasoning: string;
  quoteOut?: string;
}

export class TraderStrategy extends AgentStrategy {
  private readonly tokenIn: string;
  private readonly tokenOut: string;
  private readonly tradeAmount: string;
  private readonly computeProviderAddress: string;

  constructor(opts: {
    tokenIn?: string;
    tokenOut?: string;
    tradeAmount?: string;
    computeProviderAddress: string;
  }) {
    super("trader");
    this.tokenIn = opts.tokenIn ?? WETH;
    this.tokenOut = opts.tokenOut ?? USDC;
    this.tradeAmount = opts.tradeAmount ?? "1000000000000000000"; // 1 ETH in wei
    this.computeProviderAddress = opts.computeProviderAddress;
  }

  async decideMove(state: MatchState): Promise<MoveDecision> {
    // Fetch real Uniswap quote for current market context
    let quoteContext = "No quote available";
    let quoteOut: string | undefined;

    try {
      const quote = await getQuote({
        tokenInChainId: MAINNET_CHAIN_ID,
        tokenOutChainId: MAINNET_CHAIN_ID,
        tokenIn: this.tokenIn,
        tokenOut: this.tokenOut,
        amount: this.tradeAmount,
        type: "EXACT_INPUT",
      });
      quoteOut = quote.quote.output.amount;
      quoteContext = JSON.stringify({
        inputAmount: quote.quote.input.amount,
        outputAmount: quoteOut,
        priceImpact: quote.quote.priceImpact,
        gasFeeUSD: quote.quote.gasFeeUSD,
        routeString: quote.quote.routeString,
      });
    } catch (err) {
      logger.warn({ err }, "trader: uniswap quote fetch failed, using empty context");
    }

    // Build LLM prompt with market data
    const historyStr =
      state.history.length > 0
        ? state.history
            .slice(-5)
            .map((h) => `Round ${h.round} agent ${h.agent}: ${h.payload}`)
            .join("\n")
        : "No prior moves";

    const prompt = `You are a DeFi trading agent competing in an arena match.

Current market data for ${this.tokenIn} → ${this.tokenOut}:
${quoteContext}

Match context:
- Round: ${state.round}
- My token ID: ${state.myTokenId}
- Opponent token ID: ${state.opponentTokenId}
- Match ID: ${state.matchId}

Recent move history:
${historyStr}

Your goal is to maximize PnL vs opponent. Decide: BUY, SELL, or HOLD.
Respond with valid JSON only:
{"action":"BUY"|"SELL"|"HOLD","reasoning":"<one sentence>"}`;

    const result = await inference(this.computeProviderAddress, prompt);

    let action: TradeAction = "HOLD";
    let reasoning = result.output;

    try {
      const parsed = JSON.parse(result.output) as {
        action?: string;
        reasoning?: string;
      };
      if (
        parsed.action === "BUY" ||
        parsed.action === "SELL" ||
        parsed.action === "HOLD"
      ) {
        action = parsed.action;
      }
      if (parsed.reasoning) reasoning = parsed.reasoning;
    } catch {
      // LLM didn't return JSON — extract action from text
      if (result.output.toUpperCase().includes("BUY")) action = "BUY";
      else if (result.output.toUpperCase().includes("SELL")) action = "SELL";
    }

    const decision: TradeDecisionPayload = {
      action,
      tokenIn: this.tokenIn,
      tokenOut: this.tokenOut,
      amount: this.tradeAmount,
      reasoning,
      quoteOut,
    };

    logger.info({ matchId: state.matchId, round: state.round, action }, "trader decided");

    return { payload: JSON.stringify(decision) };
  }

  async evaluateOpponent(opponentTokenId: number): Promise<number> {
    try {
      const profile = await resolveAgentEns(opponentTokenId);
      const elo = profile.elo ?? 1000;
      const wins = profile.wins ?? 0;
      const losses = profile.losses ?? 0;
      const winRate = wins + losses > 0 ? wins / (wins + losses) : 0.5;
      // Score: prefer opponents near our assumed ELO (1200) with decent win rate
      return 1 / (1 + Math.abs(elo - 1200)) + winRate;
    } catch {
      return 0.5; // default score if ENS lookup fails
    }
  }
}
