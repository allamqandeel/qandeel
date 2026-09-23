/**
 * I-08B3.1-C3.1 — THE CANONICAL LIVING BRASS TOKEN ARCHITECTURE.
 *
 * The token documents are authored HERE, in one file, and written out as JSON. Nothing is authored
 * twice: the JSON in `tokens/` is generated from these objects, `C3_TOKEN_ARCHITECTURE.md` quotes
 * them, and the invariants read the emitted files back off disk rather than these objects — so a
 * document that has drifted from what shipped fails rather than reads correctly.
 *
 * ── THE DECISION THAT SHAPES EVERYTHING BELOW ────────────────────────────────────────────────
 *
 * C3 DOES NOT CREATE A SECOND TOKEN SYSTEM. QANDEEL already has one: I-08B3.1-B4R froze the Surface
 * system as DTCG 2025.10 with a resolver, an appearance modifier and a contrast modifier, and it is
 * FROZEN. A Living Brass token file that stood beside it would be a second architecture with its own
 * conventions, its own appearance handling and its own idea of what "dark" means — and the first
 * time the two disagreed, the disagreement would be invisible, because nothing would be resolving
 * them together.
 *
 * So C3 EXTENDS B4's graph. Its resolver names B4's sets and C3's sets in one resolution order, the
 * B4 files are vendored EXACT-BYTE and referenced rather than copied-and-edited, and the invariants
 * verify that byte-identity against the sealed B4R package. Living Brass and the frozen neutrals
 * come out of ONE resolution, which is the only way the claim "the material sits in the frozen
 * system" can be checked rather than asserted.
 *
 * ── WHY THE COLOUR IS AUTHORED IN sRGB AND NOT IN OkLCh ──────────────────────────────────────
 *
 * The material was AUTHORED as an OkLCh triple — L 0.660, C 0.052, H 75 — and every C-stage document
 * says so. It would be tempting to store that triple, since it is the more meaningful description.
 *
 * It is stored as sRGB, and the reason is not aesthetic. The Design Director selected `#A58E6F`. The
 * accepted evidence — every raster in C1R and C2, every contrast figure, every measurement — is of
 * the 8-bit value. An OkLCh token is converted by whatever resolver consumes it, and a resolver
 * whose matrix or rounding differs by half a step emits `#a58e70` while reporting success. That is a
 * colour no one approved, shipping under the name of one they did. The authoring triple is preserved
 * in `$extensions` with its provenance, and `c3-invariants.mjs` re-derives the hex from it and
 * asserts the two agree — so the relationship is CHECKED every build instead of being a note.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BODY, RESOLVED, CHARACTER, GRAIN_MIN_PX, CHARACTER_IS_SUBTRACTIVE_ONLY, MATERIAL_HUE }
  from '../vendor/c2/c2-model.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const TOKENS_DIR = join(PKG, 'tokens');
export const DTCG_VERSION = '2025.10';

/** The one literal, as sRGB components. Derived from the hex, never typed by hand. */
const comps = (hex) => [1, 3, 5].map((i) => Number((parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(6)));

export const BODY_HEX = RESOLVED.body.hex;   // #a58e6f, resolved from the authored triple

/* =============================================================== THE EXPRESSION LAYER ===== */

/**
 * THE DARK MATERIAL EXPRESSION — and the ONLY place in QANDEEL where a Living Brass value exists.
 *
 * Every other Brass name in the system is an alias that arrives here. That is not a style
 * preference: it is what makes "there is one body" a property the build can test. A component token
 * carrying its own copy of `#a58e6f` would be indistinguishable from this one by eye and completely
 * different in kind, because it could be changed without changing the material.
 */
export const DARK_MATERIAL = {
  qandeel: {
    $type: 'color',
    expression: {
      material: {
        $description: 'Material expression, dark appearance. I-08B3.1-C3.',
        'living-brass': {
          body: {
            $value: { colorSpace: 'srgb', components: comps(BODY_HEX), hex: BODY_HEX },
            $description:
              'LIVING BRASS — THE BODY. The single Living Brass value in QANDEEL. Quiet satin: one ' +
              'tone, no gradient, no second tone, no highlight. Selected by the Independent Design ' +
              'Director at the close of I-08B3.1-C2. Every identity and navigation-machinery name ' +
              'in the semantic layer reaches this token through an alias chain, and nothing else in ' +
              'the system carries this literal.',
            $extensions: {
              'com.qandeel.provenance': {
                authoredAs: { colorSpace: 'oklch', L: BODY.L, C: BODY.C, H: BODY.H },
                authoredNote:
                  'The material was authored as this OkLCh triple and resolves to the sRGB value ' +
                  'above. The sRGB value is canonical FOR PAINTING because it is the one every ' +
                  'accepted C-stage raster, contrast figure and measurement was taken of; an OkLCh ' +
                  'token would be re-converted by each consuming resolver and could ship a ' +
                  'neighbouring colour under this name. c3-invariants.mjs re-derives the hex from ' +
                  'the triple and requires it to match (I-16).',
                authoredTripleIsAProductionInput: true,
                authoredTripleNote:
                  'THIS TRIPLE IS NOT DECORATION. It is the derivation source for the brushed/' +
                  'handled character tone — see qandeel.material.living-brass.character.derivation. ' +
                  'Deriving that tone from the 8-bit sRGB body instead produces #957f60 rather than ' +
                  'the accepted #967f60. Removing this extension would silently change the material ' +
                  'at the one place it is allowed to have character.',
                selectedIn: 'I-08B3.1-C2 (Design Director decision)',
                provenChain: ['I-08B3.1-C0R', 'I-08B3.1-C1', 'I-08B3.1-C1R', 'I-08B3.1-C2'],
                retired: [
                  { key: 'BODY A', hex: '#857867', why: 'retired by the Design Director after C1R' },
                  { key: 'BODY B', hex: '#95836c', why: 'retired by the Design Director after C1R' },
                  { key: 'D-2 FORMED', why: 'retired in C1R; implemented as an absence, not a disabled branch' },
                ],
              },
              'com.qandeel.doesNotEncode': [
                'selection', 'pressed', 'focus', 'hover', 'disabled', 'unread', 'status', 'success',
                'warning', 'confidence', 'evidence', 'recency', 'analytical importance',
                'FAR / MID / NEAR', 'premium entitlement',
              ],
            },
          },
        },
      },
    },
  },
};

/* ================================================================ THE SEMANTIC LAYER ====== */

/**
 * WHAT THINGS ARE, never what they look like. Appearance-independent, exactly as B4's semantic layer
 * is, and merged with it at resolution time.
 *
 * THE PERMISSION CLASSES ARE THE STRUCTURE. C2 proved a COVERAGE policy, and a coverage policy is a
 * statement about which classes of object are made of the material. So the tree below is organised
 * by permission class rather than by screen or by component, and a reviewer can read the entire
 * coverage policy off the alias targets: the names that reach the material ARE P2, and the names
 * that reach a neutral are everything P2 excludes.
 */
export const SEMANTIC_MATERIAL = {
  $description:
    'QANDEEL Living Brass — semantic layer. I-08B3.1-C3. Extends the frozen I-08B3.1-B4R Surface ' +
    'semantic layer; the two are resolved together and neither is complete alone.',
  qandeel: {
    identity: {
      $type: 'color',
      $description:
        'QANDEEL-OWNED IDENTITY. The permission class Living Brass exists for. Membership is not a ' +
        'matter of prominence, size or taste: an object belongs here when it is QANDEEL saying who ' +
        'it is, and C3_ICONOGRAPHY_MATERIAL_CONTRACT.md states the test it must pass.',
      material: {
        $value: '{qandeel.expression.material.living-brass.body}',
        $description:
          'THE IDENTITY MATERIAL. The one semantic name for Living Brass. Everything entitled to ' +
          'the material aliases THIS token rather than the expression token, so that the material ' +
          'has exactly one semantic identity and a future appearance can redirect it in one place.',
      },
      mark: {
        $value: '{qandeel.identity.material}',
        $description:
          'The canonical QANDEEL Q wherever it stands as the product mark. Brass PERMITTED. ' +
          'Note that C2 left an open question here that C3 does not close: whether the mark should ' +
          'stand on every screen at all is a PLACEMENT question, and this token grants material, ' +
          'not placement.',
      },
      moment: {
        $value: '{qandeel.identity.material}',
        $description:
          'A rare, large, deliberately exceptional identity moment. Brass PERMITTED, and the only ' +
          'place the brushed/handled character is permitted to exist. Same body as every other ' +
          'member — the moment is larger, not brighter.',
      },
    },
    navigation: {
      $type: 'color',
      $description:
        'PERSISTENT QANDEEL NAVIGATION / IDENTITY MACHINERY. Coverage policy P2, selected by the ' +
        'Design Director at the close of C2.',
      machinery: {
        $value: '{qandeel.identity.material}',
        $description:
          'THE PERSISTENT NAVIGATION ICON FAMILY, as ONE family. Brass EXPECTED under P2. The ' +
          'family carries this token at EVERY state — inactive, selected, focused, pressed, ' +
          'disabled — and there is deliberately no sibling token for any of those states, which is ' +
          'how "Brass never turns on because an item is selected" is made unavailable rather than ' +
          'merely forbidden. State is expressed by the independent mechanisms in {qandeel.state}, ' +
          'which is reserved and owned by I-08B3.1-E.',
      },
    },
    control: {
      $type: 'color',
      $description:
        'ORDINARY FUNCTIONAL AND ACTION CONTROLS: send, add, back, close, overflow, edit, settings ' +
        'actions, checkboxes, radios, utility affordances.',
      functional: {
        $value: '{qandeel.content.tertiary}',
        $description:
          'NEUTRAL BY DEFAULT, under P2 as under P1. A functional control is not identity-bearing ' +
          'because it is visible, persistent or important. It may only become Brass by being ' +
          'granted an INDEPENDENT identity-material permission — which means an addition to ' +
          '{qandeel.identity}, argued on the record, not a local override at a call site.',
      },
    },
    analysis: {
      $type: 'color',
      $description:
        'THE ANALYTICAL PLANE. The Living Analysis Map is the proprietary QANDEEL world and its ' +
        'truth is carried by geometry, position, depth and rank — never by the identity material.',
      node: {
        $value: '{qandeel.content.primary}',
        $description:
          'An analytical node. NEUTRAL, permanently. Brass here would make the material encode ' +
          'analytical importance, which it does not and may not.',
      },
      relation: {
        $value: '{qandeel.content.tertiary}',
        $description:
          'An analytical relation stroke. NEUTRAL, permanently. A graphical object under WCAG 2.2 ' +
          'SC 1.4.11 rather than text — see the B4R Surface contracts, which own that reading.',
      },
    },
    state: {
      $description:
        'RESERVED AND DELIBERATELY EMPTY. Interaction state expression — selected, focused, ' +
        'pressed, disabled, hovered, unread — is owned by I-08B3.1-E and is NOT frozen here. ' +
        'The namespace exists so that a later implementer finds a door with a sign on it rather ' +
        'than an absence they fill however they like. NO MEMBER OF THIS GROUP MAY EVER ALIAS THE ' +
        'IDENTITY MATERIAL: that is invariant I-04 and it is checked with a negative probe.',
    },
    status: {
      $description:
        'RESERVED AND DELIBERATELY EMPTY. Status semantics — success, warning, error, informational ' +
        '— are owned by I-08B3.1-E and are NOT frozen here. NO MEMBER OF THIS GROUP MAY EVER ALIAS ' +
        'THE IDENTITY MATERIAL: that is invariant I-05, checked with a negative probe. Colour may ' +
        'not be the sole carrier of status in any case (WCAG 2.2 SC 1.4.1), which is a separate ' +
        'requirement that survives whatever values E chooses.',
    },
    illumination: {
      $description:
        'RESERVED AND DELIBERATELY EMPTY. This is QANDEEL LIGHT — the later illumination and meaning ' +
        'system, owned by I-08B3.1-D. It is NOT designed, NOT frozen and has no values. ' +
        'BRASS IS MATTER. LIGHT IS MEANING. ACTIVITY IS PROCESS. ' +
        'NAMING HAZARD, RECORDED DELIBERATELY: "QANDEEL Light" (this illumination system) and ' +
        '"light appearance" (the theme) are different things that share an English word, and they ' +
        'are kept in different places on purpose — illumination is a Product system in the ' +
        'SEMANTIC layer, light appearance is a context of the APPEARANCE modifier. An implementer ' +
        'who conflates them produces exactly the failure invariant I-14 forbids, which is why that ' +
        'invariant guards this namespace by name.',
    },
    material: {
      $description:
        'THE MATERIAL BEHAVIOUR CONTRACT. These are not colours. They describe how the one body ' +
        'behaves, and they are appearance-independent because the geometry of a noise field is not ' +
        'a property of a theme.',
      'living-brass': {
        /**
         * THE BEHAVIOUR RULES LIVE IN `$extensions`, AND THAT IS A CORRECTION, NOT A CONVENIENCE.
         *
         * They were first authored as tokens with `$type: 'other'`. DTCG 2025.10 defines exactly
         * thirteen types and `other` is not among them, so schema validation rejected them — which
         * is the whole reason this package validates against the vendored schemas instead of
         * assuming its own JSON is conformant.
         *
         * The fix is better than the original. A DTCG token carries a DESIGN VALUE that a build
         * consumes; "the character may only darken" is not a value, it is a contract a human obeys.
         * Forcing it into a token type would have misused the format to make a rule look like data.
         * The NUMBERS below stay tokens, because a build really does consume them.
         */
        $extensions: {
          'com.qandeel.material-contract': {
            satin:
              'THE CANONICAL MATERIAL BEHAVIOUR AT ORDINARY AND SMALL SCALE: one flat tone. No ' +
              'grain, no texture, no gradient, no second tone, no bevel, no gloss, no ramp, no ' +
              'reflection. This is what a Living Brass object IS unless an identity moment has ' +
              'been granted the character.',
            characterDirection:
              'SUBTRACTIVE-ONLY. THE LOAD-BEARING CONSTRAINT. The character may only DARKEN from ' +
              'the body. No pixel it produces may be lighter than the body, which is what makes ' +
              '"never gleams" a property of the construction rather than a promise about taste. ' +
              'Measured across fifteen rendered widths in C3_VALIDATION_RESULTS.md §3: it holds at ' +
              'every one.',
            characterDerivation:
              'AUTHORED-OKLCH. WHICH VALUE THE DARKER TONE IS DERIVED FROM, AND IT IS NOT THE ONE ' +
              'YOU WOULD REACH FOR. The tone is L_authored minus (amplitude / toneDepthRatio), at ' +
              'the body\'s AUTHORED chroma and hue — the OkLCh triple in the body token\'s ' +
              'com.qandeel.provenance extension, NOT the 8-bit sRGB value the same token paints ' +
              'with. The two disagree. The authored triple gives #967f60, which is the tone every ' +
              'accepted C1R and C2 raster was made with; the quantised body gives #957f60, one ' +
              '8-bit step darker in red, because quantising to 8 bits costs 0.00047 of lightness ' +
              'and the subtraction carries that loss forward. An implementation that takes the ' +
              'obvious route produces a character nobody approved, and no test that compares ' +
              'colours would notice, because both values are plausible Brass. Invariant I-21 ' +
              'asserts both halves.',
            scaleRule:
              'PERMISSION-NOT-SIZE. THE FROZEN PRINCIPLE. The character belongs to ' +
              '{qandeel.identity.moment} and to nothing else. Entitlement is by PERMISSION CLASS, ' +
              'not by pixel width. THE CONSEQUENCE IS UNCOMFORTABLE AND IS RECORDED RATHER THAN ' +
              'BURIED: C3 measured the character at fifteen widths and it renders correctly at ' +
              'every one, navigation size included. So a size rule will not stop anyone putting it ' +
              'on the navigation family, and it would look good. Nothing physical prevents the ' +
              'accumulation failure; only the permission does.',
            neverList: ['no glow', 'no highlight', 'no metallic ramp', 'no specular response',
              'no gradient', 'no bevel', 'no emboss', 'no gloss', 'no reflection',
              'no jewellery polish'],
          },
        },
        character: {
          $description:
            'THE RESTRAINED BRUSHED / HANDLED CHARACTER. Permitted ONLY on {qandeel.identity.moment}. ' +
            'Specified as ALGORITHMIC INTENT and not as a bitmap, so it is reproducible at any size ' +
            'and on any renderer, and so that a future implementation is bound by the behaviour ' +
            'rather than by one exported image. C3_CANONICAL_LIVING_BRASS_SPEC.md states the ' +
            'behaviour in prose; these tokens are the same statement in values.',
          amplitude: {
            $type: 'number',
            $value: CHARACTER.targetAmplitude,
            $description:
              'The peak-to-trough lightness excursion, in Oklab L, that the character is intended ' +
              'to deliver. Accepted in I-08B3.1-C1R and confirmed in C2. THIS IS A LIGHTNESS ' +
              'EXCURSION, NOT A SECOND COLOUR: the material has one body and no ladder.',
          },
          frequency: {
            $description:
              'The spatial frequency of the noise field, in the mark\'s own user space. The ' +
              'ANISOTROPY is the whole of the "brushed" in brushed character: the frequency along ' +
              'the grain is roughly a tenth of the frequency across it, which is what makes the ' +
              'field directional rather than speckled.',
            along: { $type: 'number', $value: CHARACTER.fx, $description: 'Along the grain.' },
            across: { $type: 'number', $value: CHARACTER.fy, $description: 'Across the grain.' },
          },
          octaves: {
            $type: 'number', $value: CHARACTER.numOctaves,
            $description: 'Two. Enough for a handled surface, too few for visual noise.',
          },
          seed: {
            $type: 'number', $value: CHARACTER.seed,
            $description:
              'THE FIELD IS SEEDED, WHICH MAKES IT DETERMINISTIC. The same mark at the same size ' +
              'renders to the same bytes — verified at four size/density conditions in ' +
              'C3_VALIDATION_RESULTS.md. A material that differed between renders would be an ' +
              'effect, not a material.',
          },
          coverage: {
            $description:
              'The linear map from the noise field to the COVERAGE of the darker tone. One channel, ' +
              'one gain, one bias, no transfer curve — so the delivered amplitude is the product of ' +
              'two numbers and can be reasoned about rather than tuned by eye. ' +
              'DELIBERATELY NOT CALLED "alpha". In the SVG implementation these two numbers land in ' +
              'an alpha channel, and naming them after that implementation detail put a token called ' +
              '`material...alpha` into a system whose single most important prohibition is that the ' +
              'material has no opacity ladder. Invariant I-09 fired on it, correctly, because the ' +
              'name said the wrong thing: this is the coverage of the noise field, never the opacity ' +
              'of the material. The name was changed rather than the check taught an exception.',
            gain: { $type: 'number', $value: CHARACTER.alphaK },
            bias: { $type: 'number', $value: CHARACTER.alphaBias },
          },
          toneDepthRatio: {
            $type: 'number', $value: Number((1 / CHARACTER.amplitudeToToneDepth).toFixed(6)),
            $description:
              'The fraction of the darker tone\'s full depth that survives the coverage map. The ' +
              'darker tone is DERIVED at render time — one lightness step down at the body\'s own ' +
              'hue and chroma — and is deliberately NOT stored as a colour token. Storing it would ' +
              'create a two-value Brass ladder, and a two-value ladder is how a five-value ladder ' +
              'starts. Invariant I-10 forbids it and probes for it.',
          },
          /* Kept as a NUMBER token — 1 means the authored triple, and there is no second option.
             The rule itself is prose in the group's com.qandeel.material-contract extension; this
             token exists so a build can ASSERT which rule it implemented rather than assume. */
          derivationVersion: {
            $type: 'number',
            $value: 1,
            $description:
              'Derivation rule 1 = AUTHORED-OKLCH. WHICH VALUE THE TONE IS DERIVED FROM, AND IT IS ' +
              'NOT THE ONE YOU WOULD REACH FOR. ' +
              'The darker tone is L_authored minus (amplitude / toneDepthRatio), at the body\'s ' +
              'AUTHORED chroma and hue — the OkLCh triple recorded in the body token\'s ' +
              'com.qandeel.provenance extension, NOT the 8-bit sRGB body that the same token paints ' +
              'with. The two disagree. Deriving from the authored triple gives #967f60, which is ' +
              'the tone every accepted C1R and C2 raster was made with; deriving from the quantised ' +
              'sRGB body gives #957f60, one 8-bit step darker in red, because quantising the body ' +
              'to 8 bits costs 0.00047 of lightness and the subtraction carries that loss forward. ' +
              'An implementation that takes the obvious route produces a character nobody approved ' +
              'and no test that compares colours would notice, because both values are plausible ' +
              'Brass. Invariant I-21 asserts BOTH halves: that the specified derivation reproduces ' +
              'the accepted tone, and that the obvious one does not. THIS IS WHY THE AUTHORED ' +
              'TRIPLE IS RETAINED IN THE TOKEN FILE: it is not provenance decoration, it is a ' +
              'production input.',
          },
        },
        scale: {
          $description:
            'THE SCALE CONTRACT. C3 was asked to freeze a numeric threshold ONLY if evidence ' +
            'supported a stable one, and to freeze the principle instead if it did not. The ' +
            'evidence was gathered rather than assumed — see C3_VALIDATION_RESULTS.md §3 — and it ' +
            'does NOT support one. The character renders correctly at every width the Product uses, ' +
            'navigation size included, delivering 82-93 % of its accepted amplitude from 24 px to ' +
            '420 px at device pixel ratio 2. So the inherited 96 px constant is NOT a capability ' +
            'threshold, and freezing it would state a design decision in the grammar of physics.',
          proofEraConstant: {
            $type: 'dimension',
            $value: { value: GRAIN_MIN_PX, unit: 'px' },
            $description:
              'RECORDED, NOT FROZEN. The minimum rendered width at which the C1R and C2 proof ' +
              'harnesses would emit the character. It kept the character off ordinary machinery in ' +
              'those packages and was correct to, but it was never measured AT, and the C3 sweep ' +
              'shows nothing happens there. A component-level threshold, if integration wants one, ' +
              'is owned by integration and must be argued on its own evidence.',
          },
        },
      },
    },
  },
};

/* ============================================================ THE APPEARANCE BOUNDARY ===== */

/**
 * LIGHT APPEARANCE — DELIBERATELY EMPTY, AND THE EMPTINESS IS THE DELIVERABLE.
 *
 * B4 established this pattern and C3 continues it exactly: DARK-LED, NOT DARK-LOCKED. Resolving the
 * semantic layer against this set leaves every Living Brass name UNRESOLVED and names what is
 * missing, instead of silently returning the dark value — which is what a `light` set containing a
 * copy of the dark body would do, and which would be a Light Brass value invented by accident.
 *
 * A LIGHT BRASS IS NOT A LIGHTER BRASS. The body was selected against a near-black World on
 * evidence gathered entirely in the dark. On a light ground the same value is a different material
 * perceptually, its contrast relationships invert, and the coverage policy P2 was never tested
 * there. Deriving one here would be inventing a value, which C3 is forbidden to do and does not.
 */
export const LIGHT_MATERIAL = {
  qandeel: {
    $description: 'QANDEEL Living Brass, light appearance.',
    expression: {
      material: {
        $description:
          'DELIBERATELY EMPTY. No Light Brass value exists and none is derived here. Resolving ' +
          'against this set leaves every Living Brass name UNRESOLVED, which is the intended ' +
          'behaviour and is asserted by invariant I-13: the architecture is dark-led and not ' +
          'dark-locked, and a light expression that returned the dark body would be a value nobody ' +
          'designed, shipping under a name someone trusted. Owned by I-08B3.1-F, informed by D.',
      },
    },
  },
};

/* =================================================================== THE RESOLVER ========= */

/**
 * ONE RESOLUTION ORDER OVER BOTH SYSTEMS.
 *
 * The `$ref` paths are load-bearing documentation: anything under `../vendor/` is INHERITED and
 * byte-identical to the sealed package it came from, anything under `./` is authored by C3. A
 * reviewer can see which is which without reading a word of prose, and `c3-invariants.mjs` verifies
 * the byte-identity against the I-08B3.1-B4R package rather than trusting the directory name.
 */
export const RESOLVER = {
  $schema: `https://www.designtokens.org/schemas/${DTCG_VERSION}/resolver.json`,
  version: DTCG_VERSION,
  name: 'QANDEEL Living Brass, over the frozen Surface system',
  description:
    'I-08B3.1-C3. Extends the frozen I-08B3.1-B4R Surface resolver with the Living Brass material ' +
    'rather than standing beside it, so that the material and the neutrals it is judged against ' +
    'come out of ONE resolution. Dark is the canonical expression and the only one with values; ' +
    'light and increased contrast are declared, empty, and owned by later work, so resolving into ' +
    'them fails loudly instead of returning a colour nobody designed.',
  sets: {
    'surface-semantic': {
      description:
        'INHERITED, BYTE-IDENTICAL, FROZEN in I-08B3.1-B4R. The four Surface roles and the reading ' +
        'ramp. C3 does not modify it and does not re-author it.',
      sources: [{ $ref: '../vendor/b4r/semantic.tokens.json' }],
    },
    'material-semantic': {
      description: 'AUTHORED BY C3. Living Brass permission classes and the material behaviour contract.',
      sources: [{ $ref: './base/material.tokens.json' }],
    },
  },
  modifiers: {
    appearance: {
      description: 'System light/dark appearance.',
      default: 'dark',
      contexts: {
        dark: [
          { $ref: '../vendor/b4r/dark.tokens.json' },
          { $ref: './appearance/dark.material.tokens.json' },
        ],
        light: [
          { $ref: '../vendor/b4r/light.tokens.json' },
          { $ref: './appearance/light.material.tokens.json' },
        ],
      },
    },
    contrast: {
      description: 'Increased-contrast accessibility override, applied within an appearance.',
      default: 'standard',
      contexts: {
        standard: [{ $ref: '../vendor/b4r/standard.tokens.json' }],
        increased: [{ $ref: '../vendor/b4r/increased.tokens.json' }],
      },
    },
  },
  resolutionOrder: [
    { $ref: '#/sets/surface-semantic' },
    { $ref: '#/sets/material-semantic' },
    { $ref: '#/modifiers/appearance' },
    { $ref: '#/modifiers/contrast' },
  ],
};

/* ====================================================================== EMIT ============== */

export const FILES = [
  ['base/material.tokens.json', SEMANTIC_MATERIAL],
  ['appearance/dark.material.tokens.json', DARK_MATERIAL],
  ['appearance/light.material.tokens.json', LIGHT_MATERIAL],
  ['qandeel-living-brass.resolver.json', RESOLVER],
];

export function build() {
  const written = [];
  for (const [rel, doc] of FILES) {
    const out = join(TOKENS_DIR, rel);
    if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    written.push({ rel, bytes: readFileSync(out).length });
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const w of build()) console.log(`${String(w.bytes).padStart(7)}  tokens/${w.rel}`);
}
