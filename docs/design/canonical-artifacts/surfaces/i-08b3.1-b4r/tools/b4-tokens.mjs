/**
 * I-08B3.1-B4 - THE PRODUCTION TOKEN SOURCE.
 *
 * This file AUTHORS the token architecture and writes every JSON file in `tokens/`. It authors no
 * COLOUR: every canonical value is imported from the sealed, accepted I-08B3.1-B3R package, so the
 * production token file is DERIVED from the evidence that earned it rather than transcribed beside
 * it. A transcription can drift by one hex digit and still look right in a document; a derivation
 * cannot drift at all, and if the sealed package ever moved, this file would stop building.
 *
 * ---------------------------------------------------------------------------------------------
 * THE ARCHITECTURE, AND WHY IT HAS THREE TIERS RATHER THAN TWO
 * ---------------------------------------------------------------------------------------------
 *
 *   TIER 1  qandeel.expression.*   APPEARANCE-SPECIFIC VALUES. The only tier that holds a colour.
 *                                  Supplied by an appearance set: `dark` today, `light` and
 *                                  `increased contrast` deliberately EMPTY and owned by later work.
 *
 *   TIER 2  qandeel.world.fill     APPEARANCE-INDEPENDENT SEMANTIC ROLES, the names the brief
 *           qandeel.surface.functional   requires: WORLD, SURFACE FUNCTIONAL, CONTENT
 *           qandeel.content.*            PRIMARY/SECONDARY/TERTIARY, PASSAGE SCRIM.
 *           qandeel.passage.scrim
 *
 *   TIER 3  qandeel.role.*         THE FOUR FROZEN PRODUCT SURFACE ROLES. Every one of their fills
 *                                  is an alias, and every chain passes through tier 2's ONE
 *                                  `surface.functional` before reaching tier 1.
 *
 * Two tiers would have worked for today. Three is what makes B4.2 true: a Light appearance replaces
 * tier 1 ONLY. No Product role is renamed, no component is rewritten, and the one-tone rule holds in
 * an appearance nobody has designed yet, because the four roles never referred to a colour - they
 * referred to `surface.functional`, which referred to whichever expression was loaded.
 *
 * THE INVARIANT IS STRUCTURAL, NOT CHROMATIC. `#181818` appears exactly ONCE in the whole
 * architecture. Four roles carrying four equal hexes would satisfy every colour comparison anyone
 * could write and would be precisely the duplication the brief forbids; the chain is what tells
 * those two situations apart, which is why `b4-dtcg.mjs` keeps chains.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  WORLD, PRIMARY, SECONDARY, TERTIARY, SURFACE, SCRIM_BASELINE,
} from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/b3-model.mjs';
import { hexToRgb8 } from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/color.mjs';
import { srgbHex, load, mergeDocs } from './b4-dtcg.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const TOKENS_DIR = join(PKG, 'tokens');
/**
 * B4R writes its evidence to its OWN work directory. `.i08b31-b4-work` belongs to the sealed B4
 * run: pointing here would have overwritten the artefacts B4's shipped results document was
 * generated from, which is how a correction quietly destroys the thing it is being compared against.
 */
export const WORK = join(PKG, '..', '.i08b31-b4r-work');

export const DTCG_VERSION = '2025.10';

/**
 * sRGB components from a hex, at a precision that ROUND-TRIPS.
 *
 * The Color Module makes `components` normative and `hex` an optional fallback, so components are
 * what a conforming tool reads and the hex is what a legacy one reads. If those two disagreed by an
 * 8-bit step the file would paint two different colours depending on the reader, and nothing in the
 * JSON would look wrong. So the generator computes components from the sealed hex, recomputes the
 * hex from the components, and refuses to write the file if they disagree.
 */
function components(hex) {
  const c = hexToRgb8(hex).map((v) => Number((v / 255).toFixed(6)));
  const back = srgbHex(c);
  if (back !== hex.toLowerCase()) {
    throw new Error(`b4-tokens: components for ${hex} round-trip to ${back} - the fallback hex and ` +
      'the normative components would disagree, and a conforming reader and a legacy reader would ' +
      'paint different colours');
  }
  return c;
}

const color = (hex, { alpha, description } = {}) => {
  const v = { colorSpace: 'srgb', components: components(hex) };
  if (alpha !== undefined) v.alpha = alpha;
  v.hex = hex.toLowerCase();
  return description ? { $value: v, $description: description } : { $value: v };
};

const alias = (path, description) => ({ $value: `{${path}}`, $description: description });

/* ============================================================ TIER 1: dark expression == */

