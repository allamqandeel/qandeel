/**
 * T-11 — the visual proof's renderer: the REAL component tree, as a document a browser lays out.
 *
 * ## What this is, and what it is not
 *
 * The test renderer has no layout engine, so a component test can prove structure and never
 * appearance. This converts the tree that renderer produced — the real elements, with the real
 * resolved React Native styles — into HTML plus a stylesheet that reproduces Yoga's defaults, so a
 * browser lays it out with a real flexbox engine and, critically, a real TEXT engine.
 *
 * That makes it the right instrument for exactly one class of question, and the wrong one for
 * everything else:
 *
 *   it CAN answer — does the longest Arabic return hint wrap cleanly at 320 points and at 200 %
 *   text, does a paired cell hold its words in short landscape, does anything clip, does anything
 *   overlap, does an expansive window read as air rather than as a dashboard;
 *
 *   it CANNOT answer — how the platform's own type engine shapes those strings, what a real
 *   safe-area provider reports, or how a real window manager drives a continuous resize. Those are
 *   `QAN-BL-RSP-01`, and nothing produced here is ever cited as if it had answered them.
 *
 * The Skia canvas is drawn from the same mocked elements the component tests read, positioned by
 * the very `cx`/`cy`/`r` the renderer asked Skia for. It is an honest depiction of the placement,
 * and it is not a proof of the placement: that is `placeScene`, tested exactly.
 */

interface Element {
  readonly type?: string;
  readonly props?: Record<string, unknown>;
  readonly children?: unknown;
}

const KEBAB = (key: string): string => key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

const LENGTHS = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'top', 'right', 'bottom', 'left',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginHorizontal', 'marginVertical',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingHorizontal', 'paddingVertical',
  'fontSize', 'lineHeight', 'borderWidth', 'borderLeftWidth', 'borderRadius', 'rowGap', 'columnGap', 'gap', 'flexBasis',
]);

const EXPAND: Record<string, readonly string[]> = {
  paddingHorizontal: ['padding-left', 'padding-right'],
  paddingVertical: ['padding-top', 'padding-bottom'],
  marginHorizontal: ['margin-left', 'margin-right'],
  marginVertical: ['margin-top', 'margin-bottom'],
};

/** Flattens a React Native style prop exactly as the platform composes it. */
export function flatten(style: unknown, out: Record<string, unknown> = {}): Record<string, unknown> {
  if (style === null || style === undefined || typeof style !== 'object') return out;
  if (Array.isArray(style)) {
    for (const entry of style) flatten(entry, out);
    return out;
  }
  Object.assign(out, style as Record<string, unknown>);
  return out;
}

/**
 * The reader's text scale, applied the way the platform applies it.
 *
 * React Native multiplies an explicit `fontSize` by the system font scale unless a component opts
 * out — and nothing in this Product opts out. CSS does not: `font-size: 15px` is 15px whatever the
 * root size is. Without this, the one text that matters most under Dynamic Type — the chrome, which
 * sets its sizes explicitly — would be the one text the picture showed unscaled, and the picture
 * would be reassuring about exactly the case it was made to examine.
 */
let textScale = 1;

function declarations(style: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined || typeof value === 'object') continue;
    const scaled = typeof value === 'number' && (key === 'fontSize' || key === 'lineHeight') ? value * textScale : value;
    const rendered = typeof scaled === 'number' && LENGTHS.has(key) ? `${scaled}px` : String(scaled);
    const expanded = EXPAND[key];
    if (expanded !== undefined) {
      for (const property of expanded) parts.push(`${property}:${rendered}`);
      continue;
    }
    // Logical inset, the way React Native writes it.
    if (key === 'start') parts.push(`inset-inline-start:${rendered}`);
    else if (key === 'end') parts.push(`inset-inline-end:${rendered}`);
    else parts.push(`${KEBAB(key)}:${rendered}`);
  }
  return parts.join(';');
}

const escape = (text: string): string =>
  text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');

/** A Skia element the renderer asked for, drawn where it asked for it. */
function skia(element: Element, inner: string): string | null {
  const props = element.props ?? {};
  const kind = props.skiaElement;
  const color = typeof props.color === 'string' ? props.color : 'transparent';
  const opacity = typeof props.opacity === 'number' ? `;opacity:${props.opacity}` : '';
  if (kind === 'Circle') {
    const cx = Number(props.cx ?? 0);
    const cy = Number(props.cy ?? 0);
    const r = Number(props.r ?? 0);
    return `<div class="skia" style="left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:${color}${opacity}"></div>`;
  }
  if (kind === 'Rect') {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    return `<div class="skia" style="left:${x}px;top:${y}px;width:${Number(props.width ?? 0)}px;height:${Number(props.height ?? 0)}px;background:${color}${opacity}"></div>`;
  }
  if (kind === 'Line') {
    const p1 = (props.p1 ?? { x: 0, y: 0 }) as { x: number; y: number };
    const p2 = (props.p2 ?? { x: 0, y: 0 }) as { x: number; y: number };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return `<div class="skia" style="left:${p1.x}px;top:${p1.y}px;width:${length}px;height:1px;background:${color};transform:rotate(${angle}deg);transform-origin:0 0"></div>`;
  }
  if (kind === 'Canvas') {
    const style = flatten(props.style);
    return `<div class="skia-canvas" style="${declarations(style)}">${inner}</div>`;
  }
  if (kind === 'Group') return `<div class="skia-group">${inner}</div>`;
  return null;
}

