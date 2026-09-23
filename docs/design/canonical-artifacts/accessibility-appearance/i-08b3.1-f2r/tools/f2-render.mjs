/**
 * I-08B3.1-F2 — the shared render harness.
 *
 * One browser, many pages. A fresh `chrome.exe --screenshot` per capture is a fresh page whose
 * fonts, filters and layout have to settle again, and in a package whose central claim is that
 * two appearances paint the same world, a capture that settled differently is a difference this
 * package would have to explain. The CDP client itself is I-08B3.1-F1's, vendored and called.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findChrome, launch, openPage } from '../vendor/f1/tools/f1-cdp.mjs';
import { VIEW } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');

export const sha = (buf) => createHash('sha256').update(buf).digest('hex');
export const shortSha = (buf) => sha(buf).slice(0, 24);

export function writeHtml(rel, html) {
  const p = join(PKG, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html, 'utf8');
  return p;
}

/** Open a browser for a batch of captures. Throws with a usable message when Chrome is absent,
 *  rather than producing an empty board and a green log. */
export async function withBrowser(fn) {
  const chrome = findChrome();
  if (!chrome) throw new Error('f2-render: no Chrome or Edge found — this package renders its proofs and cannot assert them instead');
  const browser = await launch({ chrome, port: 9421 });
  try { return await fn(browser); } finally { await browser.close(); }
}

/**
 * Render one page and return its PNG plus anything read back out of the document.
 *
 * `read` runs IN THE PAGE. Everything this package measures about a rendered proof is read out of
 * the document the browser actually built — never out of the generator that produced it. That is
 * I-08B3.1-F1R's correction and F2 inherits it wholesale: a claim about a picture has to be made
 * against the picture.
 */
/**
 * `savePng` is OPT-IN, and it is opt-in because the alternative shipped a 42 MB package.
 *
 * The cross-appearance matrix renders 22 documents and four planted probes, the switch proof
 * renders three more, and the regression gate two. Every one of those is READ rather than looked
 * at — the evidence is the census and the record, not the picture — so writing a 150 KB raster
 * beside each was 4 MB of files nobody opens. The pages themselves are kept, because a reviewer
 * who wants to see what was measured should be able to open the exact document that was measured.
 */
export async function capture(browser, { html, rel, read = null, width = VIEW.W, height = VIEW.H, dpr = VIEW.DPR, full = true, savePng = false }) {
  const path = writeHtml(rel, html);
  const page = await openPage(browser, { url: pathToFileURL(path).href, width, height, dpr });
  try {
    const data = read ? await page.evalIn(read) : null;
    const png = await page.shot({ full });
    if (savePng && rel.endsWith('.html')) writeFileSync(join(PKG, rel.replace(/\.html$/, '.png')), png);
    return { png, data, path, sha: sha(png) };
  } finally { await page.close(); }
}

/**
 * HOW MUCH OF THE SCENE AN EVENT ACTUALLY CHANGES — the extent measurement that is on the picture.
 *
 * I-08B3.1-F2's R-FOOTPRINT and check C-06 both measure extent along the 1-D falloff of ONE source,
 * converted to pixels. That is the right instrument for a shape and the wrong one for a stain: the
 * stain risk is at SCENE scale, where five INSIGHT lobes overlap and a per-source bound each lobe
 * satisfies can still cover half the world between them. This counts the fraction of the rendered
 * world whose colour moves by more than a just-noticeable step between two frames, in OKLab, on the
 * rasters the boards publish — so "it does not flood the World" becomes a number about the World.
 *
 * The comparison is perceptual and not per-channel, because a channel delta of 1 on a near-white
 * ground and a channel delta of 1 on a near-black one are not the same event, and the two
 * appearances are exactly that comparison.
 */
export async function perceptualExtent(restPng, peakPng, jnd) {
  const { decode } = await import('../vendor/f1/vendor/lib/png.mjs');
  const { dEok, rgb8ToHex } = await import('./f2-color.mjs');
  const A = decode(restPng), B = decode(peakPng);
  if (A.width !== B.width || A.height !== B.height) {
    return { comparable: false, reason: 'different dimensions', a: [A.width, A.height], b: [B.width, B.height] };
  }
  /* MEMOISED ON THE PAIR OF COLOURS, not computed per pixel. A full-frame OKLab conversion of two
     390x844 DPR-1 rasters is 658,000 pairs and almost all of them are the same pair repeated —
     unchanged ground against unchanged ground. The cache turns the measurement from minutes into
     under a second without approximating anything. */
  const cache = new Map();
  let changed = 0, worst = 0;
  const total = A.width * A.height;
  for (let i = 0; i < A.rgba.length; i += 4) {
    if (A.rgba[i] === B.rgba[i] && A.rgba[i + 1] === B.rgba[i + 1] && A.rgba[i + 2] === B.rgba[i + 2]) continue;
    const key = (A.rgba[i] << 24 | A.rgba[i + 1] << 16 | A.rgba[i + 2] << 8 | A.rgba[i + 3] >> 4) * 16777216
      + (B.rgba[i] << 16 | B.rgba[i + 1] << 8 | B.rgba[i + 2]);
    let d = cache.get(key);
    if (d === undefined) {
      d = dEok(rgb8ToHex([A.rgba[i], A.rgba[i + 1], A.rgba[i + 2]]), rgb8ToHex([B.rgba[i], B.rgba[i + 1], B.rgba[i + 2]]));
      cache.set(key, d);
    }
    if (d > worst) worst = d;
    if (d > jnd) changed++;
  }
  return {
    comparable: true, pixels: total, changedBeyondAJND: changed,
    fractionOfTheWorld: +(changed / total).toFixed(5),
    worstDEok: +worst.toFixed(4),
    distinctColourPairs: cache.size,
  };
}

/** Per-pixel comparison of two PNGs, decoded rather than hashed, so "how different" has an
 *  answer and not only "different". */
export async function pixelDiff(aPng, bPng) {
  const { decode } = await import('../vendor/f1/vendor/lib/png.mjs');
  const A = decode(aPng), B = decode(bPng);
  if (A.width !== B.width || A.height !== B.height) {
    return { identical: false, reason: 'different dimensions', a: [A.width, A.height], b: [B.width, B.height] };
  }
  let differing = 0, maxDelta = 0;
  for (let i = 0; i < A.rgba.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.rgba[i + c] - B.rgba[i + c]));
    if (d > 0) { differing++; if (d > maxDelta) maxDelta = d; }
  }
  return { identical: differing === 0, pixels: A.width * A.height, differing, maxChannelDelta: maxDelta };
}
