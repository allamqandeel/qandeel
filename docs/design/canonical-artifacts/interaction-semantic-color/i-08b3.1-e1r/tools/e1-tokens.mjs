/**
 * I-08B3.1-E1 — TOKEN EMITTER.
 *
 * The token files are GENERATED from tools/e1-derive.mjs. Not one colour component is
 * typed: the hex and the sRGB components are computed from the authored OkLCh triple by
 * the same code that derived it. A token file someone edited by hand is a token file
 * that can disagree with the evidence that produced it.
 *
 * FREEZE BOUNDARY. A token exists so an implementation is CONSISTENT; freezing exists so
 * a PRODUCT DECISION is irreversible. They are different jobs and a value can have the
 * first without the second. `classify()` THROWS on an unclassified path, so a token added
 * later cannot inherit "frozen" by sitting in the file.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hexToRgb8 } from '../vendor/lib/color.mjs';
import { derive } from './e1-derive.mjs';
import { CHANNELS, PRECEDENCE, AVAILABILITY, MATRIX, STATES, SELECTED_UNAVAILABLE, STATUS_POLICY, ROLE_EVIDENCE } from './e1-composition.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

const PRODUCT_CONTRACT = {
  class: 'product-contract',
  meaning: 'Changing this changes what the product MEANS. Freezeable — subject to independent review.',
};
const PRODUCTION_DEFAULT = {
  class: 'production-default',
  meaning: 'A calibrated production default. Changing it within its stated bound changes how the product FEELS, not what it says. NOT Product-frozen, and expected to move once a real device has been seen.',
};

const CLASSES = new Map(Object.entries({
  'qandeel.state.rest.ink': 'product-contract',
  'qandeel.state.rest.weight': 'production-default',
  'qandeel.state.pressed.ink': 'product-contract',
  'qandeel.state.pressed.presence': 'production-default',
  'qandeel.state.focus.indicator': 'product-contract',
  'qandeel.state.focus.companion': 'product-contract',
  'qandeel.state.focus.thickness': 'production-default',
  'qandeel.state.focus.companion-thickness': 'production-default',
  'qandeel.state.focus.offset': 'production-default',
  'qandeel.state.selected.ink': 'product-contract',
  'qandeel.state.selected.marker': 'product-contract',
  'qandeel.state.selected.marker-thickness': 'production-default',
  'qandeel.state.selected.weight': 'production-default',
  'qandeel.state.disabled.ink': 'product-contract',
  'qandeel.status.error.ink': 'product-contract',
  'qandeel.status.warning.ink': 'product-contract',
  'qandeel.status.success.ink': 'product-contract',
  'qandeel.status.informational.ink': 'product-contract',
  'qandeel.expression.status.error': 'product-contract',
  'qandeel.expression.state.disabled': 'product-contract',
}));

export function classify(path) {
  const c = CLASSES.get(path);
  if (!c) throw new Error(`e1-tokens: token "${path}" carries no freeze classification. Classify it or do not ship it.`);
  return { 'com.qandeel.freeze': c === 'product-contract' ? PRODUCT_CONTRACT : PRODUCTION_DEFAULT };
}

const colour = (hex, path) => ({
  $value: { colorSpace: 'srgb', components: hexToRgb8(hex).map((c) => Number((c / 255).toFixed(6))), hex },
  $extensions: classify(path),
});
const num = (v, path, extra = {}) => ({ $type: 'number', $value: v, ...extra, $extensions: classify(path) });
const dim = (v, path, extra = {}) => ({ $type: 'dimension', $value: { value: v, unit: 'px' }, ...extra, $extensions: classify(path) });
const weight = (v, path, extra = {}) => ({ $type: 'fontWeight', $value: v, ...extra, $extensions: classify(path) });
const alias = (target, path, extra = {}) => ({ $type: 'color', $value: `{${target}}`, ...extra, $extensions: classify(path) });

export function emit() {
  const d = derive();

  /* ---------------------------------------------------------------- semantic layer --- */
  const base = {
    $description: 'QANDEEL INTERACTION STATE and SYSTEM STATUS — semantic layer. I-08B3.1-E1. Extends the frozen I-08B3.1-D2R illumination layer, which extends C3 Living Brass, which extends B4R Surface. The four are resolved TOGETHER and none is complete alone.',
    qandeel: {
      state: {
        $description: 'INTERACTION STATE. THIS GROUP WAS RESERVED AND EMPTY IN I-08B3.1-C3 AND IS FILLED HERE; a resolved tree that still calls it empty has not picked up E1. STATE IS THE USER’S POSITION: where input is going, what the user chose, whether the user is touching, whether the user may. It is not what a thing is made of (BRASS IS MATTER) and not what the system understood (LIGHT IS MEANING). THE STATE COMPOSITION MODEL is in com.qandeel.composition on this group, and it REPLACES a false statement I-08B3.1-E1 shipped: E1 said each state owned a different channel and that no channel was used twice, which was untrue the moment it was written, because SELECTED writes the ink and DISABLED writes the ink. THREE channels are exclusively owned, ONE is shared and resolved by declared precedence, and DISABLED is an OVERRIDE rather than a peer. NO MEMBER OF THIS GROUP RESOLVES TO A LITERAL EXCEPT disabled.ink: interaction state adds NO COLOUR to QANDEEL, and invariant I-06 checks it. NO MEMBER MAY EVER ALIAS THE IDENTITY MATERIAL OR THE ILLUMINATION (C3 invariant I-04, carried forward as E1 I-04).',
        $extensions: {
          'com.qandeel.composition': {
            model: 'STATE COMPOSITION / OWNERSHIP. Not an exclusivity rule. A channel has an OWNER — the state that may introduce a change on it — and a channel may also be WRITTEN by another state, in which case a precedence rule resolves it. Listing the owners is not the same as claiming no channel is shared, and I-08B3.1-E1 made exactly that mistake.',
            withdrawn: 'I-08B3.1-E1’s exclusivity rule about visual channels, whose wording is quoted only in docs/E1R_REVISION_RECORD.md. It is contradicted by this very document: the INK channel below names two writers.',
            states: STATES,
            channels: CHANNELS,
            precedence: PRECEDENCE,
            matrix: MATRIX.map((m) => ({ ...m, combination: STATES.filter((s) => m.states.includes(s)).join('+') || 'rest' })),
            matrixIsComplete: 'All 16 subsets of the four non-rest states are present, each with a verdict and the rule that produced it. A combination that is not in this list is a specification gap, and check R27 fails on one.',
          },
        },
        rest: {
          $description: 'REST is the ABSENCE of state, not a state with its own colour. The ink belongs to the control’s permission class, which C3 owns; this alias exists so REST is visible in the graph and is obviously not a state colour.',
          ink: alias('qandeel.control.functional', 'qandeel.state.rest.ink', { $description: 'The control’s own rest ink, by way of C3’s permission class. Reaching a different value here would mean E1 had taken ownership of something C3 froze.' }),
          weight: weight(d.WEIGHT.rest, 'qandeel.state.rest.weight', { $description: 'Rest type weight. Inside 400-700, which is the band Arabic requires at UI sizes: below 400 the connected script thins to illegibility at small sizes.' }),
        },
        pressed: {
          $description: 'PRESSED — "I am receiving your physical interaction." TRANSIENT, and it belongs to the GROUND, not to the ink and not to the object. It is not selection, not meaning emergence, not success and not identity. It begins on POINTER-DOWN, never on release. THE SEPARATION FROM QANDEEL LIGHT IS THE CHAIN, NOT THE COMPOSITED CHROMA, AND THAT IS A CORRECTION: an earlier version of this contract claimed the pressed ground’s chroma proved it could not be a meaning event, and the probe for that claim STAYED SILENT — at these alphas over a near-black ground almost any wash composites to a nearly achromatic value, so the measurement passes whatever ink you feed it. What is falsifiable is that pressed.ink resolves into the frozen reading ramp and may never reach the illumination. Check R11. The deeper separation is behavioural in any case: a meaning event rises, decays and reaches exactly zero, and a press has no lifecycle at all.',
          ink: alias('qandeel.content.primary', 'qandeel.state.pressed.ink', { $description: 'THE WASH IS THE PRODUCT’S OWN INK, NOT WHITE. QANDEEL has no pure white and a white wash would introduce a neutral colder than anything in the system. Material 3 states the same construction for its state layers: the overlay "uses the same color as the content".' }),
          presence: num(d.PRESS.alpha, 'qandeel.state.pressed.presence', { $description: `The wash alpha. VALUE from Material 3's pressed state-layer opacity, and it is a PRODUCTION DEFAULT, not a Product decision. What is DERIVED is the FLOOR it must clear: it moves the functional Surface by ${d.PRESS.dLSurface.toFixed(4)} in OkLCh lightness, against a floor of ${d.PRESS.derivedFloorStep.toFixed(4)} — the frozen World-to-Surface step, which is the smallest tonal distinction the frozen system asserts anywhere.` }),
        },
        focus: {
          $description: 'FOCUS — "this control currently receives interaction." It belongs to the INPUT SYSTEM, not to the content, so it is drawn OUTSIDE the control, DETACHED by a gap: a piece of apparatus adjacent to the object rather than a property of it. That is what keeps it distinct from SELECTED, which is attached. FOCUS IS NOT MEANING LIGHT AND IS NOT BRASS. It introduces no colour: the indicator is the Product’s own primary reading ink and the companion is the World.',
          indicator: alias('qandeel.content.primary', 'qandeel.state.focus.indicator', { $description: 'The indicator proper. Reaches 12.95:1 against the World and 12.08:1 against the functional Surface, which is the change-of-contrast WCAG 2.2 SC 2.4.13 measures between the focused and unfocused states of the same pixels.' }),
          companion: alias('qandeel.world.fill', 'qandeel.state.focus.companion', { $description: `THE COMPANION IS NOT DECORATION. WCAG 2.2 SC 1.4.11 measures a focus indicator against its ADJACENT colours, and the indicator alone reaches 3:1 against only ${d.FOCUS.ringAloneCovers} of the ${d.FOCUS.total} colours QANDEEL can paint beside it — it fails against every ink, against the identity material, against the Light and against the error. The pair reaches 3:1 against all ${d.FOCUS.total}. Measured in data/E1_DERIVATION.json.` }),
          thickness: dim(d.FOCUS.thickness, 'qandeel.state.focus.thickness', { $description: 'WCAG 2.2 SC 2.4.13 states the area requirement as "at least as large as the area of a 2 CSS pixel thick perimeter of the unfocused component". This is that figure, so it is a FLOOR taken from the specification rather than a number chosen here. An implementation may exceed it.' }),
          'companion-thickness': dim(d.FOCUS.companionThickness, 'qandeel.state.focus.companion-thickness', { $description: 'The companion carries no area requirement of its own — SC 2.4.13 counts only the part that meets the change-of-contrast test, which is the indicator. One device-independent pixel is enough to do its job.' }),
          offset: dim(d.FOCUS.offset, 'qandeel.state.focus.offset', { $description: 'The gap between the control and the indicator, equal to the indicator’s own thickness, so the ring cannot be read as a thicker border ON the control. DETACHMENT IS THE CONTRACT; the exact gap is craft.' }),
        },
        selected: {
          $description: 'SELECTED — "the user chose this." STABLE, and it survives the interaction that produced it. It is ATTACHED to the control: a marker on the control’s own anchored edge, plus a promotion of ink and of type weight. THREE CHANNELS, NONE OF THEM A HUE. Selection is deliberately NOT Living Brass: C3 has no state sibling of qandeel.navigation.machinery to reach for, and this is the expression that makes that absence workable rather than merely forbidden.',
          ink: alias('qandeel.content.primary', 'qandeel.state.selected.ink', { $description: 'Selected items are read in the primary reading ink; unselected ones in their own rest ink. The promotion is a move UP the frozen ramp, not a new colour.' }),
          marker: alias('qandeel.content.primary', 'qandeel.state.selected.marker', { $description: 'THE PERSISTENT MARKER, on the control’s own edge on the side its group is anchored to — the top edge for a bottom navigation item, the inline-start edge for a list row, which in RTL is the RIGHT edge. One rule, every morphology. Attached, where the focus indicator is detached.' }),
          'marker-thickness': dim(d.SELECTED.markerThickness, 'qandeel.state.selected.marker-thickness', { $description: 'Craft. The marker’s PRESENCE is the contract; its weight is not.' }),
          weight: weight(d.WEIGHT.selected, 'qandeel.state.selected.weight', { $description: 'Selected type weight. THE RELATION is the contract — selected is heavier than rest — and the two values are craft. Weight is load-bearing here for a reason specific to the script: Arabic has no italic tradition and letter-spacing visibly breaks the connected script, so weight is the only typographic emphasis channel Arabic leaves open. Both values sit inside 400-700.' }),
        },
        disabled: {
          $description: 'DISABLED — "this action is currently unavailable." DISABLED DESCRIBES AVAILABILITY. IT DOES NOT DESCRIBE FOCUSABILITY, and I-08B3.1-E1 was wrong to freeze that it did: focusability is determined by the control pattern and by whether the control must remain discoverable, and the two patterns are in com.qandeel.availability on this group. A disabled control RESOLVES EVERY INK IT CARRIES TO ONE VALUE and so loses its internal hierarchy: hierarchy is for reading and acting, and the control is doing neither. It cannot be activated, and it states its reason in words. LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE, so E1R supplies NO unavailable expression for a Brass-bearing object and does not claim the Product can never need one — see E1_DISABLED_COLLISION_RESOLUTION.md and com.qandeel.selected-unavailable.',
          $extensions: {
            'com.qandeel.availability': AVAILABILITY,
            'com.qandeel.selected-unavailable': SELECTED_UNAVAILABLE,
          },
          ink: alias('qandeel.expression.state.disabled', 'qandeel.state.disabled.ink', { $description: `THE READING RAMP EXTENDED BY ITS OWN RULE — one lightness rung below the dimmest rung the Product reads with, continuing the ramp’s own step and its own chroma trend. Not an opacity and not an invented colour. It sits dEok ${d.DISABLED.belowTertiary.dEok.toFixed(4)} below the tertiary neutral, which is a full rung by construction, so no disabled control can be confused with an enabled one whatever ink it started from. Apple's own foreground ladder has exactly this fourth rung (quaternaryLabel), arrived at independently.` }),
        },
      },
      status: {
        $description: 'SYSTEM STATUS. THIS GROUP WAS RESERVED AND EMPTY IN I-08B3.1-C3 AND IS FILLED HERE. STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY: a role does not receive a dedicated hue because it has a name. QANDEEL DOES NOT USE A GENERIC TRAFFIC-LIGHT PALETTE, and that is the part that is frozen. ERROR CURRENTLY OWNS THE ONLY DEDICATED SYSTEM-STATUS HUE. The other three remain neutral UNTIL a real Product case proves their required attention, persistence or detached presentation cannot be carried truthfully and accessibly by position, copy, glyph, state change, boundary or hierarchy — and such a case requires PRODUCT EVIDENCE, which com.qandeel.status-policy on each role records. THE COUNT IS NOT A CAP. I-08B3.1-E1 froze the number of dedicated status hues as a product contract on the evidence of one role; I-08B3.1-E1R withdraws that absolute while keeping the principle that produced it, and quotes the withdrawn wording only in docs/E1R_REVISION_RECORD.md. COLOUR IS NEVER THE SOLE CARRIER (WCAG 2.2 SC 1.4.1): every role below names the non-colour channels it must ship with, in $extensions, because those are a contract and not a value.',
        $extensions: { 'com.qandeel.status-policy': STATUS_POLICY },
        error: {
          $description: 'ERROR — something failed, or what is here is not valid. THE ONLY ROLE THAT HAS EARNED A DEDICATED HUE, and it earned it rather than receiving it by taxonomy. Retrospective and about state, which is what colour is good at marking. THE VALUE IS PRODUCT-OWNER VISUALLY APPROVED; see com.qandeel.status-policy.',
          ink: alias('qandeel.expression.status.error', 'qandeel.status.error.ink', { $description: 'Text, glyph and boundary. ONE VALUE, not a family: a second tone would be a ladder, and a ladder is how a palette starts.' }),
          $extensions: {
            'com.qandeel.status-policy': ROLE_EVIDENCE.error,
            'com.qandeel.companion': {
              required: ['a glyph that is not a colour', 'copy that names what failed', 'the field boundary drawn in the error ink', 'aria-invalid / accessibilityState invalid on the control', 'the message linked to the control by aria-describedby / accessibilityLabelledBy'],
              why: 'WCAG 2.2 SC 1.4.1 is satisfied by a lightness difference of 3:1 OR by a non-colour cue. E1 measured the first: the error ink reaches only 1.03:1 against the secondary reading ink and 1.58:1 against the tertiary, so the lightness route is NOT available and the non-colour channels are load-bearing rather than belt-and-braces.',
            },
          },
        },
        warning: {
          $description: 'WARNING — "this will happen if you proceed." NO DEDICATED HUE YET, and that is a current state with a route out rather than a prohibition. Warning is PROSPECTIVE and about consequence, which copy is good at stating and colour is not; and in every QANDEEL surface audited so far a warning is attached to a commit the user is making, so the boundary they commit across is already the right carrier and it already exists in the frozen Surface contract. THE CONDITION THAT OVERTURNS THIS — a warning that must appear AMBIENTLY, detached from any commit — HAS BEEN MET ONCE, by transient connection or service degradation in a Shared or Public world. That does not create a hue by itself; it means the refusal is no longer automatic and the case is handed to Product with the evidence com.qandeel.status-policy requires.',
          ink: alias('qandeel.content.primary', 'qandeel.status.warning.ink', { $description: 'The Product’s own primary reading ink. That this resolves into the frozen ramp rather than to a literal IS the current decision, made visible in the graph.' }),
          $extensions: {
            'com.qandeel.status-policy': ROLE_EVIDENCE.warning,
            'com.qandeel.companion': {
              required: ['the commit boundary promoted to the primary reading ink at double weight', 'a glyph that is not a colour', 'copy that names the CONSEQUENCE, not the risk'],
              why: 'Apple: a confirmation dialog belongs to "genuinely destructive, irreversible actions (use sparingly; overusing it trains people to click through)". The weight of a QANDEEL warning is carried by where it stands and what it says.',
            },
          },
        },
        success: {
          $description: 'SUCCESS / CONFIRMATION — NO DEDICATED HUE YET. A successful operation in QANDEEL resolves INTO STATE: the thing is now published, the member has joined, the answer has arrived. The interface already shows that, and a persistent green would be a second, weaker statement of a fact the state system is making better — and it would spend attention on the one outcome that needs none. THE CONDITION THAT OVERTURNS THIS — an operation whose result CANNOT be shown in place — HAS BEEN MET ONCE, by a background analysis or replay that completes after the user has navigated away. The first answers there are a place to land, a glyph and copy; a hue is a separate argument and it now has a route rather than a prohibition.',
          ink: alias('qandeel.content.primary', 'qandeel.status.success.ink', { $description: 'The Product’s own primary reading ink.' }),
          $extensions: {
            'com.qandeel.status-policy': ROLE_EVIDENCE.success,
            'com.qandeel.companion': {
              required: ['the state that changed, shown changed', 'a glyph that is not a colour', 'copy in the perfect tense'],
              why: 'Material 3 ships 26 standard colour roles in six groups and ERROR is the only status role among them. There is no success role to inherit.',
            },
          },
        },
        informational: {
          $description: 'INFORMATIONAL — NO DEDICATED HUE YET. The frozen three-step reading ramp was built for exactly this: information that is present but subordinate is secondary or tertiary ink. A blue would add a fourth hue to a product that has three, to say something the ramp already says. THE CONDITION THAT OVERTURNS THIS — information that is a distinct KIND rather than a rank — was NOT met in the audited surfaces; the closest case, a privacy or authority boundary, reads correctly at secondary rank with a lock glyph. If it is met later, the first answer is still the glyph.',
          ink: alias('qandeel.content.secondary', 'qandeel.status.informational.ink', { $description: 'Secondary reading ink. Subordinate by RANK, which is what the ramp encodes.' }),
          $extensions: {
            'com.qandeel.status-policy': ROLE_EVIDENCE.informational,
            'com.qandeel.companion': {
              required: ['rank in the reading ramp', 'a glyph where the information is a distinct kind rather than a subordinate detail'],
              why: 'Apple: "don’t use the separator color as a text color, or secondary text label color as a background color" — dynamic roles are semantic, and the ramp’s semantics already cover subordinate information.',
            },
          },
        },
      },
    },
    $extensions: {
      'com.qandeel.freeze-boundary': {
        note: 'A token exists so an implementation is CONSISTENT. Freezing exists so a PRODUCT DECISION is irreversible. Every token above carries com.qandeel.freeze saying which it has. The important half of the contract is not tokens at all, and is listed here.',
        productContract: [
          'STATE IS THE USER’S POSITION. BRASS IS MATTER. LIGHT IS MEANING. ACTIVITY IS PROCESS. A fourth term is a new Product decision.',
          'THE STATE COMPOSITION MODEL, in com.qandeel.composition: PRESSED owns the ground, FOCUS owns a detached perimeter, SELECTED owns the marker’s presence and the type weight, DISABLED owns availability. THE INK IS SHARED BY SELECTED AND DISABLED and is resolved by precedence rule P1, not by ownership. Three precedence rules govern every combination, and all sixteen are enumerated with a verdict.',
          'Interaction state introduces NO colour. Every state colour is an alias into the frozen reading ramp, except the disabled ink, which is that ramp extended by its own rung.',
          'FOCUS IS DETACHED AND SELECTED IS ATTACHED. That is the whole of how they are told apart, and it holds when both are true at once.',
          'PRESSED IS TRANSIENT AND BELONGS TO THE GROUND; SELECTED IS PERSISTENT AND BELONGS TO THE OBJECT. A press never leaves a residue.',
          'PRESS FEEDBACK BEGINS ON POINTER-DOWN, never on release — and it is suppressed entirely on an unavailable control, which is precedence rule P2.',
          'DISABLED DESCRIBES AVAILABILITY, NOT FOCUSABILITY. An unavailable control cannot be activated and states the reason it is unavailable. Whether it stays in the focus order is decided by its control pattern under com.qandeel.availability, which defines exactly two: NATIVE NON-DISCOVERABLE UNAVAILABLE and DISCOVERABLE UNAVAILABLE. THE TWO ARE VISUALLY IDENTICAL.',
          'LIVING BRASS IS STATE-INVARIANT IN VALUE AND IN APPEARANCE. No interaction state and no availability state may dim, recolour or composite a Brass-bearing object. E1R therefore supplies no unavailable expression for one; how availability is expressed around an identity object is a Product and navigation-contract decision that E1R does not own.',
          'STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY, and QANDEEL DOES NOT USE A GENERIC TRAFFIC-LIGHT PALETTE. ERROR currently owns the only dedicated system-status hue. The others remain neutral until a real Product case proves position, copy, glyph, state change, boundary and hierarchy cannot carry them. THE COUNT IS NOT A CAP: a future dedicated status expression requires Product evidence and is not prohibited.',
          'COLOUR IS NEVER THE SOLE CARRIER OF A STATE OR A STATUS. Every critical role ships with the non-colour channels named in its com.qandeel.companion extension.',
          'THE ERROR ROLE HAS EXACTLY ONE VALUE. A second tone would be a ladder.',
          'NOTHING IN qandeel.state OR qandeel.status MAY EVER RESOLVE TO THE IDENTITY MATERIAL OR TO THE ILLUMINATION.',
          'HOVER IS NOT A QANDEEL STATE. It is not designed here and it is not reserved as an expression: QANDEEL ships touch-first, and a touch device fires hover on tap, which turns a hover expression into a false press.',
        ],
        revisedByE1R: [
          'NOTE ON WORDING. The four withdrawn statements are named below but NOT restated. A shipping contract that quotes a claim it has withdrawn can be grepped for that claim and found, and tools/e1-consistency.mjs treats the token files as shipping surfaces rather than as commentary. The verbatim wording of each, with its quotation attributed, is in docs/E1R_REVISION_RECORD.md, which is the one document allowed to hold it.',
          'STATEMENT 2 — the exclusivity rule about visual channels. FALSE as written, because two states write the ink. Replaced by the composition / ownership model in com.qandeel.composition, which keeps every accepted expression and explains it truthfully.',
          'STATEMENT 7 — the absolute about the focusability of an unavailable control. Too absolute, and contradicted by the accessibility patterns E1 had itself read. Replaced by DISABLED DESCRIBES AVAILABILITY plus the two control patterns in com.qandeel.availability.',
          'STATEMENT 8 — the universal about identity-bearing objects and availability. A navigation and entitlement law E1 had no Product authority to make. Narrowed to the requirement that actually is frozen: the material is state-invariant in value and in appearance.',
          'STATEMENT 9 — the cap on the number of dedicated status hues, frozen on the evidence of one role. Replaced by the earned-colour policy in com.qandeel.status-policy, which keeps the discipline and adds a Product-evidence route.',
        ],
      },
    },
  };

  /* -------------------------------------------------------------- expression layer --- */
  const dark = {
    qandeel: {
      $type: 'color',
      expression: {
        status: {
          $description: 'SYSTEM STATUS expression, dark appearance. I-08B3.1-E1 — FREEZE CANDIDATE.',
          error: {
            ...colour(d.ERROR.hex, 'qandeel.expression.status.error'),
            $description: 'THE ONE COLOUR I-08B3.1-E1 ADDS TO QANDEEL.',
            $extensions: {
              ...classify('qandeel.expression.status.error'),
              'com.qandeel.provenance': {
                authoredAs: d.ERROR.authored,
                declaredDecision: 'THE RED FAMILY. This is FAMILIARITY, named as a Product decision and not disguised as a measurement — the single convention E1 keeps from ordinary UI. Every other coordinate is derived.',
                hueAnchor: `the OkLCh hue of the sRGB RED PRIMARY, ${d.ERROR.hueAnchor.toFixed(4)} — the one red the display is built to make`,
                hueDeviation: `${d.ERROR.hueDeviation} degrees ${d.ERROR.hueDirection}, which is the MINIMUM distance at which a value exists that keeps every floor under plus or minus one least-significant bit per channel. No hue arc was declared and no width was typed.`,
                chromaObjective: 'the QUIETEST point that satisfies every floor — minimum chroma, tie-broken on the largest worst-case distance. Lightness was not pinned; it fell out.',
                floors: [
                  `chroma at least Living Brass's (${d.CHROMATIC.toFixed(5)}), without which the floors below are satisfiable by a light GREY at an unused lightness, and a grey cannot be the colour that reports a failure`,
                  'contrast at least 4.5:1 on the World AND on the functional Surface',
                  `full OkLab distance at least ${d.FLOOR.toFixed(5)} from every ink QANDEEL can paint — DERIVED as the closest distance Living Brass itself keeps from the frozen reading ramp, because the system already relies on THAT being a distinction a reader can use and nothing E1 adds may be a weaker one`,
                  'both of the above again under simulated protanopia and deuteranopia',
                  'and all of it again for each of the 27 one-bit perturbations of the quantised triple',
                ],
                bindingConstraints: d.ERROR.floors.filter((f) => f.value < f.floor * 1.05).map((f) => `${f.name} = ${f.value.toFixed(5)} against a floor of ${f.floor}`),
                howMuchRoomRemains: `${d.ERROR.feasibleSamples} sampled points are feasible at this hue, spanning L ${d.ERROR.feasibleL[0]}-${d.ERROR.feasibleL[1]} and C ${d.ERROR.feasibleC[0]}-${d.ERROR.feasibleC[1]}; the sRGB gamut edge is ${d.ERROR.gamutHeadroom} of chroma away. THE ACCESSIBILITY FLOORS CONSUME ALMOST THE WHOLE OF THE RED sRGB GAMUT AT THIS LIGHTNESS, and that is the result, not a coincidence.`,
                dichromacyModel: 'Vienot, Brettel & Mollon (1999), single plane, applied to LINEAR-LIGHT sRGB. Transcribed rather than taken from a dependency, and exercised by property tests that do not depend on remembering the constants. USED AS A DESIGN INSTRUMENT TO SET A FLOOR, never as a claim about what a person sees. TRITANOPIA IS EXCLUDED: the single-plane simplification is not validated for it and leaves pure blue unmoved, which tools/e1-cvd.mjs asserts rather than hides.',
                status: 'FREEZE CANDIDATE — proposed by I-08B3.1-E1, frozen by nobody.',
              },
            },
          },
        },
        state: {
          $description: 'INTERACTION STATE expression, dark appearance. Exactly one member, and it is not a status colour.',
          disabled: {
            ...colour(d.DISABLED.hex, 'qandeel.expression.state.disabled'),
            $description: 'THE UNAVAILABLE INK — the frozen reading ramp extended by one rung.',
            $extensions: {
              ...classify('qandeel.expression.state.disabled'),
              'com.qandeel.provenance': {
                authoredAs: d.DISABLED.authored,
                derivation: `L = TERTIARY (${d.FROZEN.TERTIARY}) minus the ramp's own smallest rung (${d.DISABLED.rung.toFixed(4)}); C continues the ramp's last chroma step (${d.DISABLED.chromaStep.toFixed(4)}); H is the ramp's mean hue (${d.DISABLED.hueMean.toFixed(2)}).`,
                whyNotAnOpacity: 'An opacity applied to the whole control reduces every ink by the same factor, which pushes the dimmest ink toward illegibility while barely touching the brightest, and leaves a disabled PRIMARY label at the same contrast as an enabled TERTIARY one. One derived ink separates every disabled control from every enabled one by a full rung, whatever ink it started from. Apple expresses the same thing the same way: disabledControlTextColor is a TEXT COLOUR, not an alpha.',
                quantisationNote: `The authored chroma is ${d.DISABLED.authored.C}; the quantised hex recovers C ${d.DISABLED.recovered.C.toFixed(4)} at H ${d.DISABLED.recovered.H.toFixed(1)} rather than the authored ${d.DISABLED.authored.H}. At this chroma one 8-bit step is a large fraction of the whole chromatic signal, so the hue drift is expected and is recorded rather than smoothed over. The value is achromatic for every practical purpose and nothing in E1 depends on its hue.`,
                measured: {
                  belowTertiaryByL: Number(d.DISABLED.belowTertiary.dL.toFixed(4)),
                  belowTertiaryBydEok: Number(d.DISABLED.belowTertiary.dEok.toFixed(4)),
                  contrastOnWorld: Number(d.DISABLED.contrast.world.toFixed(2)),
                  contrastOnSurface: Number(d.DISABLED.contrast.surface.toFixed(2)),
                },
                retires: `the I-08B3.1-C1/C2 diagnostic disabled literal ${d.RETIRED.disabledInk}, which was proof-only and was assigned to E1 by C3_PROOF_TO_PRODUCTION_MAP.md section 3.`,
                status: 'FREEZE CANDIDATE — proposed by I-08B3.1-E1, frozen by nobody.',
              },
            },
          },
        },
      },
    },
  };

  /* --------------------------------------------------------------- light appearance -- */
  const light = {
    $description: 'QANDEEL INTERACTION STATE and SYSTEM STATUS — LIGHT APPEARANCE. DELIBERATELY EMPTY, AND THE EMPTINESS IS THE DELIVERABLE. Resolving the semantic layer against the light appearance leaves qandeel.status.error.ink and qandeel.state.disabled.ink UNRESOLVED and names what is missing. A light set containing a copy of the dark values would be a light-mode error colour invented by accident, shipping under a name someone trusted. THE DARK ERROR VALUE CANNOT SIMPLY BE REUSED: every floor that produced it is a statement about a NEAR-BLACK ground, and on a light ground its contrast relationships invert and the dichromacy floors are measured against different simulated neutrals. Owned by I-08B3.1-F. Apple is explicit that a custom colour needs light and dark variants AND an increased-contrast option for each, and this file is where the first of those will go.',
    qandeel: { expression: {} },
  };

  /* ---------------------------------------------------------------------- resolver --- */
  const resolver = {
    $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
    version: '2025.10',
    name: 'QANDEEL interaction state and system status, over the frozen Light, Living Brass and Surface systems',
    description: 'I-08B3.1-E1 — FREEZE CANDIDATE. Extends the I-08B3.1-D2R resolver rather than standing beside it, so that state, status, the identity material and the Meaning Light come out of ONE resolution. That is the only way "a state or status name never reaches the material and never reaches the Light" can be checked rather than asserted. Nothing here is frozen: independent Product and Design review owns that decision.',
    sets: {
      'qandeel-light': {
        description: 'INHERITED, BYTE-IDENTICAL, from I-08B3.1-D2R — which inherits C3 Living Brass, which inherits B4R Surface. E1 does not modify it and does not re-author it.',
        sources: [{ $ref: '../vendor/d2r/tokens/qandeel-light.resolver.json' }],
      },
      'interaction-semantic': {
        description: 'AUTHORED BY E1. Interaction state and system status, as roles.',
        sources: [{ $ref: './base/interaction.tokens.json' }],
      },
    },
    modifiers: {
      appearance: {
        description: 'System light/dark appearance. Dark is the canonical expression and the only one with values; light is owned by I-08B3.1-F and resolving into it fails loudly rather than returning a colour nobody designed.',
        default: 'dark',
        contexts: {
          dark: [{ $ref: './appearance/dark.interaction.tokens.json' }],
          light: [{ $ref: './appearance/light.interaction.tokens.json' }],
        },
      },
    },
    resolutionOrder: [
      { $ref: '#/sets/qandeel-light' },
      { $ref: '#/sets/interaction-semantic' },
      { $ref: '#/modifiers/appearance' },
    ],
  };

  const w = (rel, obj) => { writeFileSync(join(PKG, rel), JSON.stringify(obj, null, 2) + '\n'); return rel; };
  const files = [
    w('tokens/base/interaction.tokens.json', base),
    w('tokens/appearance/dark.interaction.tokens.json', dark),
    w('tokens/appearance/light.interaction.tokens.json', light),
    w('tokens/qandeel-interaction.resolver.json', resolver),
  ];
  writeFileSync(join(PKG, 'data/E1_DERIVATION.json'), JSON.stringify(d, null, 2) + '\n');
  return { files, derivation: d };
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const { files, derivation } = emit();
  for (const f of files) console.log('emitted', f);
  console.log('emitted data/E1_DERIVATION.json');
  console.log('\nERROR    ', derivation.ERROR.hex, 'oklch(' + derivation.ERROR.authored.L + ' ' + derivation.ERROR.authored.C + ' ' + derivation.ERROR.authored.H + ')');
  console.log('DISABLED ', derivation.DISABLED.hex, 'oklch(' + derivation.DISABLED.authored.L + ' ' + derivation.DISABLED.authored.C + ' ' + derivation.DISABLED.authored.H + ')');
}
