const nf = (o) => new Intl.NumberFormat('en-US', o);
const usd2 = nf({ style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const compact = nf({ notation: 'compact', maximumFractionDigits: 2 });
export const DASH = '—';

export function fmtPrice(v) {
  if (!Number.isFinite(v)) return DASH;
  if (v >= 1) return usd2.format(v);
  if (v === 0) return '$0.00';
  const digits = Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(v)) + 2));
  return '$' + v.toFixed(digits);
}
export const fmtUsd = (v) => (Number.isFinite(v) ? '$' + compact.format(v) : DASH);
export const fmtPct = (v) => (Number.isFinite(v) ? (v > 0 ? '+' : '') + v.toFixed(2) + '%' : DASH);
export const fmtInt = (v) => (Number.isFinite(v) ? nf({ maximumFractionDigits: 0 }).format(v) : DASH);
export const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
