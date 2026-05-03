# AgentForge ENS Live Resolution Proof

## Summary

AgentForge agent subnames resolve via ENS CCIP-Read (EIP-3668). The OffchainResolver contract on Sepolia emits `OffchainLookup`, directing ENS clients to our gateway which reads live state from 0G Galileo (chainId 16602) and returns a signed response verified on-chain.

## Deployment Details

| Field | Value |
| --- | --- |
| ENS Name | `agentforge.eth` (Sepolia testnet) |
| OffchainResolver | `0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65` (Sepolia) |
| CCIP Signer | `0x4e0C2BF7D126610d94954c86F656593513828B0a` |
| Gateway URL | https://7bbd-15-235-216-206.ngrok-free.app |
| ENS App | https://sepolia.app.ens.domains/agentforge.eth |
| Etherscan (Resolver) | https://sepolia.etherscan.io/address/0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65 |

Note: The ngrok gateway URL changes on restart. During the judging window the gateway is running locally with the URL above. For production, the gateway should be deployed to a stable endpoint.

## Transaction Hashes (Sepolia)

| Action | Tx Hash |
| --- | --- |
| OffchainResolver deploy | `0x3aaa81d989a69dc081453d533591dcfe11f596559f7c88753b727f5f694b4db8` |
| ENS commit (agentforge.eth) | `0x45b2bde5c02966f79c6b01c8dc69f0e646835b1856cc794a9988b1d3d6d11ed7` |
| ENS register (agentforge.eth) | `0x93451a80865511402805ea5fc3a85cc9933c87d70db745c097f6ad4b1338690d` |

## How CCIP-Read Works Here

1. Client calls `resolve(dnsEncodedName, data)` on OffchainResolver (Sepolia)
2. Contract reverts with `OffchainLookup(sender, urls, callData, callbackFn, extraData)`
3. ENS-aware client (viem, ethers, ENS app) fetches `GET <url>/{sender}/{data}.json`
4. Gateway decodes `addr()` or `text()` call, reads live state from 0G Galileo:
   - `addr(bytes32 node)` reads `AgentINFT.ownerOf(tokenId)` on 0G Galileo
   - `text(bytes32 node, "elo")` reads `Arena.getElo(tokenId)` on 0G Galileo
   - `text(bytes32 node, "wins")` reads `Arena.getWins(tokenId)`
   - `text(bytes32 node, "losses")` reads `Arena.getLosses(tokenId)`
   - `text(bytes32 node, "bloodline")` reads `Arena.getBloodline(tokenId)`
5. Gateway signs the result with CCIP_SIGNER_KEY using EIP-3668 message format:
   `keccak256(0x1900 + resolver_address + expires + keccak256(request) + keccak256(result))`
6. Client calls `resolveWithProof(response, extraData)` on-chain
7. Contract verifies the signature matches the known `signer` address
8. Returns the ABI-decoded result to the caller

## Live Gateway Test

```bash
# GET (EIP-3668 standard URL template)
curl "https://7bbd-15-235-216-206.ngrok-free.app/ccip/0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65/0x3b3b57de0000000000000000000000000000000000000000000000000000000000000001.json" \
  -H "ngrok-skip-browser-warning: true"

# Response: ABI-encoded (bytes result, uint64 expires, bytes signature)
# Decoded result contains: 0xbB908F53e6A8B9628Cd0884F75AaDbE912Fd920b (owner of agent #1)

# POST (alternative for testing)
curl -X POST "https://7bbd-15-235-216-206.ngrok-free.app/ccip/lookup" \
  -H "Content-Type: application/json" \
  -d '{"sender": "0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65", "data": "0x3b3b57de0000000000000000000000000000000000000000000000000000000000000001"}'
```

## Expected Resolution Values for `1.agentforge.eth`

| Record | Expected Value | Source |
| --- | --- | --- |
| `addr()` | `0xbB908F53e6A8B9628Cd0884F75AaDbE912Fd920b` | `AgentINFT.ownerOf(1)` on 0G Galileo |
| `text("elo")` | 1000+ | `Arena.getElo(1)` on 0G Galileo |
| `text("wins")` | 1 | `Arena.getWins(1)` on 0G Galileo |
| `text("losses")` | 0 | `Arena.getLosses(1)` on 0G Galileo |
| `text("bloodline")` | genesis bloodline | `Arena.getBloodline(1)` on 0G Galileo |

## Contract Source

OffchainResolver source: `packages/contracts/src/OffchainResolver.sol`

- Implements ENSIP-10 `IExtendedResolver` (`supportsInterface(0x9061b923)`)
- `resolve(bytes, bytes)` always reverts with `OffchainLookup` per EIP-3668
- `resolveWithProof(bytes, bytes)` verifies ECDSA signature against configured `signer`
- Immutable `signer` address set at construction from `CCIP_SIGNER_KEY`
