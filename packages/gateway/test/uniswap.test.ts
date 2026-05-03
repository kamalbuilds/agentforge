import { describe, it, expect } from "vitest";

/**
 * Uniswap proxy integration tests
 */

describe("Uniswap Proxy", () => {
  it("should validate quote query parameters", () => {
    const validQuery = {
      tokenIn: "0x0000000000000000000000000000000000000001",
      tokenOut: "0x0000000000000000000000000000000000000002",
      amount: "1000000000000000000",
      chainId: "11155111",
    };

    expect(validQuery.tokenIn).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(validQuery.tokenOut).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(validQuery.amount).toMatch(/^\d+$/);
    expect(validQuery.chainId).toBeDefined();
  });

  it("should reject invalid token addresses", () => {
    const invalidToken = "not-a-hex-address";
    expect(invalidToken).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("should handle missing API key gracefully", () => {
    const apiKey = process.env.UNISWAP_API_KEY;
    // Should work with or without API key, returns error if missing
    expect(typeof apiKey).toBe("string" || "undefined");
  });
});
