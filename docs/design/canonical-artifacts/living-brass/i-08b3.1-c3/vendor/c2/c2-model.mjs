/**
 * I-08B3.1-C2 — THE FROZEN STATE, THE ONE ACCEPTED BODY, AND THE TWO COVERAGE POLICIES.
 *
 * NOTHING IN THIS FILE IS CANONICAL. No value below is a token, the package contains no token file,
 * and C2 may not declare one. The Design Director selects.
 *
 * WHAT CHANGED FROM C1R, AND WHY EACH CHANGE IS STRUCTURAL RATHER THAN EDITORIAL:
 *
 *   1. THERE IS ONE BODY. C0 and C1 are CLOSED. BODY A and BODY B are RETIRED and are not carried as
 *      controls — so this file contains exactly one Brass value, and `c2-preflight.mjs` asserts that
 *      the retired hexes appear nowhere in the package except in the retirement record that names
 *      them as retired. A control that is not supposed to exist should be impossible to build, not
 *      merely absent.
 *
 *   2. THE VARIABLE IS NO LONGER A COLOUR. It is a COVERAGE POLICY: which Product objects are made
 *      of the one material. So the two policies below are not two palettes. They are two answers to
 *      "how much of QANDEEL is made of this", and the ONLY difference between a P1 frame and a P2
 *      frame anywhere in this package is the paint inside the five persistent navigation icons.
 *
 *   3. THERE IS NO THIRD POLICY, AND IT IS UNREACHABLE RATHER THAN UNDOCUMENTED. `policyMaterials`
 *      cannot return Brass for a functional control or for anything on the analytical plane, and no
 *      parameter on any environment builder can put Brass there. The one prohibited composition the
 *      brief asks for is built by a separate function whose name says what it is, and the preflight
 *      asserts that function is called only from the failure captures.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { srgbToOklch, hexToRgb8, contrastHex, relativeLuminance, resolve } from './color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const PROJECT = join(PKG, '..');

/* ================================================== FROZEN. Reproduced, never redefined. === */

export const WORLD = '#101010';
export const SURFACE = '#181818';
export const PRIMARY = '#d8d5ca';
export const SECONDARY = '#afaca3';
export const TERTIARY = '#8b8982';
export const SCRIM_ALPHA = 0.50;

/** Frozen in I-08B3.0. `leading` is the pair the UNITLESS ratio is derived from, never a length. */
export const ROLES = {
  statement:    { size: 32, leading: 52, weight: 500, label: 'Meaningful Statement' },
  compactStmt:  { size: 26, leading: 42, weight: 500, label: 'Compact Meaningful Statement' },
  screenTitle:  { size: 26, leading: 42, weight: 600, label: 'Screen Title' },
  sectionTitle: { size: 20, leading: 33, weight: 600, label: 'Section Title' },
  body:         { size: 17, leading: 30, weight: 400, label: 'Primary Body' },
  supporting:   { size: 15, leading: 25, weight: 400, label: 'Supporting Body' },
  action:       { size: 14, leading: 23, weight: 500, label: 'Action / Label' },
  metadata:     { size: 12, leading: 20, weight: 500, label: 'Metadata' },
};

export const oklchOf = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255));

export const RAMP = [PRIMARY, SECONDARY, TERTIARY].map((hex) => {
  const [L, C, H] = oklchOf(hex);
  return { hex, L, C, H, Y: relativeLuminance(hexToRgb8(hex)) };
});

/* ==================================================== WHAT C2 MAY NOT DECLARE ============== */

export const C2_MAY_NOT_DECLARE = [
  'that #a58e6f is canonical',
  'a final Living Brass token',
  'a final interaction policy',
  'a final Light behaviour',
  'that the C track is frozen',
];

/** The brief's own list, reproduced so the preflight can assert each one structurally. */
export const BRASS_DOES_NOT_ENCODE = [
  'selection', 'pressed', 'focus', 'disabled', 'status', 'success', 'warning', 'confidence',
  'evidence', 'recency', 'analytical importance', 'FAR / MID / NEAR', 'premium entitlement',
];

export const DOCTRINE = 'BRASS IS MATTER. LIGHT IS MEANING. ACTIVITY IS PROCESS.';

/* ================================ THE PRODUCT OWNER REFERENCE — SCOPE AS CORRECTED IN C1R == */

/**
 * C1R.8's correction is INHERITED, not re-argued. The photograph is an UNCALIBRATED directional
 * reference; a pixel distribution measured out of it is a measurement OF THAT FILE. `c2-preflight.mjs`
 * carries C1R's withdrawn-phrase scan forward unchanged, because the surest way for a withdrawn
 * formulation to come back is for the next package to stop looking for it.
 */
export const HUE_ENTITLEMENT =
  'H~75 deg is the current visually selected QANDEEL Living Brass hue direction, consistent with the ' +
  'supplied material reference and stronger than the tested reading-ramp hue. It is DESIGN-DIRECTOR ' +
  'SELECTED, NOT CANONICAL, NOT FROZEN.';

