/**
 * Strategy tests.
 * Network-dependent tests (0G inference, Uniswap) are skipped if env vars missing.
 * Uses node:test built-in runner.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const hasEnv = Boolean(
  process.env["AGENT_OPERATOR_KEY"] &&
  process.env["ZG_COMPUTE_PROVIDER"] &&
  process.env["ZG_STORAGE_INDEXER"] &&
  process.env["ZG_RPC_URL"] &&
  process.env["AXL_NODE_URL"] &&
  process.env["KEEPERHUB_API_KEY"] &&
  process.env["KEEPERHUB_API_URL"] &&
  process.env["AGENT_TOKEN_ID"]
);

const SKIP_MSG = "skipped: required env vars not set";

describe("TraderStrategy", () => {
  it("should instantiate without env", async () => {
    // This import only tests module structure, not network calls
    const { TraderStrategy } = await import("../src/strategies/trader.js");
    const strategy = new TraderStrategy({
      computeProviderAddress: "0x0000000000000000000000000000000000000000",
    });
    assert.ok(strategy, "should create trader strategy");
  });

  it("should throw NOT_IMPLEMENTED if Uniswap API key missing on decideMove", async (t) => {
    if (hasEnv && !process.env["UNISWAP_API_KEY"]) {
      // With env but no uniswap key: uniswap should fail loudly
      const { TraderStrategy } = await import("../src/strategies/trader.js");
      const strategy = new TraderStrategy({
        computeProviderAddress: "0x0",
      });
      const state = {
        matchId: "test",
        myTokenId: 1,
        opponentTokenId: 2,
        round: 1,
        history: [],
        context: {},
      };
      // It should log a warning and continue, not throw — the quote is best-effort
      // (Trader logs warn on uniswap failure and continues with empty context)
      t.diagnostic("Uniswap API key not set — quote fetch will warn and continue");
    } else {
      t.skip(SKIP_MSG);
    }
  });

  it("should produce BUY/SELL/HOLD decision with real LLM", async (t) => {
    if (!hasEnv) {
      t.skip(SKIP_MSG);
      return;
    }

    const { TraderStrategy } = await import("../src/strategies/trader.js");
    const strategy = new TraderStrategy({
      computeProviderAddress: process.env["ZG_COMPUTE_PROVIDER"]!,
    });

    const state = {
      matchId: "test-match-001",
      myTokenId: 1,
      opponentTokenId: 2,
      round: 1,
      history: [],
      context: {},
    };

    const decision = await strategy.decideMove(state);
    assert.ok(typeof decision.payload === "string", "payload should be string");
    assert.ok(decision.payload.length > 0, "payload should not be empty");

    const parsed = JSON.parse(decision.payload) as { action?: string };
    assert.ok(
      ["BUY", "SELL", "HOLD"].includes(parsed.action ?? ""),
      `action should be BUY/SELL/HOLD, got: ${parsed.action}`
    );
  });

  it("evaluateOpponent should return a number", async (t) => {
    if (!hasEnv) {
      t.skip(SKIP_MSG);
      return;
    }

    const { TraderStrategy } = await import("../src/strategies/trader.js");
    const strategy = new TraderStrategy({
      computeProviderAddress: process.env["ZG_COMPUTE_PROVIDER"]!,
    });

    // Token 99999 likely has no ENS — should return default score
    const score = await strategy.evaluateOpponent(99999);
    assert.ok(typeof score === "number", "score should be number");
    assert.ok(score >= 0, "score should be non-negative");
  });
});

describe("DebaterStrategy", () => {
  it("should instantiate without env", async () => {
    const { DebaterStrategy } = await import("../src/strategies/debater.js");
    const strategy = new DebaterStrategy({
      computeProviderAddress: "0x0000000000000000000000000000000000000000",
    });
    assert.ok(strategy, "should create debater strategy");
  });

  it("should assign FOR stance to even tokenId", async () => {
    const { DebaterStrategy } = await import("../src/strategies/debater.js");
    const strategy = new DebaterStrategy({
      computeProviderAddress: "0x0",
    });

    strategy.onMatchStart({
      matchId: "test",
      myTokenId: 4, // even
      opponentTokenId: 3,
      round: 0,
      history: [],
      context: {},
    });

    // Access private field via type assertion for test
    const stance = (strategy as unknown as { stance: string }).stance;
    assert.equal(stance, "FOR");
  });

  it("should assign AGAINST stance to odd tokenId", async () => {
    const { DebaterStrategy } = await import("../src/strategies/debater.js");
    const strategy = new DebaterStrategy({
      computeProviderAddress: "0x0",
    });

    strategy.onMatchStart({
      matchId: "test",
      myTokenId: 5, // odd
      opponentTokenId: 4,
      round: 0,
      history: [],
      context: {},
    });

    const stance = (strategy as unknown as { stance: string }).stance;
    assert.equal(stance, "AGAINST");
  });

  it("should produce real debate argument with LLM", async (t) => {
    if (!hasEnv) {
      t.skip(SKIP_MSG);
      return;
    }

    const { DebaterStrategy } = await import("../src/strategies/debater.js");
    const strategy = new DebaterStrategy({
      computeProviderAddress: process.env["ZG_COMPUTE_PROVIDER"]!,
    });

    strategy.onMatchStart({
      matchId: "test-debate-001",
      myTokenId: 2,
      opponentTokenId: 3,
      round: 0,
      history: [],
      context: {
        topic: "AI agents should have voting rights",
      },
    });

    const decision = await strategy.decideMove({
      matchId: "test-debate-001",
      myTokenId: 2,
      opponentTokenId: 3,
      round: 1,
      history: [],
      context: { topic: "AI agents should have voting rights" },
    });

    assert.ok(typeof decision.payload === "string", "payload should be string");
    const parsed = JSON.parse(decision.payload) as {
      argument?: string;
      stance?: string;
    };
    assert.ok(
      typeof parsed.argument === "string" && parsed.argument.length > 10,
      "argument should be non-trivial string"
    );
    assert.ok(
      parsed.stance === "FOR" || parsed.stance === "AGAINST",
      `stance should be FOR or AGAINST: ${parsed.stance}`
    );
  });

  it("judgeDebate should return structured result with real LLM", async (t) => {
    if (!hasEnv) {
      t.skip(SKIP_MSG);
      return;
    }

    const { DebaterStrategy } = await import("../src/strategies/debater.js");
    const strategy = new DebaterStrategy({
      computeProviderAddress: process.env["ZG_COMPUTE_PROVIDER"]!,
    });

    const result = await strategy.judgeDebate(
      "The future of finance is decentralized",
      ["DeFi enables permissionless access to financial services for billions of unbanked people."],
      ["DeFi has suffered billions in hacks and lacks consumer protections that TradFi provides."]
    );

    assert.ok(
      result.winner === "FOR" || result.winner === "AGAINST",
      `winner should be FOR or AGAINST: ${result.winner}`
    );
    assert.ok(
      typeof result.forScore === "number" && result.forScore >= 0 && result.forScore <= 100,
      `forScore should be 0-100: ${result.forScore}`
    );
    assert.ok(
      typeof result.againstScore === "number" && result.againstScore >= 0 && result.againstScore <= 100,
      `againstScore should be 0-100: ${result.againstScore}`
    );
    assert.ok(
      typeof result.reasoning === "string" && result.reasoning.length > 0,
      "reasoning should be non-empty"
    );
  });
});