/**
 * THE CANONICAL DARK EXPRESSION.
 *
 * Every value here is imported. `SCRIM_BASELINE` is the 0.50 the B-track has probed since B2 and
 * the alpha the Design Director selected for B4 production verification - it is read from the
 * sealed package rather than retyped, so the number in this file cannot drift away from the number
 * the evidence was gathered at.
 */
export const DARK = {
  qandeel: {
    /**
     * `$type` is declared here as well as on the semantic root, and the duplication is the point.
     *
     * A Resolver SOURCE is merged before anyone reads it, so this file could have relied on the
     * semantic layer's root group for its typing and resolved perfectly in every real build. It
     * would also have been an INVALID DTCG document on its own - every token in it untyped - and
     * validation caught exactly that. A source file that cannot be validated by itself is a source
     * file whose errors only appear once it is someone else's problem.
     */
    $type: 'color',
    expression: {
      world: color(WORLD, { description:
        'The World. Frozen in I-08B3.1-A. Not a Surface: nothing is painted with it in order to be ' +
        'told apart from something else - it is the ground everything else sits on.' }),
      surface: color(SURFACE, { description:
        'THE ONE FUNCTIONAL SURFACE VALUE. Lighter than the World, achromatic, opaque matte. This is ' +
        'the only place in the architecture where it exists; every Product Surface role reaches it ' +
        'through an alias chain.' }),
      content: {
        primary: color(PRIMARY, { description: 'Primary reading. Frozen in I-08B3.1-A.' }),
        secondary: color(SECONDARY, { description: 'Secondary reading. Frozen in I-08B3.1-A.' }),
        tertiary: color(TERTIARY, { description: 'Tertiary neutral. Frozen in I-08B3.1-A.' }),
      },
      scrim: color('#000000', { alpha: SCRIM_BASELINE, description:
        'The PASSAGE scrim in the dark expression: neutral black at alpha ' + SCRIM_BASELINE + '. It ' +
        'expresses WORLD SUPPRESSION. Background legibility is not one of its duties, because the ' +
        'World behind a PASSAGE is suspended.' }),
    },
  },
};

/* =================================================== TIER 1: the unresolved appearances = */

/**
 * LIGHT, AND WHY IT IS EMPTY.
 *
 * This is a valid DTCG document that declares the group and NOT ONE TOKEN. That is deliberate and it
 * is the mechanism, not a placeholder: resolve the semantic layer against this set and all nine
 * semantic and role tokens come back `UNRESOLVED`, naming the exact expression token they wanted.
 *
 * The alternative - shipping plausible Light values - would produce a file that validates, resolves,
 * builds, renders and is WRONG, with nothing anywhere to say so. An unresolved reference is an error
 * a build system stops on. An invented colour is a decision nobody made, shipped silently.
 */
export const LIGHT = {
  qandeel: {
    $description: 'QANDEEL, light appearance.',
    expression: {
      $description:
        'DELIBERATELY EMPTY. QANDEEL is dark-led and not dark-locked, and the light expression has ' +
        'not been designed. No value here is unassigned by accident: resolving against this set ' +
        'leaves every semantic token UNRESOLVED and names what is missing. Owned by I-08B3.1-F.',
    },
  },
};

export const INCREASED_CONTRAST = {
  qandeel: {
    $description: 'QANDEEL, increased-contrast accessibility expression.',
    expression: {
      $description:
        'DELIBERATELY EMPTY. An increased-contrast expression is an OVERRIDE of the appearance it ' +
        'applies to, not a third appearance - Apple asks for "light and dark variants, and an ' +
        'increased contrast option for each variant". Its values are owned by I-08B3.1-F. Note that ' +
        'the B-track truth it will override is OPAQUE: Reduce Transparency has nothing to undo here.',
    },
  },
};

export const STANDARD_CONTRAST = {
  qandeel: {
    $description:
      'QANDEEL, standard contrast. Deliberately empty and deliberately present: the standard ' +
      'contrast context overrides nothing, and saying so with a set is clearer than an absent one.',
  },
};

/* ================================================== TIER 2 + TIER 3: the semantic layer = */

/**
 * THE APPEARANCE-INDEPENDENT LAYER. Not one colour appears below this line.
 *
 * `$type: color` is declared ONCE, on the root group, and inherited by everything under it - the
 * Format Module's group type inheritance, used rather than described.
 */
