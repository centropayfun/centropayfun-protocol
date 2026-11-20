// MARKET — live trending board + own-token row. Follows the market register record only;
// CA state never gates the trending feed (it only decides what row #1 shows).
import { DASH, fmtPrice, fmtUsd, fmtPct, num } from './format.js';
import { tweenNumber } from './motion.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch JSON with timeout + exponential backoff (800ms, 1.6s, 3.2s) */
export async function getJSON(url, init = {}, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 10000);
    let fatal = false;
    try {
      const r = await fetch(url, { ...init, signal: ac.signal });
      clearTimeout(to);
      if (r.ok) return await r.json();
      err = new Error('HTTP ' + r.status);
      fatal = r.status < 500 && r.status !== 429;
    } catch (e) { clearTimeout(to); err = e; }
    if (fatal) throw err;
    if (i < tries - 1) await sleep(800 * 2 ** i + Math.random() * 250);
  }
  throw err;
}

const bestPair = (pairs) => (Array.isArray(pairs) ? pairs.filter(Boolean) : [])
  .sort((a, b) => (num(b.volume && b.volume.h24) || 0) - (num(a.volume && a.volume.h24) || 0))[0] || null;

const toRow = (pair, extra = {}) => (pair ? {
  addr: pair.baseToken.address, symbol: pair.baseToken.symbol, name: pair.baseToken.name,
  price: num(pair.priceUsd), chg: num(pair.priceChange && pair.priceChange.h24),
  vol: num(pair.volume && pair.volume.h24), liq: num(pair.liquidity && pair.liquidity.usd),
  img: (pair.info && pair.info.imageUrl) || null, url: pair.url || null, ...extra,
} : null);

export async function loadTrending(reg, gate) {
  const boosts = await getJSON(reg.market.boosts);
  const top = (Array.isArray(boosts) ? boosts : [])
    .filter((b) => b && b.chainId === 'solana' && b.tokenAddress)
    .sort((a, b) => num(b.totalAmount) - num(a.totalAmount))
    .filter((b, i, arr) => arr.findIndex((x) => x.tokenAddress === b.tokenAddress) === i)
    .slice(0, 10);
  return Promise.all(top.map(async (b) => {
    gate.learn(b.tokenAddress);
    try {
      const pairs = await getJSON(reg.market.tokens + encodeURIComponent(b.tokenAddress));
      const list = Array.isArray(pairs) ? pairs : [];
      const pair = bestPair(list.filter((p) => p.baseToken && p.baseToken.address === b.tokenAddress)) || bestPair(list);
      const r = toRow(pair, { addr: b.tokenAddress });
      if (r) { r.img = r.img || b.icon || null; return r; }
    } catch { /* fall through to a dash row */ }
    return { addr: b.tokenAddress, symbol: null, name: null, price: NaN, chg: NaN, vol: NaN, liq: NaN, img: b.icon || null, url: null, failed: true };
  }));
}

/* ---------- DOM ---------- */
const hue = (s) => {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ['var(--c-deep)', 'var(--c-blue)', 'var(--c-mid)'][h % 3];
};
export function tile(sym) {
  const t = document.createElement('span');
  t.className = 'tile';
  t.style.setProperty('--tile', hue(sym || '?'));
  t.textContent = (sym || '?').trim().charAt(0).toUpperCase() || '?';
  return t;
}
/** logo with ordered fallback chain, ends in a letter tile */
export function logo(srcs, sym) {
  const wrap = document.createElement('span');
  wrap.className = 'logo';
  const list = srcs.filter(Boolean);
  const put = () => {
    if (!list.length) { wrap.replaceChildren(tile(sym)); return; }
    const img = new Image();
    img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onerror = put;
    img.src = list.shift();
    wrap.replaceChildren(img);
  };
  put();
  return wrap;
}

const COLS = ['price', 'chg', 'vol', 'liq'];
const LABEL = { price: 'Price', chg: '24h', vol: 'Volume 24h', liq: 'Liquidity' };
const FMT = { price: fmtPrice, chg: fmtPct, vol: fmtUsd, liq: fmtUsd };

export function buildRow(rank) {
  const li = document.createElement('li');
  li.className = 'mrow spot is-skel';
  li.innerHTML = '<span class="rank"></span><span class="tok"><span class="logo-slot"><span class="tile sk"></span></span>'
    + '<span class="tn"><b class="sym"><span class="sk-bar"></span></b><i class="nm"><span class="sk-bar short"></span></i></span></span>'
    + COLS.map((c) => `${c === 'chg' ? '<span class="meta">' : ''}<span class="cell ${c}" data-label="${LABEL[c]}"><em class="v"><span class="sk-bar"></span></em></span>${c === 'liq' ? '</span>' : ''}`).join('');
  li.querySelector('.rank').textContent = String(rank);
  return li;
}

export function fillRow(li, d) {
  li.classList.remove('is-skel');
  li.querySelector('.sym').textContent = d.symbol || DASH;
  li.querySelector('.nm').textContent = d.name || (d.failed ? 'Data unavailable' : '');
  const slot = li.querySelector('.logo-slot');
  const key = String(d.addr) + (d.img || '') + (d.imgs ? d.imgs.join() : '');
  if (slot.dataset.key !== key) {
    slot.dataset.key = key;
    slot.replaceChildren(logo(d.imgs || [d.img], d.symbol));
  }
  for (const c of COLS) {
    const cell = li.querySelector('.' + c + ' .v');
    if (!cell._v && cell.querySelector('.sk-bar')) cell.textContent = '';
    tweenNumber(cell, d[c], FMT[c]);
  }
  li.querySelector('.chg').dataset.dir = Number.isFinite(d.chg) ? (d.chg >= 0 ? 'up' : 'down') : 'none';
  if (d.url) { li.dataset.href = d.url; li.tabIndex = 0; li.setAttribute('role', 'link'); }
  else { delete li.dataset.href; li.removeAttribute('role'); li.removeAttribute('tabindex'); }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderTicker(el, rows) {
  const ok = rows.filter((r) => r.symbol);
  if (!ok.length) return;
  const item = (r) => `<span class="tk"><b>${esc(r.symbol)}</b><span>${esc(fmtPrice(r.price))}</span><span class="chg" data-dir="${r.chg >= 0 ? 'up' : 'down'}">${esc(fmtPct(r.chg))}</span></span>`;
  const html = ok.map(item).join('');
  el.innerHTML = `<div class="tk-track"><div class="tk-set">${html}</div><div class="tk-set" aria-hidden="true">${html}</div></div>`;
  el.classList.remove('is-skel');
}
