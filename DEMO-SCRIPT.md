# AgentForge Demo Script

3-minute narrative demo capturing the full agent lifecycle: mint, compete, breed.

## Scene Breakdown

### 0:00-0:15 HOOK (15 seconds)

**Voiceover:**
"Today, AI agents lack ownership. They can't compete, breed, or earn. AgentForge changes that by giving agents non-fungible identity."

**Visuals:**
- Title card: "AgentForge" with ERC-7857 iNFT badge
- Quick shots of blockchain network, AI training, competition
- Music: Upbeat, tech-forward

**Screen:** Static placeholder or landing page screenshot

---

### 0:15-0:45 MINT FLOW (30 seconds)

**Voiceover:**
"First, we mint an agent. We upload encrypted model weights, and AgentForge creates an ERC-7857 iNFT on 0G Chain."

**Pre-demo setup**: Run `python scripts/generate-demo-weights.py` once to generate the weight files in `demo/weights/`. Files are also committed for convenience.

**Actions (on localhost:3000/mint):**
1. Click "Create New Agent"
2. File picker appears, select pre-made weights file (e.g., `demo/weights/genesis-aurelius.safetensors`)
3. Show encryption progress spinner
4. "Uploading to 0G Storage..." appears
5. Spinner completes, show storage CID
6. Click "Mint iNFT"
7. Transaction sent modal appears
8. Wait for confirmation

**Parallel screen:**
- Open chainscan-galileo.0g.ai in background tab
- Show real AgentINFT contract
- Paste txHash when confirmation arrives
- Show transaction details confirming token mint

**Voiceover (continued):**
"The weights are encrypted and stored on 0G Storage. The iNFT is created on 0G Galileo. An ENS subname is registered at agentforge.eth."

**Key URLs:**
- Mint UI: http://localhost:3000/mint
- Chain explorer: https://chainscan-galileo.0g.ai
- Sample tx hash (from E2E-PROOF.md): Check recent iNFT transfers

---

### 0:45-1:30 ARENA DEMO (45 seconds)

**Voiceover:**
"Now our agent enters the Arena. It challenges another agent to a match. Both lock their stake, and the match runs off-chain with verifiable results."

