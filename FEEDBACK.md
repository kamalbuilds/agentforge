# Uniswap Trade API: AgentForge Integration Feedback

## What Worked

**Quote endpoint clean and predictable:** The GET `/quote` endpoint returns well-structured response with all arena settlement essentials in a single call. Price impact, slippage, gas fee, and route string allow agents to estimate settlement costs off-chain and commit to them on-chain within a small confidence window. No separate calldata generation overhead.

**Universal Router calldata ready-to-broadcast:** The POST `/swap` endpoint returns `swap.to` and `swap.data` that can be submitted directly to the on-chain Universal Router without requiring agents to know internal SwapRouter02 logic. This separation of concerns (quote logic vs calldata generation) is clean.

**API key authentication simple:** Single header `x-api-key` is straightforward. No complex OAuth flows or session management. Works well for gateway server-to-gateway backend patterns.

**Chain abstraction via chainId parameter:** Tokenizing networks by ID rather than name or RPC endpoint lets arena settlement route quotes across multiple EVM chains if needed in future (e.g., to route through lowest-slippage venue).

## What Didn't

**Testnet support ambiguous:** Uniswap Trade API documentation doesn't explicitly state which testnets are supported (Sepolia, Goerli, etc.). Our 0G Galileo testnet is not a standard EVM testnet, so quote requests always fail with "chain not found" errors when using Galileo addresses. Required fallback to mock quotes for local testing.

**Rate limits not enforced visibly:** API returns 200 OK even for malformed amounts (e.g., swapping 1 wei of USDC). Should be rejected faster with a 400 + clear error. Also, no `RateLimit-Remaining` headers in response, so clients must guess at remaining quota.

**Error response inconsistency:** Some errors return JSON `{ error: "..." }`, others return HTML error pages (e.g., 503 Unavailable). Gateway wrapper had to inspect content-type to normalize errors.

**No batch quote endpoint:** Each swap needs a separate API call. Arena matches with 3+ trade routes (settle in ETH, USDC, DAI) require 3 sequential requests. Batch endpoint would reduce latency and request count.

## Bugs Hit

No critical bugs in the Uniswap Trade API itself. However, our integration hit a DNS resolution timeout on first deploy due to missing `x-api-key` header causing request hang. Added explicit timeout handling (5s default) in `packages/agent/src/onchain/uniswap.ts`.

## Docs Gaps

**Missing example: Server-side quote signing.** Documentation shows quote structure but not how to sign and commit to a quote server-side for later settlement. Arena operators need this to atomically bind quote and operator signature in a single transaction. Worked around with HMAC(quoteId + timestamp).

**No clear guidance on key scoping.** Can an API key be restricted by IP, domain, or rate limit tier? Current docs assume single unrestricted key per app. AgentForge would benefit from per-operator key scoping.

**Webhook retry semantics missing.** If Uniswap posts a swap status update (e.g., "swap mined"), how many retries do they attempt? What's the timeout? This matters for KeeperHub automation that waits for settlement confirmation.

**Real example: agent to agent settlement.** Would like to see a walkthrough of an agent-native pattern: agent signs quote, broadcasts via AXL, opponent accepts and they co-sign a settlement TX. Uniswap docs are currently EoA/UI-focused.

## DX Friction

**API key management for local dev.** Missing `UNISWAP_API_KEY` causes gateway startup to fail silently (routes return 501). Better would be: fail fast with a banner on startup, or provide a `--sandbox` flag that mocks the API locally. Added error banner in `packages/gateway/src/routes/uniswap.ts` that logs clearly if key is missing.

**Network detection.** Uniswap requires explicit chainId in every request. If an agent is configured for 0G Galileo but tries to route a quote on Ethereum, the API won't catch it. Would prefer `chainId` to be a header or context, not a query param on every call.

**Type mismatch: bips vs decimals.** Some fields use basis points (e.g., slippage as "500" = 5%), others use decimals. SDK doesn't validate or normalize, requiring each client to memorize the convention. Our gateway wrapper adds a validation schema to catch mismatches early.

## Missing Endpoints

**`GET /health`:** No way to check API availability before submitting quotes. Arena match settlement can't know if Uniswap is degraded. Would request a health endpoint returning `{ status: "ok", latency_ms: N }`.

**`GET /batch-quote`:** Submit 3+ quote requests in one POST, get back array of responses. Reduces round-trip latency for agents that want to consider multiple settlement routes.

**`GET /historical-prices`:** For agent training and memory, agents should see historical price paths. Currently they can only see spot price at quote time. Suggest endpoint: `GET /prices?token=0x...&from=timestamp&to=timestamp&interval=1h` returning OHLC candles.

**`POST /quote/commit`:** Server-side quote lock. Submit a quote, get back a commitment token valid for 10 minutes. Clients can then submit settlement TXs that reference the token, ensuring price doesn't slip between quote and settlement. Currently workaround with timestamp windowing.

## Wishlist

**Typed OpenAPI client generation:** Uniswap could publish an OpenAPI spec, enabling `openapi-generator` to emit TypeScript clients. Would eliminate our wrapper's type casting.

**Sandbox/test API key:** Separate test key that works with any chainId, returns deterministic mock responses (e.g., always 1% slippage, fixed 50k gas). Makes integration testing reproducible without needing real Sepolia RPC.

**Deterministic quote fixtures:** A `test=true` query param that returns the same quote every run for a given token pair. Enables contract unit tests to assert exact settlement amounts.

**Agent attribution hook:** When an agent requests a quote, allow callback to `https://...`, Uniswap posts the eventual settlement TX hash back. Enables agents to claim "I routed this trade" for reputation/commission models. Relevant for iNFT ecosystem where agent routing skill should be rewarded.

**On-chain integration:** Deploy a Uniswap oracle or adapter contract that AgentForge can call for quotes. Reduces external API dependency, improves censorship-resistance, and allows trustless settlement proofs on-chain.
