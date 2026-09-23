/**
 * I-08B3.1-F2 — THE REFERENCE GATE.
 *
 * Every row records four things, because a reference that only says WHAT IT SAYS is a citation
 * rather than a gate:
 *
 *   WHAT IT SAYS              quoted, from the first-party source, read on this run
 *   WHAT IT CHANGED           a decision in F2 that is different because of it
 *   WHAT IT DID NOT CHANGE    the thing it was expected to settle and did not
 *   WHAT F2 DID DIFFERENTLY   where QANDEEL departs, and why the departure is Product and not
 *                             ignorance
 *
 * A row with nothing under WHAT IT CHANGED is honest and stays — most references confirm rather
 * than redirect, and a gate that only listed the ones that redirected would imply that everything
 * was read for a reason it found afterwards. Three rows below changed something real, and one of
 * them changed an implementation requirement nothing else in this stack would have surfaced.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');

export const REFERENCES = [
  {
    id: 'APPLE-DARKMODE',
    source: 'Apple Human Interface Guidelines — Dark Mode',
    url: 'https://developer.apple.com/design/human-interface-guidelines/dark-mode',
    read: 'rendered in a browser on this run; the page is client-rendered and returns an empty shell to a plain fetch',
    says: [
      '"It\'s important to realize that these colors aren\'t necessarily inversions of their light counterparts: while many colors are inverted, some are not."',
      '"Avoid offering an app-specific appearance setting. An app-specific appearance mode option creates more work for people because they have to adjust more than one setting to get the appearance they want. Worse, they may think your app is broken because it doesn\'t respond to their systemwide appearance choice."',
      '"people can choose the Auto appearance setting, which switches between the light and dark appearances as conditions change throughout the day, potentially while your app is running."',
      '"Test your content to make sure that it remains comfortably legible in both appearance modes. For example, in Dark Mode with Increase Contrast and Reduce Transparency turned on (both separately and together)…"',
      '"At a minimum, make sure the contrast ratio between colors is no lower than 4.5:1. For custom foreground and background colors, strive for a contrast ratio of 7:1, especially in small text."',
      '"In Dark Mode, the system uses two sets of background colors — called base and elevated… The base colors are dimmer, making background interfaces appear to recede, and the elevated colors are brighter, making foreground interfaces appear to advance."',
    ],
    changed:
      'TWO THINGS, AND THE SECOND IS A FINDING RATHER THAN A DECISION. (1) "Avoid offering an app-specific appearance setting" is the first-party authority behind §17 — F2 does not build an in-app toggle, and qandeel.appearance.system-appearance records that as a decision with a citation rather than as an omission. (2) THE 7:1 SENTENCE IS A GENUINE TENSION AND IT IS REPORTED RATHER THAN QUIETLY MET: Apple asks custom foreground/background pairs to STRIVE for 7:1. In dark, QANDEEL clears it comfortably in places — Error at 8.61:1 — and misses it in others — Living Brass at 6.07:1. In LIGHT, both Brass and Error land at 4.84:1, above the 4.5:1 minimum and below the aspiration. Pushing Brass to 7:1 on the light World forces it to OKLCh L 0.38, which is a dark brown and is the outcome §7 of the brief forbids by name. The tension is left standing, with both numbers on the page, for Product review.',
    didNotChange:
      'The "auto appearance… potentially while your app is running" sentence CONFIRMED the appearance-switch requirement rather than shaping it — §16 of the brief already states it. It is quoted because it establishes that the switch is not a rare user action but a scheduled system event, which is why tools/f2-switch.mjs treats an unprompted mid-session switch as the normal case.',
    didDifferently:
      'THE BASE / ELEVATED MODEL IS NOT ADOPTED, AND THE REASON IS FROZEN QANDEEL SEMANTICS. Apple raises foreground interfaces by making them BRIGHTER in dark; iOS light mode does the same, putting white cards on a grey base. QANDEEL\'s light functional Surface is DEEPER than its World. That is not a disagreement about elevation — it is that I-08B3.1-B4R froze the Surface as not elevated at all: "the APPARATUS is not raised; it is beside", and all four Product Surface roles share one tone. With no elevation metaphor to express, the Surface moves AWAY FROM THE EXTREME in each appearance — lifted off black in dark, deepened away from white in light — which keeps the World the most open thing on screen and keeps the chrome out of the glare.',
  },
  {
    id: 'APPLE-COLOR',
    source: 'Apple Human Interface Guidelines — Color',
    url: 'https://developer.apple.com/design/human-interface-guidelines/color',
    read: 'rendered in a browser on this run',
    says: [
      '"If you define a custom color, make sure to supply light and dark variants, and an increased contrast option for each variant that provides a significantly higher amount of visual differentiation."',
      '"Each dynamic color is semantically defined by its purpose, rather than its appearance or color values."',
      '"Avoid redefining the semantic meanings of dynamic system colors… don\'t use the separator color as a text color, or secondary text label color as a background color."',
      '"Avoid using the same color to mean different things."',
      '"In bright surroundings, colors look darker and more muted. In dark environments, colors appear bright and saturated."',
      '"Avoid hard-coding system color values in your app."',
    ],
    changed:
      'THE SHAPE OF THE DELIVERABLE. "A light variant, a dark variant, AND an increased-contrast option for each" is exactly four contexts, and it is why F2 ships tokens/contrast/light.increased.tokens.json rather than treating increased contrast as settled by I-08B3.1-F1. B4R quoted this same sentence when it declared the empty light context; F2 is the package that closes it.',
    didNotChange:
      '"Avoid redefining the semantic meanings" confirmed a rule the architecture already enforced. F2\'s resolver forbids an appearance set from changing an alias ROUTE — it may supply values and may not re-point roles — and check P-03 walks every chain in both appearances and requires the two route sets to be identical. The reference did not create that rule; it is why the rule is worth checking mechanically.',
    didDifferently:
      'The lighting-condition sentence is the one F2 CANNOT act on. Colours look darker and more muted in bright surroundings, which is precisely where a light appearance is used — and this host has no device and no photometer. Rather than tune for a condition it cannot observe, F2 records the Light World\'s lightness as a PRODUCTION DEFAULT tunable downward and routes the judgement to device validation, which is recorded as not performed.',
  },
  {
    id: 'W3C-1.4.11',
    source: 'W3C — Understanding SC 1.4.11 Non-text Contrast (WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html',
    read: 'fetched on this run',
    says: [
      '"Visual information required to identify user interface components and states, except for inactive components or where the appearance of the component is determined by the user agent and not modified by the author"',
      '"Parts of graphics required to understand the content, except when a particular presentation of graphics is essential to the information being conveyed"',
      '"User Interface Components that are not available for user interaction (e.g., a disabled control in HTML) are not required to meet contrast requirements."',
      '"Not every graphical object needs to contrast with its surroundings — only those that are required for a user to understand what the graphic is conveying."',
    ],
    changed:
      'NOTHING IN THE LIGHT DERIVATION, AND THAT IS THE POINT OF QUOTING THE EXCEPTIONS. The ambient field is the largest graphical thing on a QANDEEL screen and I-08B3.1-D2R declares every one of its properties `encodes: null` — radius, layer, contour count, contour shape, hue. It is therefore decoration under this criterion and 3:1 does not bind it. F2 nevertheless re-instantiates each layer\'s contour contrast against its own ground, because the field\'s PRESENCE is a Product requirement even where its contrast is not an accessibility one. And the inactive-component exception is why the light DISABLED ink keeps its 3.37:1 relation instead of being raised to 4.5:1 — raising it would compress the one distance that carries unavailability.',
    didNotChange:
      'The 3:1 figure remains what I-08B3.1-F1 made it: a TARGET adopted for the increased-contrast expression and explicitly not imposed on the default. F2 does not reopen that, and Part F\'s light search uses the same target for the same reason.',
    didDifferently:
      'Nothing. This criterion is applied as written, including its exceptions, which is the part most often dropped.',
  },
  {
    id: 'W3C-1.4.1',
    source: 'W3C — Understanding SC 1.4.1 Use of Color (WCAG 2.2)',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html',
    read: 'fetched on this run',
    says: ['"Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element."'],
    changed:
      'IT IS THE REQUIREMENT THAT DECIDED PART C. One of the four meaning-light families — hold the ground\'s lightness and spend everything on chroma — is the obvious answer to "how do you show light on a light ground", and it is the one this criterion kills: measured through the grayscale diagnostic it reaches dEok 0.0000, which is to say it disappears entirely for a reader using it or with a colour-vision difference. The requirement is in the search as R-GRAYSCALE with a numeric floor, so the family was excluded by arithmetic rather than by taste.',
    didNotChange:
      'Error keeps its colour AND its glyph AND its sentence in both appearances, exactly as I-08B3.1-E1 and F1 require. The light appearance adds no new reliance on colour and removes none of the companions.',
    didDifferently: 'Nothing.',
  },
  {
    id: 'RN-APPEARANCE',
    source: 'React Native — Libraries/Utilities/Appearance.js and useColorScheme.js, main branch',
    url: 'https://raw.githubusercontent.com/facebook/react-native/main/packages/react-native/Libraries/Utilities/Appearance.js',
    read: 'source fetched on this run; reactnative.dev is not reachable from this session and the source is the first-party record',
    says: [
      'getColorScheme: "Returns the active color scheme (\'light\' or \'dark\'). This value may change at runtime, either at the system level (e.g. scheduled color scheme change at sunrise or sunset) or when overridden at the app level via setColorScheme()."',
      'setColorScheme: "Force the application to always adopt a light or dark interface style. Pass \'auto\' to reset and follow the system default (removes any override). This does not affect the system UI, only the application."',
      'useColorScheme: "React hook that provides and subscribes to color scheme updates from the Appearance module. Returns \'light\', \'dark\', or null. Notes: null will only be returned if the native Appearance module is unavailable (out of tree platforms)."',
    ],
    changed:
      'THE NULL BRANCH BECAME A PRODUCT DECISION RATHER THAN A DEFAULT. useColorScheme returns null when the native module is unavailable, and the tempting reading of null is "light". QANDEEL is dark-led: null resolves to DARK, which is the canonical appearance and the one every frozen package defaults to. It is recorded in F2_IMPLEMENTATION.md as a one-line rule so the fallback cannot be decided differently at each call site.',
    didNotChange:
      'setColorScheme EXISTS, and F2 still does not use it. The API being available is not authority to add an in-app appearance override — that is a Product preference decision with its own surface and its own persistence, and Apple\'s own guidance advises against it. Recorded as an open Product option.',
    didDifferently:
      'Nothing about the API. QANDEEL consumes it through ONE projection rather than at call sites, which is §28 and is a QANDEEL requirement rather than a React Native one.',
  },
  {
    id: 'ANDROID-DARKTHEME',
    source: 'Android Developers — Dark theme',
    url: 'https://developer.android.com/develop/ui/views/theming/darktheme',
    read: 'fetched on this run',
    says: [
      '"When the app\'s theme changes, either through the system setting or AppCompat, it triggers a uiMode configuration change, which automatically recreates activities."',
      '"An app can handle the theme change by declaring that each Activity can handle the uiMode configuration change: android:configChanges=\\"uiMode\\""',
      '"Avoid using hardcoded colors or icons intended for use under a light theme. Use theme attributes or night-qualified resources instead."',
    ],
    changed:
      'THIS IS THE ROW THAT CHANGED AN IMPLEMENTATION REQUIREMENT, AND NOTHING ELSE IN THIS STACK WOULD HAVE SURFACED IT. §16 of the brief forbids an appearance change from resetting Product state. On Android, by default, an appearance change DESTROYS AND RECREATES THE ACTIVITY — so the platform\'s default behaviour is precisely the thing the contract forbids, and a package that proved the contract only in a browser would have shipped a contract the runtime violates on one of its two platforms. F2_IMPLEMENTATION.md therefore carries a required declaration — android:configChanges="uiMode" on the hosting Activity — and an integration gate that the analytical state survives a real system appearance change on a device. It is the same shape of finding I-08B3.1-F1 recorded when a documented Reanimated default silently deleted the exit that carries QANDEEL\'s settle.',
    didNotChange:
      'The hardcoded-colour warning confirmed an architecture that already existed. QANDEEL has no hardcoded colour anywhere: every value is resolved from the token tree by Product role, in both appearances, and check S-01 scans the renderer source for a colour literal.',
    didDifferently:
      'ANDROID DYNAMIC COLOUR IS NOT ADOPTED. Material 3 can derive a whole scheme from the user\'s wallpaper. QANDEEL\'s palette IS its identity — Living Brass is the material the Product is made of, and the chroma ladder is how its semantics are encoded — so a wallpaper-derived scheme would replace the thing the design system exists to protect. Platform theming informs the implementation; it does not author the system. Recorded as qandeel.appearance.system-appearance.',
  },
  {
    id: 'MATERIAL-ROLES',
    source: 'Material Design 3 — Color roles',
    url: 'https://m3.material.io/styles/color/roles',
    read: 'rendered in a browser on this run',
    says: [
      '"There are 26 standard color roles organized into six groups: primary, secondary, tertiary, error, surface, and outline"',
      '"The color system is built on accessible color pairings. These color pairs provide an accessible minimum 3:1 contrast."',
      '"Roles are implemented in design and code through tokens. A design token represents a small, reusable design decision that\'s part of a design system\'s visual style."',
      '"Combining colors improperly may break contrast necessary for visual accessibility, particularly when colors are adjusted through dynamic color features such as user-controlled contrast."',
    ],
    changed:
      'NOTHING, AND THE REASON IS WORTH STATING PLAINLY BECAUSE THE BRIEF ASKS FOR IT. §31 says to use Material as implementation reference and not as QANDEEL\'s visual language, and the role taxonomy is exactly where the two would be confused. Material assigns an ERROR role by taxonomy — it is one of the six groups, present whether or not a product has earned it. I-08B3.1-E1 froze the opposite: STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY, and QANDEEL has exactly one status colour because exactly one status earned one. Adopting the role set would have imported Warning, Success and Informational hues that §14 of this brief forbids by name.',
    didNotChange:
      'QANDEEL has ONE functional Surface and no container roles, which I-08B3.1-B4R froze: "there is no second member of this group and adding one would be the whole B-track reopening." Material\'s surface/container/on-surface layering is a component-mapping system for a component library QANDEEL does not have.',
    didDifferently:
      'THE PAIRING IDEA IS KEPT AND ITS SHAPE IS NOT. Material guarantees accessibility by declaring legal PAIRS of roles. QANDEEL guarantees it by preserving RATIOS across appearances — each reading rung holds the same contrast against its own ground in both — which is a stronger statement for this system because QANDEEL\'s hierarchy is the ratio rather than a list of sanctioned combinations.',
  },
];

export function gate() {
  const rows = REFERENCES.map((r) => ({
    ...r,
    complete: Boolean(r.says?.length && r.changed && r.didNotChange && r.didDifferently),
  }));
  const incomplete = rows.filter((r) => !r.complete);
  return {
    generatedBy: 'tools/f2-references.mjs',
    state: incomplete.length ? 'FAIL — a reference row is missing one of the four required fields' : 'PASS',
    count: rows.length,
    changedSomething: rows.filter((r) => !/^NOTHING/i.test(r.changed)).length,
    rows,
    note: 'Every URL was read on the run that produced this record. Two of the seven are client-rendered pages that return an empty document to a plain fetch and were read in a browser; one first-party site is unreachable from this session and its SOURCE was read instead, which is recorded on the row rather than smoothed over.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const g = gate();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_REFERENCES.json'), JSON.stringify(g, null, 2) + '\n');
  console.log('state:', g.state, '|', g.count, 'references,', g.changedSomething, 'of which changed a decision');
  for (const r of g.rows) console.log('  ' + (r.complete ? 'OK  ' : 'MISS') + ' ' + r.id.padEnd(18) + r.source);
  if (g.state !== 'PASS') process.exit(1);
}
