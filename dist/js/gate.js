// GATE — address-shaped strings are matched against the stated registry. A 0x hex
// string is never rejected just for being hex; it is judged by registry membership.
const EVM = /^0x[0-9a-fA-F]{40}$/;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const addressShaped = (s) => EVM.test(s) || B58.test(s);

export function createGate(reg) {
  const known = new Set(); // addresses learnt from the market source register
  const stated = () => (reg.ca.state === 'stated' ? reg.ca.value : null);
  return {
    learn(addr) { if (addr) known.add(addr); },
    /** 'not-address' | 'ca' | 'market' | 'unregistered' */
    classify(s) {
      if (!addressShaped(s)) return 'not-address';
      if (stated() && s === stated()) return 'ca';
      if (known.has(s)) return 'market';
      return 'unregistered';
    },
    /** scan text nodes under root; CA slot (data-gate-exempt) is skipped. Returns findings. */
    scan(root) {
      const found = [];
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const p = n.parentElement;
        if (!p || p.closest('[data-gate-exempt],script,style')) continue;
        for (const tok of n.nodeValue.split(/[\s,;|]+/)) {
          if (!tok) continue;
          const verdict = this.classify(tok);
          if (verdict === 'unregistered') {
            p.setAttribute('data-gate', 'unregistered');
            p.title = 'Address does not match any stated record';
            found.push({ tok, el: p });
          }
        }
      }
      return found;
    },
  };
}