export const SEMANTIC = {
  $description:
    'QANDEEL Surface system - semantic layer. I-08B3.1-B4. Appearance-independent: it names what ' +
    'things ARE, never what they look like. Colours live in the expression layer that an appearance ' +
    'set supplies.',
  qandeel: {
    $type: 'color',
    $description:
      'Product semantics. A name in this tree describes a ROLE. There is no lightness ladder, no ' +
      'elevation level and no numbered scale, because QANDEEL has one Surface tone and a ladder ' +
      'would be a set of names for distinctions that do not exist.',

    world: {
      $description: 'The World. Not a Surface role.',
      fill: alias('qandeel.expression.world',
        'The analytical ground. Nothing is "on" the World in a tonal sense; things are on it in a ' +
        'literal one.'),
    },

    surface: {
      $description:
        'THE FUNCTIONAL SURFACE. One tone, shared by all four Product Surface roles. There is no ' +
        'second member of this group and adding one would be the whole B-track reopening.',
      functional: alias('qandeel.expression.surface',
        'The single functional Surface. Every Product Surface role aliases THIS token, which is what ' +
        'makes the one-tone rule mechanically inspectable rather than a convention.'),
    },

    content: {
      $description: 'Reading roles, frozen in I-08B3.1-A.',
      primary: alias('qandeel.expression.content.primary', 'Primary reading.'),
      secondary: alias('qandeel.expression.content.secondary', 'Secondary reading.'),
      tertiary: alias('qandeel.expression.content.tertiary',
        'Tertiary neutral. Also the ink of a Map relation stroke, which is a graphical object under ' +
        'WCAG 2.2 SC 1.4.11 rather than text.'),
    },

    passage: {
      $description: 'What a PASSAGE needs that no other role does.',
      scrim: alias('qandeel.expression.scrim',
        'The scrim that marks World suspension. A scrim follows from BLOCKING, so only PASSAGE has ' +
        'one.'),
    },

    role: {
      $description:
        'THE FOUR FROZEN PRODUCT SURFACE ROLES, I-08B3.1-B0R. These are QANDEEL PRODUCT roles. They ' +
        'are NOT accessibility roles and they do not map one-to-one to an ARIA or native role: the ' +
        'accessibility pattern is derived from the interaction actually inside the layer ' +
        '(I-08B3.1-B3R). Every fill below is an alias. None may ever carry a value of its own.',

      apparatus: {
        $description:
          'Standing Product machinery adjacent to the World. Told apart by POSITION AND ADJACENCY.',
        fill: alias('qandeel.surface.functional',
          'Same tone as every other role. The APPARATUS is not raised; it is beside.'),
      },
      aside: {
        $description:
          'Anchored, contextual, NONMODAL. The World stays live. Told apart by its ANCHOR and by ' +
          'local occlusion. It has no scrim token, and that absence is the contract.',
        fill: alias('qandeel.surface.functional',
          'Same tone as PASSAGE. An ASIDE is not told apart from a PASSAGE by tone - it is told ' +
          'apart by what it does to the World.'),
      },
      passage: {
        $description:
          'Genuinely modal. The World is suspended. Told apart by occlusion, a uniform scrim, and ' +
          'modal BEHAVIOUR - focus enters and cannot leave.',
        fill: alias('qandeel.surface.functional',
          'Same tone as ASIDE. A PASSAGE is not lighter, bigger or heavier; it is BLOCKING.'),
        scrim: alias('qandeel.passage.scrim',
          'The only scrim in the system. Its presence is what marks the suspension.'),
      },
      field: {
        $description:
          'Authorship / commit boundary. Told apart by a Class S structural line on the boundary the ' +
          'user commits across - the FILL is subordinate to that duty. An editable FIELD must use ' +
          'real platform text-input semantics; see B4_REACT_NATIVE_MAPPING.md.',
        fill: alias('qandeel.surface.functional',
          'Same tone. A FIELD is a boundary, not a box: the line does the work.'),
      },
    },
  },
};

/* ============================================================== the resolver manifest == */

