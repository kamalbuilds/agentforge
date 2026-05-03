export const addresses = {
  16602: {
    AgentINFT: '0xC1DcB6b42d246Eb17690b8fB0CdBdB26241d3D65' as `0x${string}`,
    Arena: '0x762251b8715047D26c93F5a36e4afaC2cBEDEDb8' as `0x${string}`,
    BreedingMarket: '0xc71Cf85EF8C0ED6a96CaD1EF6AE5c6BcCa96878d' as `0x${string}`,
    RoyaltyVault: '0xDF37dD02319Fa1c538DcACA064a7919446dAa924' as `0x${string}`,
  },
} as const;

export type ContractName = keyof typeof addresses[16602];
