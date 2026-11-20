import reg, { isStated, handleOf, hrefOf } from './register.js';
import { createGate } from './gate.js';
import { initReveal, initSpotlight, initProgress, initParallax, tweenNumber, reduced } from './motion.js';
import { X_SVG, GH_SVG } from './icons.js';
import { DASH, fmtInt } from './format.js';
import { getJSON, loadTrending, buildRow, fillRow, renderTicker, logo } from './market.js';
import { loadOwn } from './own.js';

const $ = (s, r = document) => r.querySelector(s);
const gate = createGate(reg);

/* ---------- CA slot (register-driven, inert until stated) ---------- */
function renderCA() {
  const host = $('#ca');
  host.dataset.state = reg.ca.state;
  if (isStated(reg.ca)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ca-btn'; b.dataset.anchor = 'ca-copy';
    b.setAttribute('aria-label', 'Copy contract address');
    b.innerHTML = '<span class="ca-label">CA</span><code class="ca-val"></code><span class="ca-fb" aria-live="polite">Tap to copy</span>';
    $('.ca-val', b).textContent = reg.ca.value;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(reg.ca.value); }
      catch {
        const t = document.createElement('textarea'); t.value = reg.ca.value; document.body.append(t); t.select();
        try { document.execCommand('copy'); } catch { /* noop */ } t.remove();
      }
      const fb = $('.ca-fb', b); b.classList.add('copied'); fb.textContent = 'Copied';
      clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('copied'); fb.textContent = 'Tap to copy'; }, 1800);
    });
    host.replaceChildren(b);
  } else {
    const s = document.createElement('div');
    s.className = 'ca-btn is-inert'; s.setAttribute('aria-disabled', 'true');
    s.innerHTML = '<span class="ca-label">CA</span><span class="ca-val ca-empty"></span>';
    $('.ca-empty', s).textContent = reg.ca.state === 'unconfirmed' ? 'Awaiting confirmation' : 'Not announced yet';
    host.replaceChildren(s);
  }
}

/* ---------- socials (icon only, both always present) ---------- */
function renderSocial() {
  const defs = { x: { svg: X_SVG, name: 'X' }, github: { svg: GH_SVG, name: 'GitHub' } };
  for (const [key, d] of Object.entries(defs)) {
    const slot = $(`[data-social="${key}"]`);
    const rec = reg[key];
    const href = hrefOf(rec);
    let el;
    if (href) {
      el = document.createElement('a');
      el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer';
      el.setAttribute('aria-label', `${d.name} @${handleOf(rec)}`);
    } else {
      el = document.createElement('span');
      el.setAttribute('aria-disabled', 'true'); el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `${d.name} (not available yet)`);
    }
    el.className = 'soc' + (href ? '' : ' is-inert');
    el.dataset.state = rec.state;
    el.innerHTML = d.svg;
    slot.replaceWith(el);
    el.dataset.anchor = `social-${key}`;
  }
}

/* ---------- market board ---------- */
const rowsEl = $('#rows');
const noteEl = $('#market-note');
const tickerEl = $('#ticker');
const ownRow = buildRow(1); ownRow.classList.add('own-row'); ownRow.dataset.anchor = 'own-row';
const trendRows = Array.from({ length: 10 }, (_, i) => buildRow(i + 2));
const state = { own: null, trend: null, everOk: false };

function mountSkeleton() {
  rowsEl.replaceChildren(ownRow, ...trendRows.slice(0, 9));
  trendRows.slice(0, 9).forEach((r, i) => { r.style.setProperty('--d', i * 45 + 'ms'); });
  paintOwn();
}

function paintOwn() {
  ownRow.dataset.state = reg.ca.state;
  if (isStated(reg.ca)) {
    fillRow(ownRow, state.own || { addr: reg.ca.value, symbol: null, name: 'Centropay', price: NaN, chg: NaN, vol: NaN, liq: NaN, imgs: ['assets/logo-192.png'] });
    if (!state.own) { ownRow.classList.add('is-wait'); } else ownRow.classList.remove('is-wait');
    ownRow.querySelector('.nm').textContent = (state.own && state.own.name) || 'Centropay';
    if (!state.own || !state.own.symbol) ownRow.querySelector('.sym').textContent = 'CENTRO';
  } else {
    // CA absent: placeholder showing the BRAND logo (never a letter tile), dotted data, non-clickable
    ownRow.classList.remove('is-skel');
    ownRow.querySelector('.sym').textContent = 'CENTRO';
    ownRow.querySelector('.nm').textContent = 'Centropay';
    const slot = ownRow.querySelector('.logo-slot');
    const img = new Image(); img.src = 'assets/logo-64.png'; img.alt = ''; img.width = 36; img.height = 36;
    img.className = 'brand-logo'; slot.replaceChildren(img);
    ownRow.querySelectorAll('.cell .v').forEach((v) => { v.textContent = '· · · · ·'; });
    ownRow.querySelector('.chg').dataset.dir = 'none';
    ownRow.removeAttribute('role'); ownRow.removeAttribute('tabindex'); delete ownRow.dataset.href;
  }
}