export const WITHDRAWN_PHRASES = [
  'the measured material hue',
  'the intrinsic hue',
  'the measured material position',
  'physically intrinsic brass',
  'the intrinsic colour of brass',
];

export const MATERIAL_HUE = 75;

/* ============================================== THE ONE BODY ENTERING C2 =================== */

/**
 * BODY C — SELECTED FOR C2 PRODUCT INTEGRATION. NOT CANONICAL. NOT FROZEN.
 *
 * Exactly the value C1R measured and the Design Director selected. `expectedHex` is asserted by the
 * preflight against an independent resolution of the authored triple, so a typo cannot quietly
 * become a different material.
 *
 * NO RECALIBRATION IS AVAILABLE ANYWHERE IN THIS PACKAGE. There is no second body, no opacity
 * variant, no darkened variant and no reduced-chroma variant. If the material is too strong in an
 * environment, C2's only available report is an APPLICATION failure — which is the instruction, and
 * is enforced by there being nothing else to reach for.
 */
export const BODY = {
  key: 'C',
  from: 'I-08B3.1-C1R BODY C, selected by the Independent Design Director',
  L: 0.660, C: 0.052, H: MATERIAL_HUE,
  expectedHex: '#a58e6f',
  status: 'SELECTED FOR C2 PRODUCT INTEGRATION / NOT CANONICAL / NOT FROZEN',
};

/**
 * RETIRED BY THE DESIGN DIRECTOR. Recorded so the preflight can assert they are not built, and so a
 * reader of this file cannot mistake their absence for an oversight.
 *
 * `hex` is held here as DATA rather than as prose precisely so the colour audit can recognise these
 * two strings when it meets them in the retirement record and refuse them everywhere else.
 */
export const RETIRED = [
  { key: 'BODY A', hex: '#857867', why: 'retired by the Design Director after C1R; not carried as a control' },
  { key: 'BODY B', hex: '#95836c', why: 'retired by the Design Director after C1R; not carried as a control' },
  { key: 'D-2 FORMED', hex: null, why: 'retired in C1R; implemented as an absence — no shade parameter, no shade branch, no crease' },
];

/* ============================= THE ACCEPTED MATERIAL DIRECTION (from C1R) =================== */

export const DIRECTION = {
  name: 'QUIET SATIN BODY + BRUSHED / HANDLED LARGE IDENTITY CHARACTER',
  smallScale: 'QUIET SATIN BODY — one tone. No grain, no shade, no second tone, no gradient.',
  largeScale: 'the SAME body, carrying the restrained brushed/handled character architecture.',
  neverList: ['no glow', 'no highlight', 'no metallic ramp', 'no specular response', 'no gradient',
    'no bevel', 'no emboss', 'no gloss', 'no reflection', 'no jewellery polish'],
};

/** Accepted from C1R unchanged. One amplitude, one frequency pair, one alpha map, one seed. */
export const CHARACTER = {
  targetAmplitude: 0.032,
  fx: 0.0035, fy: 0.040, numOctaves: 2, seed: 11,
  alphaK: 1.8, alphaBias: -0.72,
  amplitudeToToneDepth: 1 / 0.63,
};

export const CHARACTER_IS_SUBTRACTIVE_ONLY = true;

/** Below this rendered mark width the character is NOT EMITTED AT ALL. Applied inside `material()`. */
export const GRAIN_MIN_PX = 96;

/* ===================================================== RESOLUTION ========================= */

function pack(r) {
  return {
    hex: r.hex, rgb8: r.rgb8, inGamut: r.inGamut, clipped: r.clipped,
    actual: r.actual, drift: r.drift, luminance: r.luminance,
    contrastWorld: contrastHex(r.hex, WORLD),
    contrastSurface: contrastHex(r.hex, SURFACE),
    greyRatioToTertiary: r.luminance / relativeLuminance(hexToRgb8(TERTIARY)),
    greyRatioToSecondary: r.luminance / relativeLuminance(hexToRgb8(SECONDARY)),
    greyRatioToPrimary: r.luminance / relativeLuminance(hexToRgb8(PRIMARY)),
  };
}

export function resolveBody() {
  const r = resolve([BODY.L, BODY.C, BODY.H], `BODY ${BODY.key}`);
  return {
    key: BODY.key, from: BODY.from, expectedHex: BODY.expectedHex, status: BODY.status,
    authored: { L: BODY.L, C: BODY.C, H: BODY.H },
    body: pack(r),
  };
}

export const RESOLVED = resolveBody();

/** The character's darker tone: ONE step below the body, at the body's OWN hue and chroma. */
export function characterShade(resolved = RESOLVED) {
  const depth = CHARACTER.targetAmplitude * CHARACTER.amplitudeToToneDepth;
  return resolve([resolved.authored.L - depth, resolved.authored.C, resolved.authored.H],
    `BODY ${resolved.key} character`);
}

/**
 * The achromatic value whose WCAG relative luminance is closest to a given colour's.
 *
 * This is the control for C2.11, and it is the only honest one: replacing Brass with an arbitrary
 * grey changes hue AND rank at once, and a test that moves two things cannot attribute what it sees
 * to either. Matching luminance isolates the removal of WARMTH from the removal of WEIGHT.
 */