/**
 * DTCG RESOLVER MODULE 2025.10.
 *
 * TWO modifiers, not one, and the cross-product is the point. Apple's guidance is to "supply light
 * and dark variants, and an increased contrast option for EACH variant" - increased contrast is an
 * override applied WITHIN an appearance, not a third appearance. A single `theme` modifier with
 * three contexts would have modelled QANDEEL's future wrongly and the wrongness would only have
 * surfaced when someone tried to build dark + increased contrast and found it unrepresentable.
 *
 * ---------------------------------------------------------------------------------------------
 * B4R-REV-01: THIS DOCUMENT WAS THE WRONG SHAPE, AND THE REASON IS WORTH KEEPING
 * ---------------------------------------------------------------------------------------------
 *
 * B4 shipped `sets` and `modifiers` as ARRAYS of named objects, and a `resolutionOrder` of
 * `{ type, name }` pairs. The stable 2025.10 Resolver Module declares `sets` as Map[string, Set]
 * and `modifiers` as Map[string, Modifier]; a root-declared set or modifier is referenced from
 * `resolutionOrder` by a REFERENCE OBJECT - `{ "$ref": "#/sets/semantic" }`. The `{ type, name }`
 * form is real, but it belongs to a set or modifier declared INLINE in `resolutionOrder`, where
 * `name` and `type` are added ON TOP OF the body (`sources` / `contexts`). B4 wrote the inline
 * form's marker keys without the inline form's body and without the reference: a shape that is
 * neither. The official schema rejects it in 17 places.
 *
 * WHERE THE WRONG SHAPE CAME FROM. B4's Reference Gate could not reach designtokens.org and
 * substituted the specification's own repository at `main`, DISCLOSING that main is not a frozen
 * 2025.10 snapshot. That disclosed risk then materialised: `technical-reports/resolver/syntax.md`
 * has been edited four times SINCE the 2025.10 publication commit, and main is an evolving draft.
 * The correction is pinned to the publication commit and to the official JSON Schema, and the
 * schema is now vendored into `schemas/` and enforced by `tools/b4r-schema.mjs` rather than
 * described in prose. A disclosed limitation is not the same as a handled one.
 *
 * NOTHING BELOW CHANGES A VALUE. The resolver document says how the sets COMPOSE; the canonical
 * token document is unchanged byte for byte, and so is every Product raster.
 */
export const RESOLVER = {
  $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
  version: DTCG_VERSION,
  name: 'QANDEEL Surface system',
  description:
    'I-08B3.1-B4. Dark is the canonical expression and the only one with values. Light and ' +
    'increased contrast are declared, empty, and owned by later work: resolving into them fails ' +
    'loudly instead of silently returning dark or an invented colour.',
  /** Map[string, Set]. The KEY is the name; a Set carries `sources` and MAY carry a `description`. */
  sets: {
    semantic: {
      description: 'Appearance-independent Product semantics and the four Surface roles.',
      sources: [{ $ref: './base/semantic.tokens.json' }],
    },
  },
  /** Map[string, Modifier]. A Modifier carries a `contexts` map and MAY carry a `default`. */
  modifiers: {
    appearance: {
      description: 'System light/dark appearance.',
      default: 'dark',
      contexts: {
        dark: [{ $ref: './appearance/dark.tokens.json' }],
        light: [{ $ref: './appearance/light.tokens.json' }],
      },
    },
    contrast: {
      description: 'Increased-contrast accessibility override, applied within an appearance.',
      default: 'standard',
      contexts: {
        standard: [{ $ref: './contrast/standard.tokens.json' }],
        increased: [{ $ref: './contrast/increased.tokens.json' }],
      },
    },
  },
  /** Reference objects, because these sets and modifiers are declared at the root. */
  resolutionOrder: [
    { $ref: '#/sets/semantic' },
    { $ref: '#/modifiers/appearance' },
    { $ref: '#/modifiers/contrast' },
  ],
};

/* ====================================================================== emit =========== */

const FILES = [
  ['base/semantic.tokens.json', SEMANTIC],
  ['appearance/dark.tokens.json', DARK],
  ['appearance/light.tokens.json', LIGHT],
  ['contrast/standard.tokens.json', STANDARD_CONTRAST],
  ['contrast/increased.tokens.json', INCREASED_CONTRAST],
  ['qandeel-surface.resolver.json', RESOLVER],
];

/** The canonical deliverable: the semantic layer with the DARK expression merged in. */
export const CANONICAL = mergeDocs([SEMANTIC, DARK]);

export function build() {
  const written = [];
  for (const [rel, doc] of [...FILES, ['qandeel-surface.tokens.json', CANONICAL]]) {
    const abs = join(TOKENS_DIR, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(doc, null, 2) + '\n', { encoding: 'utf8' });
    written.push(rel);
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const written = build();
  const { errors, resolved, unresolved, circular } = load(CANONICAL, { file: 'qandeel-surface.tokens.json' });
  for (const f of written) console.log(`  wrote tokens/${f}`);
  console.log(`  canonical document: ${resolved.size} tokens, ${errors.length} error(s), ` +
    `${unresolved.length} unresolved, ${circular.length} circular`);
  if (errors.length) { for (const e of errors) console.error(`  ERROR ${e}`); process.exit(1); }
}
