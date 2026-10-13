// LANG-01 — the Arabic an approved string carries in production after the LANG-01 controlled amendment.
//
// The earlier contracts pin their approved Arabic byte-for-byte, and their implementation records keep those bytes as
// history. A contract's record check keeps the recorded original; its code check reads `lang01(original)`, which is the
// exact replacement the resolved manifest gives for every unit LANG-01 implements, and the original itself for every
// other string. The manifest is derived from the Product Owner's register and the pinned census, and the LANG-01
// contract re-derives it, so no replacement is typed twice.
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../docs/e2e/lang-01/QANDEEL_LANG_01_RESOLVED_APPROVAL_MANIFEST_v1.json', import.meta.url), 'utf8'));

/** The source forms of the two isolated substitutions, and the placeholders the records write instead. */
const RECORD_FORMS = [[/\$\{isolate\(displayName\)\}/gu, '{display_name}'], [/\$\{isolate\(email\)\}/gu, '{email}']];
const recordForm = (text) => RECORD_FORMS.reduce((value, [pattern, placeholder]) => value.replace(pattern, placeholder), text);

const AMENDED = new Map();
for (const item of manifest.items) {
  if (item.disposition !== 'IMPLEMENT') continue;
  AMENDED.set(item.original, item.resolvedText);
  AMENDED.set(recordForm(item.original), recordForm(item.resolvedText));
  // PC-01: W1A-01 keeps the full stop only in the T-08 stance slot; the other surface carries the state without it.
  if (item.id === 'PC-01') AMENDED.set(item.original.replace(/\.$/u, ''), item.resolvedText.replace(/\.$/u, ''));
}

/** The production Arabic of an approved string: its LANG-01 replacement when LANG-01 amended it, else itself. */
export function lang01(text) {
  return AMENDED.get(text) ?? text;
}
