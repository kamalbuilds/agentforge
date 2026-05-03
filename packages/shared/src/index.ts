import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

// Load ABI JSON via CJS require to avoid Node 24 ESM import-attribute requirement.
// tsc strips `with { type: 'json' }` from emitted JS, causing ERR_IMPORT_ATTRIBUTE_MISSING.
export const AgentINFTAbi = _require('../abi/AgentINFT.json');
export const ArenaAbi = _require('../abi/Arena.json');
export const BreedingMarketAbi = _require('../abi/BreedingMarket.json');
export const RoyaltyVaultAbi = _require('../abi/RoyaltyVault.json');
export * from './addresses.js';
export * from './chains.js';
export * from './types.js';