export function luminanceMatchedNeutral(hex) {
  const target = relativeLuminance(hexToRgb8(hex));
  let best = null;
  for (let v = 0; v < 256; v++) {
    const g = '#' + [v, v, v].map((c) => c.toString(16).padStart(2, '0')).join('');
    const d = Math.abs(relativeLuminance([v, v, v]) - target);
    if (!best || d < best.d) best = { hex: g, code: v, d, luminance: relativeLuminance([v, v, v]) };
  }
  return { ...best, target, of: hex };
}

/** The smallest achromatic value clearing a contrast target on a given ground. B1's solver. */
export function solveNeutral(bgHex, target = 3.0) {
  let lo = 0, hi = 255;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const hex = '#' + [mid, mid, mid].map((c) => c.toString(16).padStart(2, '0')).join('');
    if (contrastHex(hex, bgHex) >= target) hi = mid; else lo = mid + 1;
  }
  const hex = '#' + [lo, lo, lo].map((c) => c.toString(16).padStart(2, '0')).join('');
  return { hex, code: lo, ratio: contrastHex(hex, bgHex), target, on: bgHex };
}

/* ================================================ THE CANONICAL MARK ====================== */

/** C1R.9's fix, inherited: the mark is PACKAGE-LOCAL and exact-byte. External masters cross-check. */
export const MARK_LOCAL = join(PKG, 'reference', 'canonical', 'QANDEEL_Q_BASE_MASTER.svg');
export const MARK_EXTERNAL = [
  ['I-08B3.1-C1R package-local snapshot', join(PROJECT, 'I-08B3.1-C1R-LIVING-BRASS-BODY-PRESENCE-RESOLUTION', 'reference', 'canonical', 'QANDEEL_Q_BASE_MASTER.svg')],
  ['I-08B2.5 production master', join(PROJECT, 'I-08B2.5-FINAL-BRAND-ASSET-PACKAGE', 'masters', 'QANDEEL_Q_BASE_MASTER.svg')],
  ['I-08B2.3 approved reconstruction master', join(PROJECT, 'I-08B2.3-Q-WORDMARK-PRODUCTION-RECONSTRUCTION', 'masters', 'QANDEEL_Q_BASE_MASTER.svg')],
];

export const MARK_PATH_IDS = ['q-ring', 'q-tail', 'q-light-core'];

export function extractMark(file) {
  const raw = readFileSync(file);
  const svg = raw.toString('utf8');
  const vb = svg.match(/viewBox="([^"]+)"/);
  if (!vb) throw new Error(`${file}: no viewBox`);
  const paths = {};
  for (const id of MARK_PATH_IDS) {
    const m = svg.match(new RegExp(`<path id="${id}" d="([^"]+)"`));
    if (!m) throw new Error(`${file}: path #${id} not found — the canonical mark cannot be read`);
    paths[id] = m[1];
  }
  return {
    file, viewBox: vb[1], paths, bytes: raw.length,
    sha256: createHash('sha256').update(raw).digest('hex'),
    pathHashes: Object.fromEntries(MARK_PATH_IDS.map((id) =>
      [id, createHash('sha256').update(paths[id], 'utf8').digest('hex')])),
  };
}

export const MARK = extractMark(MARK_LOCAL);
export const MARK_VB = MARK.viewBox.split(/\s+/).map(Number);

export function crosscheckMark() {
  return MARK_EXTERNAL.map(([label, file]) => {
    if (!existsSync(file)) return { label, file, present: false };
    const m = extractMark(file);
    return {
      label, file, present: true,
      wholeFileIdentical: m.sha256 === MARK.sha256,
      pathsIdentical: MARK_PATH_IDS.every((id) => m.paths[id] === MARK.paths[id]),
      viewBoxIdentical: m.viewBox === MARK.viewBox,
      sha256: m.sha256,
    };
  });
}

/* ================================================== THE TWO COVERAGE POLICIES ============== */

/**
 * P1 and P2 differ in ONE fact and nothing else: whether the five persistent navigation icons are
 * made of the material. Everything else on every screen — the canonical Q in the standing machinery,
 * the large identity moment, the neutral functional controls, the neutral analytical plane, the
 * neutral state carrier, the copy, the geometry — is the same under both.
 *
 * That is deliberate and it is the whole experimental design. The Design Director's question is a
 * question about COVERAGE, so the comparison must vary coverage and nothing else. If P1 and P2 also
 * differed in mark size, in ink rank, in layout or in copy, then every difference a reviewer saw
 * would be a difference of several things at once — which is exactly the confound C1R-REV-01 was
 * written to retire.
 */