/** Every host element type the converter has met, so an unhandled one cannot pass silently. */
export const seenTypes = new Set<string>();

function walk(node: unknown): string {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string') return escape(node);
  if (typeof node === 'number') return escape(String(node));
  if (Array.isArray(node)) return node.map(walk).join('');
  const element = node as Element;
  if (typeof element.type !== 'string') return walk(element.children);
  seenTypes.add(element.type);
  const props = element.props ?? {};
  const inner = walk(element.children);
  const drawn = skia(element, inner);
  if (drawn !== null) return drawn;
  const style = flatten(props.style);
  const testID = typeof props.testID === 'string' ? ` data-id="${escape(props.testID)}"` : '';
  const role = typeof props.accessibilityRole === 'string' ? ` data-role="${escape(props.accessibilityRole)}"` : '';
  const label = typeof props.accessibilityLabel === 'string' ? ` data-label="${escape(props.accessibilityLabel)}"` : '';
  const attributes = `${testID}${role}${label}`;

  // A scroll container clips its content and lays it out along its own axis. Without this a
  // virtualized horizontal list becomes an unbounded column, and every picture below it is of a
  // layout the Product never produces.
  if (element.type === 'RCTScrollView') {
    const axis = props.horizontal === true ? 'row' : 'column';
    return `<rn-scroll${attributes} style="${declarations(style)};flex-direction:${axis}">${inner}</rn-scroll>`;
  }
  if (element.type === 'TextInput') {
    const value = typeof props.value === 'string' ? props.value : typeof props.placeholder === 'string' ? props.placeholder : '';
    return `<rn-input${attributes} style="${declarations(style)}">${escape(value)}</rn-input>`;
  }
  const tag = element.type === 'Text' ? 'rn-text' : 'rn-view';
  return `<${tag}${attributes} style="${declarations(style)}">${inner}</${tag}>`;
}

/** Yoga's defaults, as CSS. Without these a browser lays the same tree out as a different one. */
export const RESET = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
rn-view, rn-text, rn-scroll, rn-input {
  display: flex; flex-direction: column; align-items: stretch; align-content: flex-start;
  flex-shrink: 0; flex-basis: auto; position: relative; min-width: 0; min-height: 0;
}
rn-text { display: block; white-space: pre-wrap; word-wrap: break-word; }
rn-text rn-text { display: inline; }
rn-scroll { overflow: hidden; }
rn-input { display: block; border: 1px solid rgb(190,190,186); border-radius: 4px; padding: 6px 8px; min-height: 44px; }
.skia-canvas { position: relative; overflow: hidden; display: block; }
.skia-group { position: absolute; inset: 0; }
.skia { position: absolute; }
body {
  font-family: 'Segoe UI', 'Tahoma', 'Noto Sans Arabic', 'Arial', sans-serif;
  font-size: 14px; line-height: 1.6; color: rgb(28,28,26); background: rgb(246,246,244);
}
`;

export interface DocumentOptions {
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly rtl: boolean;
  readonly language: 'ar' | 'en';
  readonly fontScale: number;
  readonly caption: string;
}

/**
 * One scenario as a standalone document, sized to exactly the window under test.
 *
 * The font scale is applied as a root `font-size` multiplier, which is what a text-size preference
 * does to a layout: the words get bigger and everything downstream of them reflows. It is a
 * faithful model of the pressure, and it is not the platform's own type engine.
 */
export function document(tree: unknown, options: DocumentOptions): string {
  textScale = options.fontScale;
  const frame =
    `.frame { width: ${options.width}px; height: ${options.height}px; overflow: hidden; ` +
    'margin: 0 auto; box-shadow: 0 0 0 1px rgb(180,180,176); background: rgb(255,255,255); ' +
    `font-size: ${(14 * options.fontScale).toFixed(2)}px; }\n` +
    '.frame > rn-view { width: 100%; height: 100%; }\n' +
    ".caption { font: 12px/1.5 'Segoe UI', sans-serif; color: rgb(90,90,86); padding: 8px 0 10px; direction: ltr; text-align: left; }";
  return [
    '<!doctype html>',
    `<html lang="${options.language}" dir="${options.rtl ? 'rtl' : 'ltr'}">`,
    '<head><meta charset="utf-8">',
    `<title>${escape(options.title)}</title>`,
    `<style>${RESET}${frame}</style>`,
    '</head>',
    '<body>',
    `<div class="caption">${escape(options.caption)}</div>`,
    `<div class="frame">${walk(tree)}</div>`,
    '</body></html>',
  ].join('\n');
}

export { walk as renderTree };
