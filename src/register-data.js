// REGISTER — every external fact is one record. state: "stated" | "absent" | "unconfirmed".
// Absent / unconfirmed records render inert. Edit here (or pass CENTRO_CA / CENTRO_X /
// CENTRO_GITHUB at build time); nothing else in the project holds these facts.
export default {
  ca: { state: 'absent', value: null },
  x: { state: 'absent', url: null },
  github: { state: 'absent', url: null },
  chain: { state: 'stated', name: 'Solana', cluster: 'mainnet', rpc: 'https://solana-rpc.publicnode.com' },
  market: {
    state: 'stated',
    boosts: 'https://api.dexscreener.com/token-boosts/top/v1',
    tokens: 'https://api.dexscreener.com/tokens/v1/solana/',
    ownDex: 'https://api.dexscreener.com/latest/dex/tokens/',
    ownPump: 'https://frontend-api.pump.fun/coins/',
  },
};
