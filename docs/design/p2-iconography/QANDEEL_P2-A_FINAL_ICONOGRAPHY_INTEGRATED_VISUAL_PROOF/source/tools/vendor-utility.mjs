// P2-A — vendors the utility-family comparison glyphs, once, from each library's own published npm package (served by
// jsDelivr, which mirrors npm byte-for-byte). Proof evidence only: nothing here is a dependency of apps/mobile, and no
// package is installed. Each glyph is stored with its library, exact package version, source URL and SHA-256, beside
// the library's licence text. Re-run only to refresh the evidence: `node tools/vendor-utility.mjs`.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'vendor', 'utility');
const sha = (s) => createHash('sha256').update(s).digest('hex');

// The representative utility set (P2 task §12): the same eight meanings in every library.
export const ROLES = ['close', 'edit', 'settings', 'chevron', 'overflow', 'add', 'back', 'search'];

const LIBS = {
  hugeicons: {
    title: 'Hugeicons Free (Stroke Rounded)', pkg: '@hugeicons/core-free-icons', version: '4.3.5', license: 'MIT', grid: 24,
    licenseUrl: 'https://raw.githubusercontent.com/hugeicons/hugeicons/main/LICENSE.md',
    url: (n) => `https://cdn.jsdelivr.net/npm/@hugeicons/core-free-icons@4.3.5/dist/esm/${n}.js`,
    names: { close: 'Cancel01Icon', edit: 'PencilEdit02Icon', settings: 'Settings01Icon', chevron: 'ArrowRight01Icon', overflow: 'MoreHorizontalIcon', add: 'PlusSignIcon', back: 'ArrowLeft02Icon', search: 'Search01Icon' },
  },
  lucide: {
    title: 'Lucide', pkg: 'lucide-static', version: '1.48.0', license: 'ISC', grid: 24,
    licenseUrl: 'https://cdn.jsdelivr.net/npm/lucide-static@1.48.0/LICENSE',
    url: (n) => `https://cdn.jsdelivr.net/npm/lucide-static@1.48.0/icons/${n}.svg`,
    names: { close: 'x', edit: 'pencil', settings: 'settings', chevron: 'chevron-right', overflow: 'ellipsis', add: 'plus', back: 'arrow-left', search: 'search' },
  },
  tabler: {
    title: 'Tabler (outline)', pkg: '@tabler/icons', version: '3.48.0', license: 'MIT', grid: 24,
    licenseUrl: 'https://cdn.jsdelivr.net/npm/@tabler/icons@3.48.0/LICENSE',
    url: (n) => `https://cdn.jsdelivr.net/npm/@tabler/icons@3.48.0/icons/outline/${n}.svg`,
    names: { close: 'x', edit: 'pencil', settings: 'settings', chevron: 'chevron-right', overflow: 'dots', add: 'plus', back: 'arrow-left', search: 'search' },
  },
  iconoir: {
    title: 'Iconoir (regular)', pkg: 'iconoir', version: '7.12.1', license: 'MIT', grid: 24,
    licenseUrl: 'https://cdn.jsdelivr.net/npm/iconoir@7.12.1/LICENSE',
    url: (n) => `https://cdn.jsdelivr.net/npm/iconoir@7.12.1/icons/regular/${n}.svg`,
    names: { close: 'xmark', edit: 'edit-pencil', settings: 'settings', chevron: 'nav-arrow-right', overflow: 'more-horiz', add: 'plus', back: 'arrow-left', search: 'search' },
  },
  phosphor: {
    title: 'Phosphor (regular)', pkg: '@phosphor-icons/core', version: '2.1.1', license: 'MIT', grid: 256,
    licenseUrl: 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/LICENSE',
    url: (n) => `https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/${n}.svg`,
    names: { close: 'x', edit: 'pencil-simple', settings: 'gear-six', chevron: 'caret-right', overflow: 'dots-three', add: 'plus', back: 'arrow-left', search: 'magnifying-glass' },
  },
};

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

// Hugeicons ships each glyph as a JS array of [tag, attrs]; turn it into SVG markup with the attributes it declares.
function hugeToSvg(js) {
  const body = js.slice(js.indexOf('['), js.lastIndexOf(']') + 1);
  const arr = Function(`return ${body}`)();
  const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  const inner = arr.map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">${inner}</svg>`;
}

const out = { vendoredAt: new Date().toISOString().slice(0, 10), roles: ROLES, libraries: {} };
mkdirSync(OUT, { recursive: true });
for (const [key, lib] of Object.entries(LIBS)) {
  const glyphs = {};
  for (const role of ROLES) {
    const name = lib.names[role], url = lib.url(name), raw = await get(url);
    const svg = key === 'hugeicons' ? hugeToSvg(raw) : raw.replace(/<!--[\s\S]*?-->/g, '').trim();
    glyphs[role] = { name, url, sha256: sha(raw), svg };
  }
  const licence = await get(lib.licenseUrl);
  writeFileSync(join(OUT, `LICENSE-${key}.txt`), licence);
  out.libraries[key] = { title: lib.title, pkg: lib.pkg, version: lib.version, license: lib.license, grid: lib.grid, licenseFile: `LICENSE-${key}.txt`, licenseSha256: sha(licence), glyphs };
  console.log(key, Object.keys(glyphs).length);
}
writeFileSync(join(OUT, 'utility-glyphs.json'), JSON.stringify(out, null, 1) + '\n');
