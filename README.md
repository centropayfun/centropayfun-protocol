# Centropay

**Instant crypto. Real-world money.**

[![Live site](https://img.shields.io/badge/live-centropay.fun-0156fb?style=flat-square)](https://centropay.fun)
![Chain](https://img.shields.io/badge/chain-Solana-02aafb?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-04f5fd?style=flat-square)

- **Chain:** Solana mainnet
- **Contract address (CA):** `TBA — not announced yet`

## Overview

Centropay moves holdings from a self-held Solana wallet onto a payment card in a single hop.
The aim is a conversion that finishes in as little as two seconds, with Centropay's own fee kept at zero.
This repository holds the public website, which also carries a live market board of trending Solana tokens.

## Features

- Live market board: top boosted Solana tokens, refreshed every minute, paused while the tab is hidden.
- Pinned row one for the Centropay token. Before the CA is announced it shows a placeholder; after, it follows live data.
- Contract-address slot at the top of the page, click-to-copy, inert until the address is stated.
- A single register file for every external fact (CA, X, GitHub): unstated records render inert.
- Spring-physics reveals, parallax hero, spotlight hover, count-up numbers, and a full reduced-motion fallback.
- Zero runtime dependencies. Static output in `dist/`.

## Links

| Record | Value |
| --- | --- |
| Website | https://centropay.fun |
| X | TBA |
| GitHub | TBA |
| Whitepaper | [docs/whitepaper.md](docs/whitepaper.md) |

## Develop

```bash
npm run build     # src/ -> dist/
npm run verify    # gate and hygiene checks, builds both CA branches
npm run serve     # serve dist/ on http://localhost:4173
```

To state a record, edit `src/register-data.js`, or pass `CENTRO_CA`, `CENTRO_X`, `CENTRO_GITHUB` to the build.

## License

MIT. See [LICENSE](LICENSE).
