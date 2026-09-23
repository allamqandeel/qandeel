/**
 * I-08B3.1-D2R — THE TYPEFACE, AS A RECORDED DEPENDENCY RATHER THAN A SHIPPED BINARY.
 *
 * The brief is explicit twice over: use the locally installed / project-approved Estedad v8.5
 * runtime, record its version and hash as a dependency, and ship NO font binary inside the
 * review package — no .ttf, .otf, .woff or .woff2 in the archive.
 *
 * READ THE SECOND HALF LITERALLY AND YOU GET THE WRONG PACKAGE. I-08B3.1-D0 and D0R both
 * inlined the woff2 as a `data:font/woff2;base64,…` URI inside the prototype's stylesheet.
 * That produces an archive containing no file with a font extension AND containing the entire
 * font binary. The point of the constraint is not the file extension; it is that this package
 * does not redistribute the typeface. So the test this module enforces is the one that
 * matters — NO FONT BYTES IN ANY SHIPPED FILE, IN ANY ENCODING — and preflight P6 checks it by
 * scanning every file in the package for woff2/woff/OTTO/TrueType magic and for any `data:`
 * URI with a font media type, rather than by looking at filenames.
 *
 * WHAT THE PROTOTYPE DOES INSTEAD. It carries an `@font-face` whose `src` is a `file://` URL
 * pointing at the project-local Estedad v8.5 runtime resolved below. The rendered evidence a
 * Product Owner actually looks at — the videos, the stills, the board — carries the typeface as
 * PIXELS, which is not redistribution of a font.
 *
 * THE COST, STATED PLAINLY: the shipped prototype renders in Estedad only on a machine that has
 * this font at one of the paths below. On any other machine it falls back and the Arabic is
 * still readable but is not the product's face. That is a real limitation of the artefact and
 * it is in README.md, not only here.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/**
 * WHERE THE PROJECT'S ESTEDAD LIVES, most authoritative first.
 *
 * The first entry is the unpacked upstream v8.5 release itself. The other two are the copies
 * I-08B3.1-D0 and D0R vendored, kept as candidates so this package still builds if the raw
 * release directory is cleaned — and, more usefully, so the agreement between all three can be
 * CHECKED. If two candidates are present and disagree, the build stops: a package that silently
 * picked whichever copy it found first would be recording a hash for a file it had not chosen
 * on purpose.
 */
export const FONT_CANDIDATES = [
  'E:/QANDEEL/QANDEEL PROJECT/.i08b3-work/raw/estedad-v8.5/Estedad-v8.5/Estedad[wght].woff2',
  'E:/QANDEEL/QANDEEL PROJECT/I-08B3.1-D0R-GUIDED-THREAD-P2-CORRECTION/source/fonts/Estedad-wght.woff2',
  'E:/QANDEEL/QANDEEL PROJECT/I-08B3.1-D0-QANDEEL-LIGHT-MOTION-LANGUAGE-PROOF/source/fonts/Estedad-wght.woff2',
];

/**
 * Recorded from the upstream release metadata that shipped beside the binary
 * (`.i08b3-work/raw/estedad-METADATA.pb`), not from memory.
 */
export const FONT_PROVENANCE = {
  family: 'Estedad',
  version: 'v8.5',
  designer: 'Amin Abedi, Fontamin',
  license: 'OFL-1.1',
  axis: 'wght 100-900 (variable)',
  subsets: 'arabic, latin, latin-ext, menu, vietnamese',
  upstream: 'https://github.com/aminabedi68/Estedad',
  upstreamCommit: '69e879f78a4a1c7c4594baf7da13ba1c9f65ffd3',
  usedBy: 'I-08B3.0-E1, I-08B3.0-E3, I-08B3.1-A through D0R — the typography is held constant '
    + 'across the whole track, which is the reason this package uses it rather than choosing it',
};

export function resolveFont() {
  const found = FONT_CANDIDATES.filter((p) => existsSync(p)).map((p) => {
    const buf = readFileSync(p);
    return {
      path: p,
      bytes: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
      mtime: statSync(p).mtime.toISOString(),
      /** wOF2 — the woff2 signature, checked so a renamed .ttf cannot pass as one. */
      magic: buf.subarray(0, 4).toString('latin1'),
    };
  });

  if (!found.length) {
    throw new Error('d2-font: the project-approved Estedad v8.5 runtime was not found at any of:\n  '
      + FONT_CANDIDATES.join('\n  ')
      + '\nThis package deliberately ships no font binary. Point FONT_CANDIDATES at a local copy.');
  }
  const wrong = found.filter((f) => f.magic !== 'wOF2');
  if (wrong.length) {
    throw new Error(`d2-font: not a woff2: ${wrong.map((f) => `${f.path} (magic ${JSON.stringify(f.magic)})`).join(', ')}`);
  }
  const shas = [...new Set(found.map((f) => f.sha256))];
  if (shas.length !== 1) {
    throw new Error('d2-font: the local Estedad copies disagree, so there is no single runtime to '
      + `record:\n  ${found.map((f) => `${f.sha256}  ${f.path}`).join('\n  ')}`);
  }

  const chosen = found[0];
  return {
    ...FONT_PROVENANCE,
    ...chosen,
    url: pathToFileURL(chosen.path).href,
    candidatesPresent: found.length,
    candidatesAgree: true,
    note: 'Referenced by file:// URL from the prototype and NOT shipped. All present copies '
      + 'hash identically; the package records the hash, never the bytes.',
  };
}
