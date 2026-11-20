// MOTION — damped spring solver drives every entrance and number tween.
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => mq.matches;

/** Semi-implicit Euler damped spring from 0 → 1. Resolves when at rest. */
export function spring(onFrame, { k = 170, c = 20, m = 1, delay = 0 } = {}) {
  if (reduced()) { onFrame(1); return { cancel() {} }; }
  let x = 0, v = 0, last = 0, raf = 0, dead = false;
  const start = performance.now() + delay;
  const step = (now) => {
    if (dead) return;
    if (now < start) { raf = requestAnimationFrame(step); return; }
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
    last = now;
    const a = (-k * (x - 1) - c * v) / m;
    v += a * dt; x += v * dt;
    onFrame(x);
    if (Math.abs(x - 1) < 0.0008 && Math.abs(v) < 0.002) { onFrame(1); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { cancel() { dead = true; cancelAnimationFrame(raf); } };
}

/** Scroll-reveal with per-parent stagger. */
export function initReveal(root = document) {
  const els = [...root.querySelectorAll('[data-reveal]')];
  for (const parent of new Set(els.map((e) => e.parentElement))) {
    els.filter((e) => e.parentElement === parent).forEach((e, i) => { e.dataset.i = String(i); });
  }
  const play = (el) => {
    const i = Number(el.dataset.i || 0);
    spring((p) => {
      el.style.opacity = String(Math.max(0, Math.min(1, p)));
      el.style.transform = `translate3d(0, ${(1 - p) * 24}px, 0)`;
    }, { delay: Math.min(i, 8) * 90 });
    setTimeout(() => { el.style.opacity = ''; el.style.transform = ''; el.classList.add('is-in'); }, reduced() ? 0 : 1600 + Math.min(i, 8) * 90);
  };
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  els.forEach((e) => { e.style.opacity = '0'; });
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); play(en.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
}

/** Number tween (critically damped) with flash on change. fmt: number → string. */
export function tweenNumber(el, to, fmt, { flash = true } = {}) {
  const from = Number.isFinite(el._v) ? el._v : 0;
  const first = !Number.isFinite(el._v);
  el._tw && el._tw.cancel();
  if (!Number.isFinite(to)) { el._v = NaN; el.textContent = fmt(NaN); return; }
  el._v = to;
  if (document.hidden) { el.textContent = fmt(to); return; }   // rAF is paused in hidden tabs
  if (flash && !first && to !== from) {
    el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
    el.classList.add(to > from ? 'flash-up' : 'flash-down');
  }
  el._tw = spring((p) => { el.textContent = fmt(from + (to - from) * Math.min(p, 1.0)); }, { k: 120, c: 22 });
  clearTimeout(el._fb);   // safety net if frames are throttled: the final value always lands
  el._fb = setTimeout(() => { if (el._v === to) el.textContent = fmt(to); }, 1500);
}

export function initSpotlight() {
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('.spot');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', e.clientX - r.left + 'px');
    t.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}

export function initProgress(bar) {
  let tick = false;
  const upd = () => {
    tick = false;
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', upd);
  upd();
}

export function initParallax(hero) {
  if (reduced()) return;
  const layers = [...hero.querySelectorAll('[data-depth]')];
  let px = 0, py = 0, tx = 0, ty = 0, visible = true, raf = 0;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }).observe(hero);
  const loop = () => {
    cancelAnimationFrame(raf);
    if (!visible || reduced()) return;
    px += (tx - px) * 0.08; py += (ty - py) * 0.08;
    const sy = Math.min(scrollY, 900);
    for (const l of layers) {
      const d = Number(l.dataset.depth);
      l.style.transform = `translate3d(${px * d * 60}px, ${py * d * 60 + sy * d * 0.35}px, 0)`;
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
}
