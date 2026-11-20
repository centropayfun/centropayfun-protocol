import data from '../register-data.js';

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const isStated = (rec) => !!rec && rec.state === 'stated';

/** Normalise a raw record: a record only counts as stated when its payload is usable. */
export function normalise(raw) {
  const reg = JSON.parse(JSON.stringify(raw));
  if (reg.ca.state === 'stated' && !B58.test(String(reg.ca.value || ''))) reg.ca.state = 'unconfirmed';
  for (const k of ['x', 'github']) {
    if (reg[k].state === 'stated') {
      try {
        const u = new URL(reg[k].url);
        if (u.protocol !== 'https:') throw new Error('scheme');
      } catch {
        reg[k].state = 'unconfirmed';
      }
    }
  }
  return reg;
}

/** LINK RULE: store the URL, derive the handle. Unstated records yield no href. */
export function handleOf(rec) {
  if (!isStated(rec)) return null;
  const seg = new URL(rec.url).pathname.split('/').filter(Boolean)[0];
  return seg || null;
}
export const hrefOf = (rec) => (isStated(rec) ? rec.url : null);

export const register = normalise(data);
export default register;
