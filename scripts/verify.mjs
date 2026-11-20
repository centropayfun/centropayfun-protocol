// Gate + hygiene verification. Prints a gate count and exits non-zero on any failure.
// Optional: REF_TEXT=<path> compares page copy against a reference text for shared 2-grams.
import { readFileSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0; const fail = [];
const gate = (name, ok, info = '') => {
  if (ok) pass++; else fail.push(name + (info ? ' - ' + info : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info ? ' - ' + info : ''));
};
const walk = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
const textOf = (f) => readFileSync(f, 'utf8');
const imp = (p) => import(pathToFileURL(join(root, p)).href);

const { normalise, isStated, handleOf, hrefOf } = await imp('src/js/register.js');
const { createGate, addressShaped } = await imp('src/js/gate.js');
const base = (await imp('src/register-data.js')).default;

// --- register gates, both branches ---
const CA = 'So11111111111111111111111111111111111111112';
const absent = normalise(base);
const stated = normalise({ ...base, ca: { state: 'stated', value: CA }, x: { state: 'stated', url: 'https://x.com/centropay_test' }, github: { state: 'stated', url: 'https://github.com/o/r' } });
gate('CA absent -> not stated (inert)', !isStated(absent.ca));
gate('CA stated -> stated', isStated(stated.ca));
gate('CA malformed -> unconfirmed', normalise({ ...base, ca: { state: 'stated', value: 'nope' } }).ca.state === 'unconfirmed');
gate('X absent -> no href, no handle', hrefOf(absent.x) === null && handleOf(absent.x) === null);
gate('GitHub absent -> no href', hrefOf(absent.github) === null);
gate('X stated -> href + derived handle', hrefOf(stated.x) === 'https://x.com/centropay_test' && handleOf(stated.x) === 'centropay_test');
gate('GitHub stated -> derived handle', handleOf(stated.github) === 'o');
gate('non-https social URL -> unconfirmed', normalise({ ...base, x: { state: 'stated', url: 'http://x.com/a' } }).x.state === 'unconfirmed');
gate('market record stated regardless of CA state', isStated(absent.market) && isStated(stated.market));

// --- address scanner gates ---
const ga = createGate(stated), gb = createGate(absent);
const evm = '0x' + 'ab12'.repeat(10);
gate('scanner: stated CA recognised', ga.classify(CA) === 'ca');
gate('scanner: same string with CA absent -> unregistered', gb.classify(CA) === 'unregistered');
gate('scanner: 0x hex is address-shaped, not blanket-rejected', addressShaped(evm) && ga.classify(evm) === 'unregistered');
ga.learn(evm);
gate('scanner: 0x hex accepted once registered', ga.classify(evm) === 'market');
gate('scanner: plain words are not addresses', ga.classify('Centropay') === 'not-address' && ga.classify('$0.0012') === 'not-address');

// --- source hygiene ---
const src = walk(join(root, 'src')).filter((f) => ['.css', '.js', '.html'].includes(extname(f)));
const hexRe = /#[0-9a-fA-F]{6}\b/g;
const hexOut = src.filter((f) => !f.endsWith('tokens.css')).flatMap((f) => (textOf(f).match(hexRe) || []).map((h) => f + ':' + h));
gate('palette: hex literals only in tokens.css', hexOut.length === 0, hexOut.slice(0, 5).join(' '));
gate('no ch units', !src.some((f) => /\d\s*ch\b/.test(textOf(f))));
const html = textOf(join(root, 'src/index.html')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
const dateRe = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|as of|checked|last updated|\d{1,2}:\d{2}/i;
gate('no visible dates/timestamps in page copy', !dateRe.test(html), (html.match(dateRe) || [''])[0]);
gate('no date rendering in js', !src.filter((f) => f.endsWith('.js')).some((f) => /new Date|toLocale(Date|Time)/.test(textOf(f))));
gate('repo hygiene: no CLAUDE.md / .claude', !['CLAUDE.md', '.claude'].some((n) => existsSync(join(root, n))));
const attr = walk(root).filter((f) => !f.includes('node_modules') && !f.includes('verify.mjs') && /\.(md|js|html|css|json|mjs)$/.test(f) && /generated (by|with) claude|co-authored-by|anthropic/i.test(textOf(f)));
gate('repo hygiene: no AI attribution', attr.length === 0, attr.join());
gate('reduced-motion fallback in css and js', /prefers-reduced-motion: reduce/.test(textOf(join(root, 'src/styles.css'))) && /prefers-reduced-motion: reduce/.test(textOf(join(root, 'src/js/motion.js'))));
gate('favicon.svg is 32x32', /viewBox="0 0 32 32"/.test(textOf(join(root, 'src/assets/favicon.svg'))));

// --- animation audit: every @keyframes is applied somewhere, and reduced motion silences all of them ---
{
  const css = textOf(join(root, 'src/styles.css'));
  const all = src.map(textOf).join('\n');
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
  const unused = names.filter((n) => !new RegExp('animation(-name)?\\s*:[^;]*\\b' + n + '\\b').test(css));
  gate(`keyframes: all ${names.length} are applied to an element (${names.join(', ')})`, unused.length === 0, 'unused: ' + unused.join());
  const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
  gate('reduced motion: blanket animation/transition kill', /animation:\s*none\s*!important/.test(rm) && /transition:\s*none\s*!important/.test(rm));
  gate('reduced motion: JS springs resolve instantly', /if \(reduced\(\)\) \{ onFrame\(1\)/.test(textOf(join(root, 'src/js/motion.js'))));
  const used = ['livePulse', 'ownPulse'].every((n) => names.includes(n));
  gate('own-row pulse + live-dot keyframes present', used);
  gate('ownPulse honours reduced motion explicitly', /\.own-row \{ animation: none; \}/.test(rm));
}

// --- optional 2-gram check against reference copy ---
if (process.env.REF_TEXT) {
  const grams = (t) => { const w = t.toLowerCase().replace(/[^a-z0-9%$ ]+/g, ' ').split(/\s+/).filter(Boolean); return new Set(w.slice(1).map((x, i) => w[i] + ' ' + x)); };
  const js = textOf(join(root, 'src/js/main.js')).match(/'[^']{12,}'/g) || [];
  const shared = [...grams(html + ' ' + js.join(' '))].filter((g) => grams(textOf(process.env.REF_TEXT)).has(g));
  gate('copy: zero shared 2-grams with reference', shared.length === 0, shared.join(' | '));
}

// --- build both branches, prove logo + register output ---
const run = (env, out) => execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { env: { ...process.env, ...env, CENTRO_OUT: out }, encoding: 'utf8' });
rmSync(join(root, '.verify'), { recursive: true, force: true });
run({}, '.verify/absent'); run({ CENTRO_CA: CA }, '.verify/stated');
const regOut = async (d) => (await import(pathToFileURL(join(root, d, 'register-data.js')).href + '?' + Math.random())).default;
gate('build branch A: CA absent in output register', (await regOut('.verify/absent')).ca.state === 'absent');
gate('build branch B: CA stated in output register', (await regOut('.verify/stated')).ca.value === CA);
for (const d of ['dist', '.verify/absent', '.verify/stated']) {
  if (existsSync(join(root, d, 'index.html'))) gate(`${d}: logo in output and referenced`, existsSync(join(root, d, 'assets/logo-512.png')) && textOf(join(root, d, 'index.html')).includes('"assets/logo-512.png"'));
}
rmSync(join(root, '.verify'), { recursive: true, force: true });
console.log(`\nGATES PASSED: ${pass}  FAILED: ${fail.length}`);
process.exit(fail.length ? 1 : 0);