export const POLICIES = [
  {
    key: 'P1', name: 'SIGNATURE MATERIAL',
    summary: 'Living Brass appears only on clearly identity-bearing QANDEEL material moments.',
    brassOn: ['the canonical Q in the standing machinery', 'the large identity moment'],
    neutral: ['the persistent navigation family', 'every functional control', 'the analytical plane',
      'every reading object', 'the state carrier'],
    question: 'Beautifully restrained, or so rare that QANDEEL returns to almost monochrome?',
  },
  {
    key: 'P2', name: 'IDENTITY MACHINERY FAMILY',
    summary: 'The canonical Q PLUS the persistent navigation icon family carry the SAME Living Brass.',
    brassOn: ['the canonical Q in the standing machinery', 'the large identity moment',
      'all five persistent navigation icons, at every state, without exception'],
    neutral: ['every functional control', 'the analytical plane', 'every reading object',
      'the state carrier'],
    question: 'The warm break the Product Owner responded to, or generic gold-accent navigation?',
  },
];

/**
 * THERE IS NO P3, AND THE ABSENCE IS IMPLEMENTED.
 *
 * The forbidden third policy is "some selected icons Brass" or "whichever looks better per screen".
 * The first is forbidden because it would make Brass encode selection; the second because it would
 * make Brass mean a different thing on different screens. Note that the SECOND of those is also
 * forbidden by the primary source — see C2_REFERENCE_REFRESH — which warns against using one colour
 * to mean different things. QANDEEL's rule and the platform's rule agree here.
 */
export const NO_P3 = {
  forbidden: ['some selected icons Brass', 'different screens use whichever looks better'],
  ifNeitherWorks: 'REPORT THE CONTRADICTION. Do not create a compromise.',
};

/** The neutral a navigation icon carries when the policy does not make it Brass. */
export const NAV_NEUTRAL = SECONDARY;
/** The neutral every functional control carries under BOTH policies. */
export const FUNCTIONAL_NEUTRAL = TERTIARY;
/** What Brass Removal replaces Brass with: the rank standing machinery would have without it. */
export const REMOVAL_NEUTRAL = SECONDARY;

/**
 * THE POLICY RESOLVER — the single place a policy becomes paint.
 *
 * It returns a material for each of the four PERMISSION CLASSES the material story audit uses, and
 * it can only ever return Brass for two of them. There is no argument that makes `functional` or
 * `analytical` Brass. This is why C2 has no P3 and why no board can accidentally put Brass on the
 * analytical plane: not because the boards are careful, but because they have no way to ask.
 */
export function policyBrassClasses(policyKey) {
  if (policyKey === 'P1') return { identityMark: true, navFamily: false };
  if (policyKey === 'P2') return { identityMark: true, navFamily: true };
  throw new Error(`no policy ${policyKey} — C2 compares exactly two, and there is no third`);
}

/* ======================================================== THE ICON FAMILIES =============== */

export const ICON_STROKE = 1.75;

/**
 * THE PERSISTENT NAVIGATION FAMILY — the five marks whose paint IS the policy difference.
 *
 * Carried unchanged from C1/C1R on purpose: C2 compares COVERAGE, and a new icon set would be a
 * second variable. NOTHING HERE IS A FINAL ICON SET; C2 may not declare an icon policy.
 */
export const ICONS = [
  { key: 'map',      label: 'الخريطة',    d: 'M4.5 17.5 L10 12 L14.5 15 L19.5 7',    dots: [[4.5, 17.5], [10, 12], [14.5, 15], [19.5, 7]] },
  { key: 'log',      label: 'السجل',      d: 'M4.5 7 H19.5 M4.5 12 H15 M4.5 17 H17.5', dots: [] },
  { key: 'sources',  label: 'المصادر',    d: 'M7.5 5.5 H16.5 V15 H7.5 Z M5 9 V18.5 H14.5', dots: [] },
  { key: 'saved',    label: 'المحفوظات',  d: 'M7 4.5 H17 V19.5 L12 15.5 L7 19.5 Z',  dots: [] },
  { key: 'account',  label: 'الحساب',     d: 'M12 5 A3.6 3.6 0 1 1 12 12.2 A3.6 3.6 0 1 1 12 5 M5.5 19.5 A6.5 6.5 0 0 1 18.5 19.5', dots: [] },
];

/**
 * FUNCTIONAL ICONS — interior controls. NEUTRAL UNDER BOTH POLICIES, ALWAYS.
 *
 * These exist so that "interior functional controls do NOT automatically become Brass" is a thing
 * the boards SHOW rather than a thing the documents claim. A settings screen with no functional
 * icons in it cannot demonstrate that they stayed neutral.
 */
export const FUNCTIONAL_ICONS = {
  send:    'M4.5 12 H18 M12.5 6.5 L19 12 L12.5 17.5',
  search:  'M11 4.8 A6.2 6.2 0 1 1 11 17.2 A6.2 6.2 0 1 1 11 4.8 M15.6 15.6 L19.5 19.5',
  add:     'M12 5.5 V18.5 M5.5 12 H18.5',
};

/* ========================================================= SCALES ========================= */

export const SCALES = [
  { key: 'nav',   px: 24,  label: 'PERSISTENT NAVIGATION', note: 'the tab-bar family at its real size' },
  { key: 'mach',  px: 30,  label: 'STANDING MACHINERY',    note: 'the canonical Q in the apparatus — the size every Product screen uses' },
  { key: 'ident', px: 260, label: 'LARGE IDENTITY MOMENT', note: 'the one composition where the brushed/handled character exists at all' },
];

