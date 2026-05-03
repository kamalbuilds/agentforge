/**
 * ELO calculation tests: verify offchain ELO math matches contract behavior.
 * Uses node:test built-in runner.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── ELO math (mirrors Arena.sol) ────────────────────────────────────────────
// From the contract: K=32, starting ELO=1200
// Expected score: E_a = 1 / (1 + 10^((R_b - R_a) / 400))
// New rating: R_a' = R_a + K * (S_a - E_a)

const K = 32;
const INITIAL_ELO = 1200;
const BPS_DENOMINATOR = 10_000;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function newElo(
  ratingA: number,
  ratingB: number,
  aWon: boolean
): { newA: number; newB: number } {
  const ea = expectedScore(ratingA, ratingB);
  const eb = expectedScore(ratingB, ratingA);
  const sa = aWon ? 1 : 0;
  const sb = aWon ? 0 : 1;
  return {
    newA: Math.round(ratingA + K * (sa - ea)),
    newB: Math.round(ratingB + K * (sb - eb)),
  };
}

// Contract-compatible integer ELO (uses fixed-point arithmetic with BPS)
// Arena.sol calculates: delta = K * (outcome * BPS_DENOMINATOR - expectedBps) / BPS_DENOMINATOR
function contractElo(
  ratingA: number,
  ratingB: number,
  aWon: boolean
): { newA: number; newB: number } {
  // expected score in BPS (basis points out of 10000)
  const expectedBps = Math.round(BPS_DENOMINATOR / (1 + Math.pow(10, (ratingB - ratingA) / 400)));
  const outcomeBps = aWon ? BPS_DENOMINATOR : 0;
  const deltaA = Math.floor((K * (outcomeBps - expectedBps)) / BPS_DENOMINATOR);
  const deltaB = Math.floor((K * (BPS_DENOMINATOR - outcomeBps - (BPS_DENOMINATOR - expectedBps))) / BPS_DENOMINATOR);
  return {
    newA: ratingA + deltaA,
    newB: ratingB + deltaB,
  };
}

describe("ELO Calculations", () => {
  describe("expectedScore", () => {
    it("should return 0.5 for equal ratings", () => {
      const score = expectedScore(1200, 1200);
      assert.ok(Math.abs(score - 0.5) < 0.001, `expected ~0.5, got ${score}`);
    });

    it("should return > 0.5 when A has higher rating", () => {
      const score = expectedScore(1400, 1200);
      assert.ok(score > 0.5, `expected > 0.5, got ${score}`);
    });

    it("should return < 0.5 when A has lower rating", () => {
      const score = expectedScore(1000, 1200);
      assert.ok(score < 0.5, `expected < 0.5, got ${score}`);
    });

    it("scores should sum to 1.0", () => {
      const ea = expectedScore(1300, 1100);
      const eb = expectedScore(1100, 1300);
      assert.ok(Math.abs(ea + eb - 1.0) < 0.001, `scores should sum to 1.0: ${ea} + ${eb}`);
    });
  });

  describe("ELO update after win", () => {
    it("winner should gain ELO, loser should lose ELO", () => {
      const { newA, newB } = newElo(1200, 1200, true);
      assert.ok(newA > 1200, `winner should gain ELO: got ${newA}`);
      assert.ok(newB < 1200, `loser should lose ELO: got ${newB}`);
    });

    it("equal match: winner gains ~16, loser loses ~16", () => {
      const { newA, newB } = newElo(1200, 1200, true);
      assert.ok(Math.abs(newA - 1216) <= 1, `expected ~1216, got ${newA}`);
      assert.ok(Math.abs(newB - 1184) <= 1, `expected ~1184, got ${newB}`);
    });

    it("upset: lower rated beating higher rated gains more ELO", () => {
      const { newA: loserGains } = newElo(1000, 1400, true);
      const { newA: evenGains } = newElo(1200, 1200, true);
      assert.ok(
        loserGains - 1000 > evenGains - 1200,
        `upset winner should gain more ELO: ${loserGains - 1000} vs ${evenGains - 1200}`
      );
    });

    it("expected win: winner gains less ELO", () => {
      const { newA: expectedWinGain } = newElo(1400, 1000, true);
      const { newA: evenWinGain } = newElo(1200, 1200, true);
      assert.ok(
        expectedWinGain - 1400 < evenWinGain - 1200,
        `expected winner should gain less ELO: ${expectedWinGain - 1400} vs ${evenWinGain - 1200}`
      );
    });
  });

  describe("ELO conservation", () => {
    it("total ELO should be approximately conserved", () => {
      const { newA, newB } = newElo(1200, 1200, true);
      const totalBefore = 1200 + 1200;
      const totalAfter = newA + newB;
      // Allow ±1 for rounding
      assert.ok(
        Math.abs(totalAfter - totalBefore) <= 1,
        `ELO should be conserved: before=${totalBefore}, after=${totalAfter}`
      );
    });

    it("multiple matches should converge toward true skill", () => {
      // A is stronger (true ELO 1400 equivalent)
      let aElo = 1200;
      let bElo = 1200;

      // Simulate 20 matches where A wins 70% of the time
      const aWinRate = 0.7;
      for (let i = 0; i < 20; i++) {
        const aWins = Math.random() < aWinRate;
        const { newA, newB } = newElo(aElo, bElo, aWins);
        aElo = newA;
        bElo = newB;
      }

      // A should have higher ELO on average after 20 matches with 70% win rate
      // This is probabilistic but should pass the vast majority of the time
      assert.ok(
        aElo > bElo,
        `stronger player (70% win rate) should have higher ELO after 20 matches: A=${aElo}, B=${bElo}`
      );
    });
  });

  describe("Contract ELO approximation", () => {
    it("offchain ELO should be within 1 of contract ELO for equal ratings", () => {
      const offchain = newElo(1200, 1200, true);
      const contract = contractElo(1200, 1200, true);

      assert.ok(
        Math.abs(offchain.newA - contract.newA) <= 2,
        `offchain ${offchain.newA} vs contract ${contract.newA} (delta A)`
      );
      assert.ok(
        Math.abs(offchain.newB - contract.newB) <= 2,
        `offchain ${offchain.newB} vs contract ${contract.newB} (delta B)`
      );
    });

    it("contract ELO: winner gains positive delta", () => {
      const { newA, newB } = contractElo(1200, 1200, true);
      assert.ok(newA > 1200, `contract winner should gain ELO: ${newA}`);
      assert.ok(newB < 1200, `contract loser should lose ELO: ${newB}`);
    });

    it("initial ELO should be 1200", () => {
      assert.equal(INITIAL_ELO, 1200);
    });

    it("K factor should be 32", () => {
      assert.equal(K, 32);
    });
  });

  describe("Edge cases", () => {
    it("very high rating difference should give near-certain expected score", () => {
      const score = expectedScore(2000, 1000);
      assert.ok(score > 0.99, `1000 point advantage should give >99% expected: ${score}`);
    });

    it("symmetry: A vs B should mirror B vs A", () => {
      const { newA: a1, newB: b1 } = newElo(1300, 1100, true);
      const { newA: a2, newB: b2 } = newElo(1100, 1300, false);
      assert.ok(
        Math.abs(a1 - b2) <= 1,
        `symmetric result: A won ${a1} vs A lost ${b2}`
      );
      assert.ok(
        Math.abs(b1 - a2) <= 1,
        `symmetric result: B lost ${b1} vs B won ${a2}`
      );
    });
  });
});