function paintTrend() {
  const rows = state.trend;
  if (!rows) return;
  const own = isStated(reg.ca) ? reg.ca.value : null;
  const list = rows.filter((r) => r.addr !== own).slice(0, 9);   // dedup: own token only lives in row #1
  trendRows.forEach((r, i) => {
    if (i < list.length) { if (!r.isConnected) rowsEl.append(r); fillRow(r, list[i]); r.style.setProperty('--d', i * 45 + 'ms'); }
    else if (r.isConnected) r.remove();
  });
  renderTicker(tickerEl, rows);
}

function setNote(kind) {
  noteEl.dataset.state = kind;
  noteEl.textContent = kind === 'ok' ? 'Live · refreshes every minute'
    : kind === 'stale' ? 'Source unreachable — showing the last good data'
    : kind === 'error' ? 'Market source unreachable — retrying shortly'
    : 'Loading market data…';
}

function showDash() {
  trendRows.slice(0, 9).forEach((r) => {
    r.classList.remove('is-skel');
    r.querySelector('.sym').textContent = DASH; r.querySelector('.nm').textContent = 'Source error';
    r.querySelector('.logo-slot').replaceChildren(logo([], '?'));
    r.querySelectorAll('.cell .v').forEach((v) => { v.textContent = DASH; });
  });
}

async function refreshTrend() {
  try {
    state.trend = await loadTrending(reg, gate);
    state.everOk = true; paintTrend(); setNote('ok');
  } catch {
    if (state.everOk) setNote('stale'); else { showDash(); setNote('error'); }
  }
}

async function refreshOwn() {
  if (!isStated(reg.ca)) return;
  await loadOwn(reg, (d) => { state.own = d; paintOwn(); paintTrend(); });
}

/* ---------- slot (status pill) ---------- */
async function refreshSlot() {
  const el = $('#slot');
  try {
    const j = await getJSON(reg.chain.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [{ commitment: 'finalized' }] }) }, 3);
    tweenNumber(el, Number(j.result), (v) => 'slot ' + fmtInt(Math.round(v)));
    $('#status-pill').dataset.state = 'ok';
  } catch { el.textContent = DASH; $('#status-pill').dataset.state = 'error'; }
}

/* ---------- poll: 60s, paused while hidden, immediate on visible ---------- */
let timer = 0;
const refreshAll = () => Promise.allSettled([refreshTrend(), refreshOwn(), refreshSlot()]);
function schedule() { clearTimeout(timer); if (!document.hidden) timer = setTimeout(async () => { await refreshAll(); schedule(); }, 60000); }
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else { refreshAll(); schedule(); } });

/* ---------- roadmap tabs ---------- */
const PHASES = [
  { n: 'Phase 1', t: 'Foundation', c: [['Brand and site', 'Identity, logo system and this site go live.'], ['Live market board', 'Trending Solana tokens appear with no login required.'], ['Community base', 'Channels open as soon as their links are confirmed.']] },
  { n: 'Phase 2', t: 'Launch', c: [['Contract announced', 'The address appears at page top and unlocks row one.'], ['Trading venues', 'Pairs and liquidity become visible on the board.'], ['Documents', 'The whitepaper is published alongside the code.']] },
  { n: 'Phase 3', t: 'Rails', c: [['Card route pilot', 'First wallet-to-card conversions with a small group.'], ['Speed tuning', 'Work toward the two-second target under real load.'], ['Fee check', 'Confirm the zero-fee line holds end to end.']] },
  { n: 'Phase 4', t: 'Scale', c: [['Wider access', 'Open the flow to everyone who holds it.'], ['Mobile interface', 'Ship the phone experience previewed above.'], ['Partnerships', 'Announce integrations only once they are signed.']] },
];
function initRoadmap() {
  const tabs = $('#phase-tabs'), cards = $('#phase-cards');
  const show = (i) => {
    [...tabs.children].forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    cards.replaceChildren(...PHASES[i].c.map(([h, p]) => {
      const a = document.createElement('article'); a.className = 'card spot rise';
      a.innerHTML = '<h3 class="h3"></h3><p></p>'; a.firstChild.textContent = h; a.lastChild.textContent = p; return a;
    }));
  };
  PHASES.forEach((p, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.role = 'tab'; b.className = 'pillbtn';
    b.innerHTML = '<small></small><strong></strong>'; b.firstChild.textContent = p.n; b.lastChild.textContent = p.t;
    b.addEventListener('click', () => show(i));
    b.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (i + (e.key === 'ArrowRight' ? 1 : PHASES.length - 1)) % PHASES.length; show(n); tabs.children[n].focus(); } });
    tabs.append(b);
  });
  show(0);
}

/* ---------- row click → pair page ---------- */
rowsEl.addEventListener('click', (e) => { const r = e.target.closest('.mrow'); if (r && r.dataset.href) open(r.dataset.href, '_blank', 'noopener'); });
rowsEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = e.target.closest('.mrow'); if (r && r.dataset.href) open(r.dataset.href, '_blank', 'noopener'); } });

/* ---------- boot ---------- */
renderCA(); renderSocial(); mountSkeleton(); initRoadmap();
initProgress($('#progress')); initSpotlight(); initParallax($('#hero')); initReveal();
refreshAll().then(() => { gate.scan(document.body); }); schedule();
if (reduced()) document.documentElement.classList.add('rm');
{ // browser chrome colour read from a design variable, so no hex lives outside tokens.css
  const m = document.createElement('meta'); m.name = 'theme-color';
  m.content = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim(); document.head.append(m);
}
