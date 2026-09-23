/**
 * I-08B3.1-B4 - a DTCG 2025.10 parser, alias resolver and validator.
 *
 * WRITTEN FROM THE NORMATIVE TEXT, NOT FROM A LIBRARY.
 *
 * Every rule below is transcribed from the Design Tokens Format Module and Color Module source
 * read this session and recorded in `docs/B4_REFERENCE_GATE.md`. That matters more here than it
 * would in ordinary tooling, for one reason: the thing B4 has to PROVE is that four Product roles
 * resolve to ONE source token. A third-party resolver would hand back four equal colours and call
 * that success. Four equal colours is exactly the failure the brief forbids - "Do NOT duplicate
 * #181818 four times" - and it is indistinguishable from the success case unless the resolver keeps
 * the REFERENCE CHAIN, not just the answer.
 *
 * So `resolve()` returns, for every token, the full chain of paths it travelled. The one-tone
 * invariant is then a statement about chains that happens to imply a statement about colours,
 * rather than a statement about colours that hopes to imply something about structure.
 */

/* ------------------------------------------------------------------ structure --------- */

/** Reserved words may not be token or group NAMES; a name may not start with `$`. */
const NAME_FORBIDDEN = /[{}.]/;

export class DtcgError extends Error {
  constructor(path, msg) {
    super(`${path.length ? path.join('.') : '(root)'}: ${msg}`);
    this.path = path.slice();
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Walk a DTCG document into a flat map of tokens and a flat map of groups.
 *
 * "An object with a `$value` property is a token." A node carrying BOTH `$value` and child members
 * is invalid and is reported rather than guessed at - the Format Module calls objects that are
 * simultaneously tokens and groups an invalid structure.
 */
export function parse(doc, { file = '(inline)' } = {}) {
  const tokens = new Map();
  const groups = new Map();
  const errors = [];

  const walk = (node, path, inheritedType) => {
    if (!isPlainObject(node)) {
      errors.push(new DtcgError(path, `expected a JSON object, found ${Array.isArray(node) ? 'an array' : typeof node}`));
      return;
    }
    const children = Object.keys(node).filter((k) => !k.startsWith('$'));
    const ownType = typeof node.$type === 'string' ? node.$type : undefined;
    if (node.$type !== undefined && typeof node.$type !== 'string') {
      errors.push(new DtcgError(path, '`$type` MUST be a plain JSON string'));
    }
    const type = ownType ?? inheritedType;

    if (Object.prototype.hasOwnProperty.call(node, '$value')) {
      if (children.length) {
        errors.push(new DtcgError(path,
          `carries \`$value\` AND ${children.length} child member(s) (${children.join(', ')}) - ` +
          'an object may be a token or a group, never both'));
      }
      tokens.set(path.join('.'), {
        path: path.slice(), file,
        value: node.$value,
        ownType, type,
        description: typeof node.$description === 'string' ? node.$description : undefined,
        extensions: isPlainObject(node.$extensions) ? node.$extensions : undefined,
        deprecated: node.$deprecated,
      });
      return;
    }

    groups.set(path.join('.'), {
      path: path.slice(), file, ownType,
      description: typeof node.$description === 'string' ? node.$description : undefined,
      children,
    });
    for (const name of children) {
      if (name.startsWith('$')) continue;           // unreachable: filtered above, kept for intent
      if (NAME_FORBIDDEN.test(name)) {
        errors.push(new DtcgError(path.concat(name),
          'a token or group name MUST NOT contain `{`, `}` or `.`'));
        continue;
      }
      walk(node[name], path.concat(name), type);
    }
  };

  walk(doc, [], undefined);
  return { tokens, groups, errors };
}

/* --------------------------------------------------------------------- aliases -------- */

/**
 * The curly-brace reference syntax. "The curly brace syntax is specifically designed for
 * referencing complete token values and always resolves to the `$value` property of the target
 * token."
 *
 * Deliberately anchored and deliberately intolerant of nesting: `{a.{b}}` is not a reference, it is
 * a typo, and a permissive regex would resolve it to something.
 */
const ALIAS = /^\{([^{}]+)\}$/;

export const isAlias = (v) => typeof v === 'string' && ALIAS.test(v);
export const aliasTarget = (v) => {
  const m = typeof v === 'string' ? v.match(ALIAS) : null;
  return m ? m[1] : null;
};

/**
 * Resolve every token, following alias chains and REPORTING THE CHAIN.
 *
 * "Aliases MAY reference other aliases. In this case, tools MUST follow each reference until they
 * find a token with an explicit value."
 *
 * "References MUST NOT be circular. If a design token file contains circular references, then the
 * value of all tokens in that chain is unknown and an appropriate error or warning message SHOULD
 * be displayed to the user."
 *
 * A dangling reference is NOT an internal error here. It is the mechanism B4 uses to prove that no
 * Light colour was invented: resolving the semantic layer against the empty Light appearance leaves
 * the canonical chain hanging, and `state: 'UNRESOLVED'` is the evidence. So it is returned as
 * data, with the exact path that could not be found.
 */
export function resolve(parsed) {
  const out = new Map();
  const { tokens } = parsed;

  const one = (key, seen) => {
    if (out.has(key)) return out.get(key);
    const tok = tokens.get(key);
    if (!tok) return null;

    if (!isAlias(tok.value)) {
      const rec = { ...tok, state: 'RESOLVED', chain: [key], source: key, resolved: tok.value,
        resolvedType: tok.type };
      out.set(key, rec);
      return rec;
    }

    const target = aliasTarget(tok.value);
    if (seen.includes(key)) {
      const rec = { ...tok, state: 'CIRCULAR', chain: seen.concat(key), source: null, resolved: undefined,
        detail: `reference cycle: ${seen.concat(key).join(' -> ')}` };
      out.set(key, rec);
      return rec;
    }
    if (!tokens.has(target)) {
      const rec = { ...tok, state: 'UNRESOLVED', chain: [key, target], source: null, resolved: undefined,
        detail: `references \`{${target}}\`, which is not a token in this document` };
      out.set(key, rec);
      return rec;
    }
    const next = one(target, seen.concat(key));
    const rec = {
      ...tok,
      state: next.state,
      chain: [key, ...next.chain],
      source: next.source,
      resolved: next.resolved,
      /* "or be an alias of a token that has the desired type" - an alias with no `$type` of its own
         and no inherited one takes the type of what it points at. */
      resolvedType: tok.type ?? next.resolvedType,
      detail: next.detail,
    };
    out.set(key, rec);
    return rec;
  };

  for (const key of tokens.keys()) one(key, []);
  return out;
}

/* ----------------------------------------------------------------------- colour ------- */

/**
 * The Color Module's colour value: `colorSpace` and `components` are required, `alpha` and `hex`
 * optional. "If omitted, the alpha value of the color MUST be assumed to be 1 (fully opaque)."
 * `hex` "MUST be formatted in 6 digit CSS hex color notation format to avoid conflicts with the
 * provided alpha value."
 *
 * B4 authors ONLY sRGB, and the checker is written to accept the spec's full list while the
 * PACKAGE's own rules - enforced separately in `b4-invariants.mjs` - narrow it to sRGB. Mixing the
 * two would make a QANDEEL rule look like a specification rule.
 */
export const COLOR_SPACES = [
  'srgb', 'srgb-linear', 'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch',
  'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz-d65', 'xyz-d50',
];

const HEX6 = /^#[0-9a-f]{6}$/;

export function checkColor(value, path) {
  const errs = [];
  const at = path.join('.');
  if (!isPlainObject(value)) {
    errs.push(`${at}: a \`color\` token's \`$value\` MUST be an object with \`colorSpace\` and \`components\``);
    return errs;
  }
  if (typeof value.colorSpace !== 'string') errs.push(`${at}: missing \`colorSpace\``);
  else if (!COLOR_SPACES.includes(value.colorSpace)) errs.push(`${at}: unknown colorSpace \`${value.colorSpace}\``);
  if (!Array.isArray(value.components)) errs.push(`${at}: missing \`components\` array`);
  else {
    if (value.components.length !== 3) errs.push(`${at}: expected 3 components, found ${value.components.length}`);
    /**
     * RANGE-CHECKED FOR THE RGB FAMILY ONLY, and the narrowness is deliberate.
     *
     * The Color Module states the sRGB range as 0 to 1. It is checked here because the failure it
     * catches is silent: paste 8-bit values into `components` - which is the single most natural
     * mistake for anyone who has ever written a hex - and every serialiser clamps them, so a
     * `[24, 24, 24]` Surface becomes WHITE with no error anywhere. Probe `v-n3` is that paste, and
     * it walked through the first version of this function untouched.
     *
     * The other colour spaces are NOT range-checked, because their ranges were not among the
     * normative text read for this package and a guessed range is worse than no range. A package
     * that authors sRGB only can say that honestly instead of pretending to a generality it has
     * not verified.
     */
    const rgbFamily = ['srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020'];
    value.components.forEach((c, i) => {
      if (c === 'none') return;                      // the spec's missing-component keyword
      if (typeof c !== 'number' || !Number.isFinite(c)) {
        errs.push(`${at}: component ${i} is neither a number nor the \`none\` keyword`);
        return;
      }
      if (rgbFamily.includes(value.colorSpace) && (c < 0 || c > 1)) {
        errs.push(`${at}: component ${i} is ${c}, outside the 0..1 range of \`${value.colorSpace}\` - ` +
          'a serialiser would clamp this silently rather than reject it');
      }
    });
  }
  if (value.alpha !== undefined) {
    if (typeof value.alpha !== 'number' || !(value.alpha >= 0 && value.alpha <= 1)) {
      errs.push(`${at}: \`alpha\` MUST be a number between 0 and 1, found ${JSON.stringify(value.alpha)}`);
    }
  }
  if (value.hex !== undefined) {
    if (typeof value.hex !== 'string' || !HEX6.test(value.hex)) {
      errs.push(`${at}: \`hex\` MUST be 6-digit CSS hex notation, found ${JSON.stringify(value.hex)}`);
    }
  }
  return errs;
}

/** `alpha` omitted means 1. Written once so no caller has to remember it. */
export const alphaOf = (v) => (isPlainObject(v) && v.alpha !== undefined ? v.alpha : 1);

/**
 * sRGB components (0..1) -> the 8-bit hex a browser paints.
 *
 * Rounded exactly as `color.mjs` rounds, because the integration proof compares this against the
 * literal the sealed package painted with, and a half-step disagreement in rounding would look like
 * a colour disagreement.
 */
export function srgbHex(components) {
  return '#' + components.map((c) => {
    const n = c === 'none' ? 0 : c;
    return Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0');
  }).join('');
}

/** The CSS a component would consume. Opaque colours stay hex; an alpha channel becomes rgba(). */
export function toCss(value) {
  const hex = value.hex ?? srgbHex(value.components);
  const a = alphaOf(value);
  if (a === 1) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------------------------------------------------------------------- typing -------- */

/**
 * "A token must either have a `$type` property specifying the chosen type, inherit a type from one
 * of its parent groups, or be an alias of a token that has the desired type."
 */
export function validate(parsed, resolved) {
  const errors = parsed.errors.map((e) => e.message);
  for (const [key, rec] of resolved) {
    if (rec.state === 'CIRCULAR') { errors.push(`${key}: ${rec.detail}`); continue; }
    if (rec.state === 'UNRESOLVED') continue;        // reported by the caller as a STATE, not an error
    if (!rec.resolvedType) {
      errors.push(`${key}: has no \`$type\`, inherits none from a parent group, and is not an alias of a typed token`);
      continue;
    }
    if (rec.resolvedType === 'color') errors.push(...checkColor(rec.resolved, rec.path));
  }
  return errors;
}

/* ------------------------------------------------------------------- composition ------ */

/**
 * Merge token documents "in array order", later occurrences overriding earlier ones - the
 * Resolver Module's set semantics, applied to plain objects.
 *
 * Deep merge, because two sources describing different branches of the same group must coexist:
 * that is precisely how the semantic layer and an appearance layer combine here.
 */
export function mergeDocs(docs) {
  const out = {};
  const into = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (isPlainObject(v) && isPlainObject(dst[k]) && !('$value' in v) && !('$value' in dst[k])) into(dst[k], v);
      else dst[k] = isPlainObject(v) ? JSON.parse(JSON.stringify(v)) : v;
    }
    return dst;
  };
  for (const d of docs) into(out, d);
  return out;
}

/** Parse + resolve + validate in one step, which is how every caller actually uses this. */
export function load(doc, opts = {}) {
  const parsed = parse(doc, opts);
  const resolved = resolve(parsed);
  const errors = validate(parsed, resolved);
  const unresolved = [...resolved.values()].filter((r) => r.state === 'UNRESOLVED');
  const circular = [...resolved.values()].filter((r) => r.state === 'CIRCULAR');
  return { parsed, resolved, errors, unresolved, circular };
}
