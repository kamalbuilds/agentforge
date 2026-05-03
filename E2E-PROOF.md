# AgentForge E2E Integration Proof

**Date:** 2026-05-03T07:22:10.541Z
**Chain:** 0G Galileo (chainId 16601)
**Deployer:** `0xbB908F53e6A8B9628Cd0884F75AaDbE912Fd920b`

## Contract Addresses
- AgentINFT: `0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65`
- Arena: `0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8`
- BreedingMarket: `0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d`
- RoyaltyVault: `0xDF37dD02319Fa1c538DcACA064a7919446dAa924`

## Test Results
- Agents minted: 2, 3
- Match ID: 0
- Breed Request ID: 0
- Offspring Token ID: 4

## Transaction Hashes

### reportResult
- Hash: `0xddc547a6c4300431c022ece22784274d5fb544c37057621aeda2f474f5a1323b`
- Explorer: https://chainscan-galileo.0g.ai/tx/0xddc547a6c4300431c022ece22784274d5fb544c37057621aeda2f474f5a1323b

### setBreedingOperator
- Hash: `0xecff74b7701b8818fd40c0ad4e17c72487367bccf10d7a5e946803f2d7bbf29d`
- Explorer: https://chainscan-galileo.0g.ai/tx/0xecff74b7701b8818fd40c0ad4e17c72487367bccf10d7a5e946803f2d7bbf29d

### setBreedingApproval(2, true)
- Hash: `0xcf4f6747d26ed571cada23752bc52203549d947b253df831507d9a7a538d4c5a`
- Explorer: https://chainscan-galileo.0g.ai/tx/0xcf4f6747d26ed571cada23752bc52203549d947b253df831507d9a7a538d4c5a

### setBreedingApproval(3, true)
- Hash: `0x013a509c62710b2a905b28cfb30af8b4de04dbbdcd157d3b347090fd254292b5`
- Explorer: https://chainscan-galileo.0g.ai/tx/0x013a509c62710b2a905b28cfb30af8b4de04dbbdcd157d3b347090fd254292b5

### requestBreed
- Hash: `0x42d684909ca60f4f2b6ecad1dc73b9f7193b596ece1bfdff8cdfb1a9f8ff4343`
- Explorer: https://chainscan-galileo.0g.ai/tx/0x42d684909ca60f4f2b6ecad1dc73b9f7193b596ece1bfdff8cdfb1a9f8ff4343

### fulfillBreed
- Hash: `0xd8617509af292c831e2feb9b39be39c4b941a350abbbe15340936638860c4869`
- Explorer: https://chainscan-galileo.0g.ai/tx/0xd8617509af292c831e2feb9b39be39c4b941a350abbbe15340936638860c4869

### RoyaltyVault.deposit
- Hash: `0x3bb6bd707bed5012e075fd7f5235dfe4824c690e2bf84c62702cafa1717d7bfd`
- Explorer: https://chainscan-galileo.0g.ai/tx/0x3bb6bd707bed5012e075fd7f5235dfe4824c690e2bf84c62702cafa1717d7bfd

### RoyaltyVault.claim
- Hash: `0xe029abf8956a3a3eb1ceebe4393bfb429950b3f67da9677c621b35f4d425e347`
- Explorer: https://chainscan-galileo.0g.ai/tx/0xe029abf8956a3a3eb1ceebe4393bfb429950b3f67da9677c621b35f4d425e347

## Final State
- Agent #2 and #3 minted and owned by deployer
- Match between #2 and #3 completed, #2 won, ELO updated
- Offspring #4 bred from #2 x #3
- Royalty split registered in RoyaltyVault
- Royalty deposited and claimed successfully

All phases passed. Real onchain state verified.