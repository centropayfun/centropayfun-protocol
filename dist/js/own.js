// OWN TOKEN — row #1. DexScreener and pump.fun are fetched in parallel; neither blocks the other.
import { getJSON } from './market.js';
import { isStated } from './register.js';
import { num } from './format.js';

export async function loadOwn(reg, onUpdate) {
  if (!isStated(reg.ca)) return;
  const ca = reg.ca.value;
  const st = { dex: null, pump: null };
  const emit = () => onUpdate(compose(ca, st));
  const dex = getJSON(reg.market.ownDex + encodeURIComponent(ca))
    .then((j) => {
      const pairs = ((j && j.pairs) || []).filter(Boolean)
        .sort((a, b) => (num(b.volume && b.volume.h24) || 0) - (num(a.volume && a.volume.h24) || 0));
      st.dex = pairs[0] || null; emit();
    }).catch(() => {});
  const pump = getJSON(reg.market.ownPump + encodeURIComponent(ca), {}, 2)
    .then((j) => { st.pump = j || null; emit(); }).catch(() => {});
  await Promise.allSettled([dex, pump]);
}

function compose(ca, { dex, pump }) {
  const bt = (dex && dex.baseToken) || {};
  return {
    addr: ca,
    symbol: bt.symbol || (pump && pump.symbol) || null,
    name: bt.name || (pump && pump.name) || null,
    price: num(dex && dex.priceUsd),
    chg: num(dex && dex.priceChange && dex.priceChange.h24),
    vol: num(dex && dex.volume && dex.volume.h24),
    liq: num(dex && dex.liquidity && dex.liquidity.usd),
    // logo order: pump.fun image_uri → DexScreener → brand folder asset → letter tile
    imgs: [pump && pump.image_uri, dex && dex.info && dex.info.imageUrl, 'assets/logo-192.png'],
    url: (dex && dex.url) || null,
  };
}