export const MARK_PX_IN_MACHINERY = SCALES[1].px;
export const IDENTITY_PX = SCALES[2].px;
export const NAV_PX = SCALES[0].px;

/* ============================================ THE DIAGNOSTIC STATE CARRIER ================ */

/**
 * INHERITED FROM C1R UNCHANGED — and inheriting it is the point, not a convenience.
 *
 * It is two achromatic things at once: type weight and ink rank satisfy WCAG 2.2 SC 1.4.1 on their
 * own, and the 2 px achromatic rule is what makes the state findable at a glance. Neither is a
 * colour, so under P2 — where every navigation icon is Brass at every state — nothing about state
 * changes at all. That is what "Brass NEVER turns on because an item is selected" means when it is
 * implemented rather than promised.
 *
 * C2 may not design a final interaction colour and does not. Final interaction styling is E's.
 */
export const STATE_CARRIER = {
  what: 'neutral type weight and ink rank, plus a 2 px achromatic rule above the selected item',
  selectedInk: PRIMARY, selectedWeight: 600,
  restInk: TERTIARY, restWeight: 500,
  disabledInk: '#5a5a58',
  ruleThickness: 2,
};

/**
 * THE KNOWN DISABLED COLLISION, carried forward as a DEPENDENCY and not solved here.
 *
 * C1R recorded that the disabled neutral sits close enough to the rest-state ink to be argued with,
 * and that the collision gets WORSE as the body gets stronger. BODY C is the strongest body tested.
 * The brief for C2 says explicitly: do not solve disabled styling here. So C2 measures it, shows it,
 * and hands it to E rather than quietly fixing it and losing the record of it.
 */
export const DISABLED_IS_E_DEPENDENCY = true;

/* ======================================================== COPY ============================ */

/**
 * NUMERALS: Eastern Arabic-Indic only. The preflight walks these objects and scans their STRING
 * LEAVES only — a Map node's `x: 52` is geometry, not copy, and a numeral check that fires on a
 * coordinate is a check that gets switched off the first time it fires.
 *
 * THE MAP BUNDLE IS CARRIED VERBATIM FROM C1R, which carried it verbatim from B3/B3R. Re-authoring
 * it would make C2's Map a different product from B's and C1R's, and every comparison against the
 * accepted quality bar would be worthless. The three NEW environments are written to the same
 * register: modern standard Arabic, analytical, unhurried, no exclamation, no product-voice cheer.
 */

const QANDEEL_MAP = {
  title: 'خريطة التحليل',
  period: 'آخر ٣٠ يومًا',
  order: 'الترتيب',
  nodes: [
    { t: 'التقييم بعد الالتزام', depth: 'near', x: 52, y: 44 },
    { t: 'البحث عن الاحتمال الفائت', depth: 'mid', x: 72, y: 20 },
    { t: 'الهدوء قبل الاختيار', depth: 'mid', x: 40, y: 74 },
    { t: 'إعادة فتح السؤال', depth: 'mid', x: 78, y: 62 },
    { t: 'طلب رأي بعد القرار', depth: 'mid', x: 24, y: 30 },
    { t: 'حسم سريع تحت ضغط', depth: 'far', x: 58, y: 86 },
    { t: 'تأجيل بلا سبب معلن', depth: 'far', x: 86, y: 40 },
    { t: 'مراجعة متأخرة', depth: 'far', x: 30, y: 56 },
    { t: 'قرار مؤجّل', depth: 'far', x: 16, y: 78 },
    { t: 'اقتناع متأخر', depth: 'far', x: 66, y: 8 },
  ],
  edges: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 6], [1, 9], [2, 5], [2, 7], [4, 7], [4, 8], [3, 6]],
  provenance: 'أحد عشر مصدرًا من المحادثات',
  updated: 'آخر تحديث ١٤ سبتمبر',
  entries: [
    { t: 'يتغيّر تقييمك للقرار بعد أن يصير نهائيًّا',
      s: 'ما دام القرار قابلًا للتراجع يبقى التوتر منخفضًا، فإذا صار نهائيًّا انتقل انتباهك إلى ما فاتك.',
      m: ['أحد عشر مصدرًا', 'آخر ظهور ١٤ سبتمبر'] },
    { t: 'البحث عن الاحتمال الفائت لا ينتهي من تلقاء نفسه',
      s: 'لأنه لا يطلب جوابًا بل طمأنينة، فلا يجد ما يوقفه.',
      m: ['ستة مصادر', 'آخر ظهور ١٣ سبتمبر'] },
  ],
};

