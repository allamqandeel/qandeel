// COSMOS-INT-01 Slice E — iOS World gate: read one XCTest-driver hierarchy dump (POST /viewHierarchy on Maestro's iOS
// driver: `{ axElement: { identifier, label, value, enabled, selected, frame, children } }`).
// usage: node hier.mjs <dump.json> id <identifier>        -> "enabled=<bool> frame=x,y,w,h" per match, or "none"
//        node hier.mjs <dump.json> id-prefix <prefix>     -> "<identifier> enabled=<bool> frame=…" per match, or "none"
//        node hier.mjs <dump.json> label <regex>          -> the labels matching the regex, or "none"
//        node hier.mjs <dump.json> id-label <identifier>  -> the label of each element with that identifier, or "none"
//        node hier.mjs <dump.json> selected-label         -> the labels of the selected elements, or "none"
// Only identifiers, flags, frames and the labels a query asks for are printed; nothing else of the screen leaves the runner.
import fs from 'node:fs';

const [file, mode, arg] = process.argv.slice(2);
let root;
try { root = JSON.parse(fs.readFileSync(file, 'utf8')).axElement; } catch { console.log('none'); process.exit(0); }
const out = [];
const frame = (f) => (f === undefined ? '?' : [f.X, f.Y, f.Width, f.Height].map((n) => Math.round(n)).join(','));
const visit = (node) => {
  if (node === null || typeof node !== 'object') return;
  const id = node.identifier ?? '';
  if (mode === 'id' && id === arg) out.push(`enabled=${node.enabled} frame=${frame(node.frame)}`);
  if (mode === 'id-prefix' && id.startsWith(arg)) out.push(`${id} enabled=${node.enabled} frame=${frame(node.frame)}`);
  if (mode === 'label' && typeof node.label === 'string' && node.label !== '' && new RegExp(arg, 'u').test(node.label)) out.push(node.label);
  if (mode === 'id-label' && id === arg) out.push(String(node.label ?? ''));
  // The depth rail's lit point is the one selected button among the stage's controls (Overview is selected only while on).
  if (mode === 'selected-label' && node.selected === true && typeof node.label === 'string' && node.label !== '') out.push(node.label);
  for (const child of node.children ?? []) visit(child);
};
visit(root);
console.log(out.length === 0 ? 'none' : out.join('\n'));
