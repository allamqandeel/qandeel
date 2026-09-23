/**
 * I-08B3.0-E3 - read the facts the report states about Estedad v8.5 out of the binary.
 *
 * Nothing in section 3 of the report is quoted from a specimen page or a release note: the
 * version string, the vertical metrics, the variable axis and the OpenType feature list all
 * come from the font's own tables, read here. Minimal on purpose - a full TrueType inspector
 * is not needed to reproduce these boards.
 *
 * Emits docs/MEASUREMENTS_font-tables.json.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { PKG, SYS } from './ui.mjs';

const TTF = join(PKG, '..', '.i08b3-work', 'raw', 'estedad-v8.5', 'Estedad-v8.5', 'Estedad[wght].ttf');
const buf = readFileSync(TTF);

/**
 * Hash FIRST, before anything parses the buffer.
 * Buffer.swap16() byte-swaps IN PLACE, and a subarray is a view onto the same memory - so
 * reading one UTF-16 name string silently rewrites that region of the file buffer. Hashing
 * afterwards produced a different, wrong digest for a file whose length was still correct.
 * The name reader below now copies before swapping; this line makes the order safe anyway.
 */
const SHA256 = createHash('sha256').update(buf).digest('hex').toUpperCase();

const u16 = (o) => buf.readUInt16BE(o);
const i16 = (o) => buf.readInt16BE(o);
const u32 = (o) => buf.readUInt32BE(o);

/** Table directory. */
const tables = {};
{
  const num = u16(4);
  for (let i = 0; i < num; i++) {
    const p = 12 + i * 16;
    tables[buf.toString('latin1', p, p + 4).trim()] = { off: u32(p + 8), len: u32(p + 12) };
  }
}
const need = (t) => { if (!tables[t]) throw new Error(`missing required table: ${t}`); return tables[t].off; };

/** name table: platform 3 strings are UTF-16BE. */
function names() {
  const o = need('name');
  const count = u16(o + 2), strOff = o + u16(o + 4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const r = o + 6 + i * 12;
    const platform = u16(r), nameId = u16(r + 6), len = u16(r + 8), off = u16(r + 10);
    // Buffer.from() copies: swap16() must never touch the file buffer itself.
    const raw = Buffer.from(buf.subarray(strOff + off, strOff + off + len));
    const s = platform === 3 ? raw.swap16().toString('utf16le') : raw.toString('latin1');
    if (out[nameId] === undefined) out[nameId] = s;
  }
  return out;
}

/** GSUB/GPOS FeatureList tags, and the ScriptList tags. */
function layout(tag) {
  if (!tables[tag]) return null;
  const o = tables[tag].off;
  const scriptOff = o + u16(o + 4), featOff = o + u16(o + 6);
  const scripts = [];
  for (let i = 0, n = u16(scriptOff); i < n; i++) {
    scripts.push(buf.toString('latin1', scriptOff + 2 + i * 6, scriptOff + 6 + i * 6).trim());
  }
  const feats = new Set();
  for (let i = 0, n = u16(featOff); i < n; i++) {
    feats.add(buf.toString('latin1', featOff + 2 + i * 6, featOff + 6 + i * 6).trim());
  }
  return { scripts, features: [...feats].sort() };
}

/** fvar axes. */
function axes() {
  if (!tables.fvar) return [];
  const o = tables.fvar.off;
  const start = o + u16(o + 4), count = u16(o + 8), size = u16(o + 10);
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = start + i * size;
    out.push({
      tag: buf.toString('latin1', p, p + 4),
      min: u32(p + 4) / 65536, def: u32(p + 8) / 65536, max: u32(p + 12) / 65536,
    });
  }
  return out;
}

const head = need('head'), hhea = need('hhea'), os2 = need('OS/2'), maxp = need('maxp');
const unitsPerEm = u16(head + 18);
const fsSelection = u16(os2 + 62);
const N = names();

const typo = { ascender: i16(os2 + 68), descender: i16(os2 + 70), lineGap: i16(os2 + 72) };
const useTypo = !!(fsSelection & 0x80);
const declaredLineBox = (typo.ascender - typo.descender + typo.lineGap) / unitsPerEm;

const report = {
  generated: new Date().toISOString(),
  file: 'Estedad[wght].ttf',
  bytes: statSync(TTF).size,
  sha256: SHA256,
  name: {
    family: N[1], subfamily: N[2], version: N[5], designer: N[9],
    licence: N[13], licenceURL: N[14], typoFamily: N[16],
  },
  unitsPerEm,
  numGlyphs: u16(maxp + 4),
  usWeightClass: u16(os2 + 4),
  fsSelection_USE_TYPO_METRICS: useTypo,
  hhea: { ascender: i16(hhea + 4), descender: i16(hhea + 6), lineGap: i16(hhea + 8) },
  typo,
  win: { ascent: u16(os2 + 74), descent: u16(os2 + 76) },
  sxHeight: i16(os2 + 86), sCapHeight: i16(os2 + 88),
  xHeight_em: i16(os2 + 86) / unitsPerEm,
  capHeight_em: i16(os2 + 88) / unitsPerEm,
  declaredLineBox_em: +declaredLineBox.toFixed(4),
  declaredLineBoxSource: useTypo ? 'OS/2 sTypo* (USE_TYPO_METRICS set)' : 'hhea',
  variable: !!tables.fvar,
  axes: axes(),
  GSUB: layout('GSUB'),
  GPOS: layout('GPOS'),
  rolesDeclaredRatio: Object.fromEntries(SYS.roles.map((r) => [r.key, +(r.leading / r.size).toFixed(4)])),
  note: 'Every value above is read from the binary. The rendered-ink figures the report compares these against are in MEASUREMENTS_rendered-text.json and are measured from shaped text, not derived from this table.',
};

writeFileSync(join(PKG, 'docs', 'MEASUREMENTS_font-tables.json'), JSON.stringify(report, null, 1), 'utf8');

console.log(`${report.name.family} ${report.name.version}`);
console.log(`  bytes ${report.bytes}  sha256 ${report.sha256.slice(0, 16)}...`);
console.log(`  upem ${report.unitsPerEm}  glyphs ${report.numGlyphs}  variable ${report.variable} ${report.axes.map((a) => `${a.tag} ${a.min}..${a.max}`).join(', ')}`);
console.log(`  USE_TYPO_METRICS ${report.fsSelection_USE_TYPO_METRICS}  typo ${typo.ascender}/${typo.descender}/${typo.lineGap}  declared line box ${report.declaredLineBox_em} em`);
console.log(`  xHeight ${report.xHeight_em} em  capHeight ${report.capHeight_em} em`);
console.log(`  GSUB features: ${report.GSUB.features.join(' ')}`);
console.log(`  GPOS features: ${report.GPOS.features.join(' ')}`);
console.log(`  licence: ${String(report.name.licence).slice(0, 72)}...`);
