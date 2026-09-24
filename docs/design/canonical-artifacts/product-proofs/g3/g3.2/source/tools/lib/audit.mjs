// In-page audit (read-only), evaluated after a state or a journey step. It reports what a reader could SEE and REACH,
// in phone CSS pixels: visible text with its ink and box, visible controls with their accessible names and boxes, and
// the boxes of the composition regions. Checks and the state matrix are computed from this, never from source intent.
export const AUDIT = `(() => {
  const ph = document.getElementById('phone'), pr = ph.getBoundingClientRect();
  const chain = (el) => { const out = []; for (let e = el; e && e !== ph.parentElement; e = e.parentElement) out.push(e); return out; };
  const shown = (el) => chain(el).every((e) => { if (e.hidden) return false; const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.02; });
  const opac = (el) => chain(el).reduce((o, e) => o * +getComputedStyle(e).opacity, 1);
  const inBox = (r) => r.width > 0 && r.height > 0 && r.right > pr.left && r.left < pr.right && r.bottom > pr.top && r.top < pr.bottom;
  const box = (r) => ({ x: +(r.left - pr.left).toFixed(1), y: +(r.top - pr.top).toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
  const isSr = (el) => chain(el).some((e) => e.classList && e.classList.contains('sr'));
  const text = [], seen = new Set();
  const tw = document.createTreeWalker(ph, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const s = n.nodeValue.replace(/\\s+/g, ' ').trim(); if (!s) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue;
    if (el.closest('svg') || el.closest('script') || el.closest('style') || el.closest('.fprobe') || isSr(el)) continue;
    seen.add(el);
    const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect();
    if (!inBox(r) || !shown(el) || opac(el) < 0.5) continue;
    const cs = getComputedStyle(el);
    text.push({ text: el.textContent.replace(/\\s+/g, ' ').trim(), where: (el.closest('[id]') || {}).id || null, box: box(r), color: cs.color, size: parseFloat(cs.fontSize),
      weight: +cs.fontWeight, lh: cs.lineHeight === 'normal' ? null : +(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(4), letterSpacing: cs.letterSpacing,
      dir: getComputedStyle(el).direction, status: !!el.closest('.status') });
  }
  const nameOf = (e) => { const l = e.getAttribute('aria-label'); if (l) return l; const lb = e.getAttribute('aria-labelledby'); if (lb) return lb.split(' ').map((i) => (document.getElementById(i) || {}).textContent || '').join(' ').trim();
    if (e.id && document.querySelector('label[for="' + e.id + '"]')) return document.querySelector('label[for="' + e.id + '"]').textContent.trim(); return e.textContent.replace(/\\s+/g, ' ').trim(); };
  const controls = [...ph.querySelectorAll('button, input, [role="slider"], section[tabindex], [role="menuitem"]')].filter((e) => shown(e) && inBox(e.getBoundingClientRect()) && opac(e) >= 0.5).map((e) => ({
    id: e.id || null, act: e.getAttribute('data-act'), world: e.getAttribute('data-world'), scope: e.getAttribute('data-scope'), role: e.getAttribute('role') || e.tagName.toLowerCase(),
    name: nameOf(e), expanded: e.getAttribute('aria-expanded'), pressed: e.getAttribute('aria-pressed'), current: e.getAttribute('aria-current'), disabled: e.getAttribute('aria-disabled'),
    tabindex: e.tabIndex, box: box(e.getBoundingClientRect()) }));
  const reg = (sel) => { const e = document.querySelector(sel); if (!e || !shown(e)) return null; return box(e.getBoundingClientRect()); };
  const tl = document.getElementById('tl-track'), band = document.getElementById('band');
  return { dir: getComputedStyle(ph).direction, lang: ph.getAttribute('lang'), w: pr.width, h: pr.height, innerWidth, scrollW: ph.scrollWidth,
    place: ph.getAttribute('data-place'), text, controls,
    regions: { header: reg('#hdr-world') || reg('#hdr-conv'), cue: reg('#cue'), timeline: reg('#tl-track'), liveEdge: reg('#tl-live'), band: band && band.querySelector('#band-in').children.length ? reg('#band') : null,
      composer: reg('#composer'), rail: reg('#rail .items'), world: reg('#world-layer'), proposal: reg('#proposal'), shared: reg('#shared'), menu: reg('#rmenu') },
    world: { opacity: +getComputedStyle(document.getElementById('world-layer')).opacity },
    callA11y: document.getElementById('call-a11y').textContent,
    liveRegions: [...ph.querySelectorAll('[aria-live]')].map((e) => e.id || e.className),
    focus: document.activeElement && ph.contains(document.activeElement) ? (document.activeElement.id || document.activeElement.getAttribute('data-act') || document.activeElement.className) : null };
})()`;

/** The world alone (every Product element hidden): the "same world" comparisons read this. */
export const WORLD_ONLY_ON = `(()=>{const ph=document.getElementById('phone');for(const e of ph.children){if(e.id!=='world-layer'){e.dataset.wo=e.style.visibility||'-';e.style.visibility='hidden';}}return true})()`;
export const WORLD_ONLY_OFF = `(()=>{const ph=document.getElementById('phone');for(const e of ph.children){if(e.dataset.wo){e.style.visibility=e.dataset.wo==='-'?'':e.dataset.wo;delete e.dataset.wo;}}return true})()`;