const QANDEEL_CONVERSATION = {
  title: 'محادثة',
  period: 'اليوم',
  order: 'المصادر',
  /* `who` is 'you' or 'q'. No bubbles, no cards: the World stays dominant and the turns are told
     apart by ink rank and by type role, which is what B0's hierarchy already does everywhere else. */
  turns: [
    { who: 'you', t: 'قرّرتُ ترك العمل، ومع ذلك ما زلت أُعيد التفكير فيه كل يوم.' },
    { who: 'q',   t: 'القرار أُغلق والسؤال بقي مفتوحًا. الذي يتكرّر عندك ليس التردّد قبل الاختيار، بل إعادة فتح السؤال بعده.' },
    { who: 'you', t: 'هل يحدث هذا في كل شيء، أم في العمل وحده؟' },
    { who: 'q',   t: 'ظهر في أربعة مواضع حتى الآن: العمل، والسكن، ومرّتين في علاقة قريبة. المشترك بينها أن القرار كان نهائيًّا وقت ظهوره.' },
    { who: 'you', t: 'وما الذي يوقفه؟' },
    { who: 'q',   t: 'لا شيء يوقفه من تلقاء نفسه، لأنه لا يطلب جوابًا بل طمأنينة. ما أنهاه في المرّات السابقة كان أثرًا صغيرًا ملموسًا، لا مراجعة أطول.' },
  ],
  composer: 'اكتب ما يشغلك',
  provenance: 'ستّ رسائل في هذه المحادثة',
  updated: 'آخر رسالة قبل دقيقتين',
};

const QANDEEL_READING = {
  appTitle: 'قراءة', appPeriod: 'تحليل', appOrder: 'أحد عشر مصدرًا',
  title: 'لماذا يعود السؤال بعد أن يُحسم',
  lede: 'تحليل مبنيّ على أحد عشر موضعًا من محادثاتك خلال الشهر الأخير.',
  blocks: [
    { k: 'p', t: 'ما دام القرار قابلًا للتراجع، يبقى جزء من انتباهك مشغولًا بالمقارنة: أمامك بابان، وبإمكانك أن تُبدّل. هذا الانشغال مُكلف لكنه مفهوم، ولا يُنتج توترًا كبيرًا لأن الكلفة ما زالت قابلة للاسترداد.' },
    { k: 'p', t: 'ثم يُغلق الباب، فتتوقّع أن يهدأ الانتباه ويحدث العكس: ينتقل من المقارنة بين خيارين حاضرين إلى البحث عن الاحتمال الذي فات.' },
    { k: 'h', t: 'ما الذي يجعل السؤال الثاني أطول عمرًا' },
    { k: 'p', t: 'أن الأول يقبل الحسم والثاني لا يقبله. المقارنة بين خيارين حاضرين تنتهي باختيار أحدهما؛ أمّا المقارنة بين ما حدث وما لم يحدث فلا تنتهي.' },
    { k: 'q', t: 'السؤال الذي لا يطلب جوابًا لا يجد ما يُسكته.' },
    { k: 'p', t: 'لهذا يبدو التوتر بعد القرار غير متناسب مع أهميته. أنت لا تُراجع اختيارًا، بل تُغذّي احتمالًا لا حدّ له، ومع كل مراجعة يصير الاحتمال الغائب أكثر اكتمالًا لأنك أنت من يُكمله.' },
    { k: 'p', t: 'وما أنهاه في المواضع الأربعة التي ظهر فيها عندك لم يكن اقتناعًا جديدًا، بل أثرًا صغيرًا ملموسًا يجعل للقرار وزنًا في الواقع لا في التخيّل.' },
  ],
  provenance: 'أحد عشر مصدرًا من المحادثات',
  updated: 'آخر تحديث ١٤ سبتمبر',
};

const QANDEEL_UTILITY = {
  title: 'الإعدادات',
  period: 'حسابك',
  order: 'مُزامَن',
  sections: [
    { h: 'الحساب', rows: [
      { l: 'نوع الحساب', v: 'شخصي' },
      { l: 'المصادر المتّصلة', v: 'ثلاثة' },
    ] },
    { h: 'الخصوصية', rows: [
      { l: 'ما يُحفظ من محادثاتك', v: 'المحادثات المكتملة فقط' },
      { l: 'مشاركة التحليل', v: 'لا أحد' },
      { l: 'حذف سجلّ التحليل', v: '' },
    ] },
    { h: 'القراءة والعرض', rows: [
      { l: 'حجم النص', v: 'متوسط' },
      { l: 'اللغة', v: 'العربية' },
      { l: 'التنبيهات', v: 'عند اكتمال تحليل' },
    ] },
    { h: 'عن التطبيق', rows: [
      { l: 'الإصدار', v: '٢٫٤٫٠' },
      { l: 'سياسة الخصوصية', v: '' },
    ] },
  ],
  provenance: 'آخر مزامنة ١٤ سبتمبر',
  updated: 'الإصدار ٢٫٤٫٠',
};

export const QANDEEL_IDENTITY_LINE = 'نُركّب خريطة تحليلك الآن';

export const COPY = {
  brand: 'QANDEEL',
  map: QANDEEL_MAP,
  conversation: QANDEEL_CONVERSATION,
  reading: QANDEEL_READING,
  utility: QANDEEL_UTILITY,
  identity: { line: QANDEEL_IDENTITY_LINE },
};

/* ------------------------------------------------------------------ THE SWAPS ------------ */