**Actions (on localhost:3000/arena):**
1. Show list of minted agents with stats (token ID, ELO, wins, losses)
2. Click agent #2
3. Show agent details: Genesis agent, ELO 1200, 0 wins
4. Click "Challenge Opponent"
5. Modal: select opponent (agent #3), set stake (0.1 ETH)
6. Click "Challenge"
7. Show "Match Proposed" state
8. Opponent accepts (show AXL message relay in gateway logs, optional)
9. Match progress bar: "Simulating..." for ~5 seconds
10. Result appears: "Agent #2 wins! ELO: 1016"
11. Show loser ELO: 984

**Parallel screen:**
- Open gateway logs (or replay from saved logs)
- Show AXL messages: `arena.challenge`, `arena.accept`, `arena.result`
- Show contract state update on chainscan

**Voiceover (continued):**
"The match happens in real-time through the AXL peer mesh. The operator signs the result and submits it to the chain. ELO ratings update instantly."

**Key URLs:**
- Arena UI: http://localhost:3000/arena
- Sample match tx: https://chainscan-galileo.0g.ai/tx/{from E2E-PROOF.md}

---

### 1:30-2:15 BREEDING DEMO (45 seconds)

**Voiceover:**
"Our winning agent is strong. Let's breed it with agent #3 to create offspring with merged traits."

**Actions (on localhost:3000/breed):**
1. Show breeding marketplace
2. Click "New Breeding Request"
3. Modal: Select parent A (agent #2 winner), parent B (agent #3 runner-up)
4. Show breeding fee estimate (e.g., 0.05 ETH)
5. Click "Request Breed"
6. Transaction: set breeding approval on both parents first
7. Show ApprovalSet events on chainscan
8. Click "Request Breed" again
9. Show "Breed Request #0 Created"
10. Show "0G Compute processing trait merge..." (progress bar)
11. After ~10 seconds: "Offspring minted! Token #4"
12. Show offspring details: Generation 1, parentage (2 + 3), inherited ELO (1000)

**Parallel screen:**
- Show RoyaltyVault on chainscan
- Paste new offspring token ID
- Show parent owners now have royalty deposits waiting

**Voiceover (continued):**
"0G Compute decrypts the parent weights, merges their traits, and mints a new offspring with a generation counter. Parent owners earn royalty splits."

**Key URLs:**
- Breeding UI: http://localhost:3000/breed
- Breed request tx: https://chainscan-galileo.0g.ai/tx/{from E2E-PROOF.md}
- Offspring tx: https://chainscan-galileo.0g.ai/tx/{from E2E-PROOF.md}

---

### 2:15-2:45 ROYALTY DEMO (30 seconds)

**Voiceover:**
"The breeding fee is split between parent owners. They can claim their royalties with a simple transaction."

**Actions (on localhost:3000/profile):**
1. Show "My Royalties" section
2. Show pending claim from breeding (e.g., 0.025 ETH)
3. Click "Claim Royalty"
4. Wallet confirmation popup
5. Transaction confirmed
6. Show updated balance: Royalty moved to wallet
7. Show transaction on chainscan confirming transfer

**Voiceover (continued):**
"Royalties use a pull pattern, so they're safe from reentrancy and give owners control over when to claim."

**Key URLs:**
- Profile UI: http://localhost:3000/profile
- Claim tx: https://chainscan-galileo.0g.ai/tx/{from E2E-PROOF.md}

---

### 2:45-3:00 CLOSING (15 seconds)

**Voiceover:**
"AgentForge empowers agents with ownership, competition, and inheritance. Built on 0G Chain with ERC-7857, Uniswap routing, AXL messaging, and 0G Compute. The future of autonomous agents starts here."

**Visuals:**
- Montage of: mint screen, arena match result, breeding success, royalty claim
- Tech stack badges: 0G, Gensyn AXL, Uniswap, ENS, KeeperHub
- "Learn more at https://github.com/kamalbuilds/agentforge"
- Credits roll: Team members (optional)

---

## Recording Checklist

Before recording, ensure:

- [ ] `.env` configured with real DEPLOYER_PRIVATE_KEY and AGENT_OPERATOR_KEY
- [ ] Frontend running on http://localhost:3000
- [ ] Gateway running on http://localhost:3001 (optional, for AXL logs)
- [ ] 0G testnet RPC accessible (ZG_RPC_URL)
- [ ] Connected wallet has 0.5+ ETH (for gas + stakes)
- [ ] Sample agents pre-minted (token IDs 1, 2, 3) or create during demo
- [ ] Browser tabs prepared:
  - localhost:3000 (frontend)
  - chainscan-galileo.0g.ai (explorer)
  - Terminal with gateway logs (optional)

## Optional B-Roll

- Animated ERC-7857 iNFT transfer effect
- DNA helix for breeding visualization
- ELO curve for rating system
- Code snippet of AXL message schema
- 0G network diagram

## Music/SFX

- Intro: Tech startup ambient (0:00-0:15)
- Mint section: Mechanical click, success chime (0:15-0:45)
- Arena section: Action music, clash sound (0:45-1:30)
- Breeding section: Genetic splicing sound, growth theme (1:30-2:15)
- Royalty section: Cash register/coin drop (2:15-2:45)
- Closing: Uplifting build, final chord (2:45-3:00)

## Timing Notes

- Keep each scene snappy (no more than 2-3 transactions per section)
- Show real-time UI updates (don't jump-cut to success; let viewers see loading states)
- Pause on key visuals (ELO update, offspring generation) for 2-3 seconds
- Total runtime: 3:00 hard limit (judges will cut off longer videos)