/**
 * C2.8 and C2.9. ONLY copy and product mark change. No geometry, no colour, no spacing, no material,
 * no coverage. A swap frame under P1 and the same swap frame under P2 differ by exactly what a
 * QANDEEL P1 and P2 frame differ by — the paint of the navigation family — so the swap measures the
 * POLICY's transferability rather than the relabel's.
 *
 * THE REGISTER IS CHOSEN TO BE AS FAVOURABLE AS POSSIBLE TO EACH RELABEL. A swap test that writes
 * weak copy for the swapped product is a swap test designed to pass. These are written as if the
 * relabelled product were real and well made.
 */
export const SWAPS = {
  bank: {
    kind: 'luxury', markKind: 'luxury',
    label: 'PRIVATE BANK',
    utility: {
      title: 'الإعدادات', period: 'حسابك الخاص', order: 'مُزامَن',
      sections: [
        { h: 'الحساب', rows: [
          { l: 'فئة العضوية', v: 'خاصّة' },
          { l: 'الحسابات المرتبطة', v: 'ثلاثة' },
        ] },
        { h: 'الخصوصية', rows: [
          { l: 'ما يُحفظ من عملياتك', v: 'العمليات المكتملة فقط' },
          { l: 'مشاركة كشف الحساب', v: 'لا أحد' },
          { l: 'حذف سجلّ العمليات', v: '' },
        ] },
        { h: 'التفضيلات', rows: [
          { l: 'حجم النص', v: 'متوسط' },
          { l: 'اللغة', v: 'العربية' },
          { l: 'التنبيهات', v: 'عند كل عملية' },
        ] },
        { h: 'عن التطبيق', rows: [
          { l: 'الإصدار', v: '٢٫٤٫٠' },
          { l: 'شروط الخدمة', v: '' },
        ] },
      ],
      provenance: 'آخر مزامنة ١٤ سبتمبر', updated: 'الإصدار ٢٫٤٫٠',
    },
  },
  finance: {
    kind: 'luxury', markKind: 'luxury',
    label: 'PREMIUM FINANCE',
    map: {
      title: 'خريطة محفظتك', period: 'الربع الثالث', order: 'الأصول',
      nodes: QANDEEL_MAP.nodes.map((n, i) => ({ ...n, t: [
        'الأسهم الخاصة', 'العقار المُدار', 'الدخل الثابت', 'النقد والودائع', 'الملكية البديلة',
        'صناديق التحوّط', 'المعادن', 'الأسواق الناشئة', 'السندات السيادية', 'حقوق الامتياز',
      ][i] })),
      edges: QANDEEL_MAP.edges,
      provenance: 'أحد عشر أصلًا تحت الإدارة',
      updated: 'آخر تقييم ١٤ سبتمبر',
      entries: [
        { t: 'ارتفع صافي محفظتك ثلاثة بالمئة هذا الربع',
          s: 'يعود أكثره إلى الملكية الخاصة، ويبقى التوزيع ضمن النطاق المتّفق عليه.',
          m: ['أحد عشر أصلًا', 'حتى ١٤ سبتمبر'] },
        { t: 'مستشارك الخاص متاح للقاء هذا الأسبوع',
          s: 'يمكنك اختيار موعد في المكتب أو في مقرّ إقامتك.',
          m: ['خدمة الأعضاء', 'آخر تحديث ١٣ سبتمبر'] },
      ],
    },
  },
  hotel: {
    kind: 'luxury', markKind: 'luxury',
    label: 'LUXURY HOTEL',
    conversation: {
      title: 'خدمة النزلاء', period: 'اليوم', order: 'الجناح',
      turns: [
        { who: 'you', t: 'حجزتُ الجناح لثلاث ليالٍ، وأودّ تمديد الإقامة ليلة رابعة.' },
        { who: 'q',   t: 'الجناح متاح في الليلة الرابعة بالسعر نفسه. سأُثبّت التمديد فور تأكيدك، ويبقى الوصول المتأخّر مفتوحًا كما هو.' },
        { who: 'you', t: 'وهل يبقى المطعم مفتوحًا بعد منتصف الليل؟' },
        { who: 'q',   t: 'المطبخ الرئيسي يغلق في الحادية عشرة، وتبقى خدمة الغرف طوال الليل. يمكنني حجز طاولة عند الشرفة في العاشرة إن أحببت.' },
        { who: 'you', t: 'احجز الطاولة من فضلك.' },
        { who: 'q',   t: 'حُجزت طاولة الشرفة في العاشرة باسمك. سيصلك تأكيد على الرقم المسجّل، ويمكنك تعديل الموعد حتى الثامنة مساءً.' },
      ],
      composer: 'اكتب طلبك',
      provenance: 'ستّ رسائل في هذه المحادثة',
      updated: 'آخر رسالة قبل دقيقتين',
    },
  },
  notes: {
    kind: 'generic', markKind: 'generic',
    label: 'NOTES APP',
    reading: {
      appTitle: 'ملاحظة', appPeriod: 'العمل', appOrder: 'محفوظة',
      title: 'ملاحظات اجتماع الاثنين',
      lede: 'محفوظة في مجلّد العمل، وآخر تعديل قبل ساعتين.',
      blocks: [
        { k: 'p', t: 'اتفقنا على تأجيل إطلاق النسخة الجديدة أسبوعين حتى تكتمل المراجعة. المسؤول عن المتابعة فريق المنتج، والموعد الجديد يُبلَّغ يوم الخميس.' },
        { k: 'p', t: 'بقيت ثلاث نقاط مفتوحة من الاجتماع السابق ولم يُحسم منها شيء، وسأعيد طرحها في أول اللقاء القادم.' },
        { k: 'h', t: 'ما يحتاج قرارًا قبل الخميس' },
        { k: 'p', t: 'الميزانية الإضافية للاختبار، وعدد الأجهزة المطلوبة، والترجمة قبل الإطلاق أم بعده. الثلاثة مرتبطة ولا يصحّ حسم واحد منها وحده.' },
        { k: 'q', t: 'لا تُقفل بندًا واحدًا من ثلاثة مرتبطة.' },
        { k: 'p', t: 'المقترح أن نجتمع نصف ساعة يوم الأربعاء ونخرج بقرار واحد يشمل الثلاثة، ثم نُبلّغ الفريق صباح الخميس قبل انتهاء الدوام.' },
        { k: 'p', t: 'ذكّرني بمراجعة هذه الملاحظة قبل الاجتماع، وأضف إليها ما يستجدّ من الفريق خلال اليومين القادمين.' },
      ],
      provenance: 'مجلّد العمل', updated: 'آخر تعديل قبل ساعتين',
    },
  },
  habits: {
    kind: 'generic', markKind: 'generic',
    label: 'HABIT TRACKER',
    map: {
      title: 'عاداتك', period: 'آخر ٣٠ يومًا', order: 'الترتيب',
      nodes: QANDEEL_MAP.nodes.map((n, i) => ({ ...n, t: [
        'القراءة', 'المشي', 'النوم مبكرًا', 'شرب الماء', 'التأمل',
        'الكتابة', 'التمرين', 'الادّخار', 'المذاكرة', 'الامتنان',
      ][i] })),
      edges: QANDEEL_MAP.edges,
      provenance: 'ستّ عادات متابَعة',
      updated: 'آخر تحديث ١٤ سبتمبر',
      entries: [
        { t: 'أتممت القراءة اثني عشر يومًا متتاليًا',
          s: 'أطول سلسلة لك حتى الآن، وأفضل أوقاتك بعد التاسعة مساءً.',
          m: ['اثنتا عشرة مرّة', 'آخر مرّة ١٤ سبتمبر'] },
        { t: 'المشي أسهل عليك في أول الأسبوع',
          s: 'أنجزته في أربعة من خمسة أيام، وتراجع في نهاية الأسبوع.',
          m: ['ست مرّات', 'آخر مرّة ١٣ سبتمبر'] },
      ],
    },
  },
  productivity: {
    kind: 'generic', markKind: 'generic',
    label: 'PRODUCTIVITY UTILITY',
    utility: {
      title: 'الإعدادات', period: 'مساحة العمل', order: 'مُزامَن',
      sections: [
        { h: 'الحساب', rows: [
          { l: 'نوع الخطة', v: 'مجانية' },
          { l: 'الأجهزة المتّصلة', v: 'ثلاثة' },
        ] },
        { h: 'المهامّ', rows: [
          { l: 'ما يُحفظ من المهامّ', v: 'المهامّ المكتملة فقط' },
          { l: 'مشاركة القوائم', v: 'لا أحد' },
          { l: 'حذف المهامّ المنتهية', v: '' },
        ] },
        { h: 'العرض', rows: [
          { l: 'حجم النص', v: 'متوسط' },
          { l: 'اللغة', v: 'العربية' },
          { l: 'التنبيهات', v: 'عند اقتراب موعد' },
        ] },
        { h: 'عن التطبيق', rows: [
          { l: 'الإصدار', v: '٢٫٤٫٠' },
          { l: 'شروط الخدمة', v: '' },
        ] },
      ],
      provenance: 'آخر مزامنة ١٤ سبتمبر', updated: 'الإصدار ٢٫٤٫٠',
    },
  },
};

/** Inherently LEFT-TO-RIGHT machine tokens, enumerated by NAME. C2's copy carries none. */
export const LTR_TOKENS = [];

/* ============================================== THE FOUR PROOF ENVIRONMENTS =============== */

export const ENVIRONMENTS = [
  { key: 'conversation', name: 'PERSONAL CONVERSATION WORLD', nick: 'THE QUIET CORE',
    asks: 'Does Brass humanise the conversation without becoming decorative, and does the content remain the hero?' },
  { key: 'map', name: 'LIVING ANALYSIS MAP', nick: 'THE PROPRIETARY WORLD',
    asks: 'Does the Brass machinery stay clearly outside analytical semantics?' },
  { key: 'reading', name: 'DEEP ANALYSIS READING', nick: 'THE INTELLECTUAL TEST',
    asks: 'Does persistent Brass machinery stay quiet enough beside sustained reading?' },
  { key: 'utility', name: 'UTILITY / SYSTEM UI', nick: 'THE BORING-SCREEN TEST',
    asks: 'Does P2 still feel like Living Brass, or become dark-app-plus-gold-navigation?' },
];
