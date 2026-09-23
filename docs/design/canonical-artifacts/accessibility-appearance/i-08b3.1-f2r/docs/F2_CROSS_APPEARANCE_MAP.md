# I-08B3.1-F2 — THE CROSS-APPEARANCE SEMANTIC MAP

> **A semantic token remains conceptually stable while its appearance-dependent value changes.**
> The pair preserves **ROLE IDENTITY**, not **HEX IDENTITY**. — §15

## The whole appearance-dependent surface of QANDEEL is twelve values

| role | semantic token | DARK | LIGHT |
|---|---|---|---|
| World | `qandeel.world.fill` | `#101010` | `#efeeeb` |
| Functional Surface | `qandeel.surface.functional` | `#181818` | `#e7e6e3` |
| Primary reading | `qandeel.content.primary` | `#d8d5ca` | `#29271f` |
| Secondary reading | `qandeel.content.secondary` | `#afaca3` | `#47443c` |
| Tertiary neutral | `qandeel.content.tertiary` | `#8b8982` | `#626059` |
| PASSAGE scrim | `qandeel.passage.scrim` | `#000000` @ 0.5 | `#000000` @ 0.532 |
| **Living Brass** | `qandeel.identity.material` | `#a58e6f` | `#7a6446` |
| QANDEEL Light — core | `qandeel.illumination.core` | `#fbf2db` | `#fff6df` |
| QANDEEL Light — mid | `qandeel.illumination.mid` | `#e8ddc2` | `#ddd4be` |
| QANDEEL Light — low | `qandeel.illumination.low` | `#d6caa9` | `#bcb39e` |
| **Error** | `qandeel.status.error.ink` | `#fe907e` | `#ad4739` |
| Disabled | `qandeel.state.disabled.ink` | `#696762` | `#83817c` |

**Everything else is an alias.** The identity mark, the navigation machinery, the functional control
ink, the analysis node and relation, REST, PRESSED, FOCUS and its companion, SELECTED and its
marker, WARNING, SUCCESS, INFORMATIONAL, and all four Product Surface roles — every one of them
resolves *through* one of the twelve above.

Board L shows all twenty-six roles with both values, the hue drift between them, and whether the
appearance owns a value for the role or it follows an alias.

## The routes are identical, character for character

This is what makes cross-appearance semantic parity **structural rather than maintained**. Check
**P-02** walks every alias chain in both appearances and compares them as strings:

```
MARK      qandeel.identity.mark → qandeel.identity.material → qandeel.expression.material.living-brass.body
REST_INK  qandeel.state.rest.ink → qandeel.control.functional → qandeel.content.tertiary → qandeel.expression.content.tertiary
FOCUS_COMPANION  qandeel.state.focus.companion → qandeel.world.fill → qandeel.expression.world
```

Those chains are the same in dark and in light. Only the terminal expression value differs.
`tools/f2-resolve.mjs` states the rule as a constant:

> **an appearance set may supply expression VALUES and may never change an alias ROUTE**

If it could, "the same semantics in both appearances" would be a promise instead of a graph. Apple's
Color guidance says the same thing from the other side: *"Avoid redefining the semantic meanings of
dynamic system colors."*

## Hue constancy — the measurement that carries role identity

| role | dark | light | drift |
|---|---|---|---|
| Living Brass | 75.0° | 74.8° | **0.13°** |
| Error | 30.3° | 30.1° | **0.20°** |
| QANDEEL Light core | 89.1° | 89.1° | **0.00°** |
| QANDEEL Light mid | 88.5° | 88.4° | **0.09°** |
| QANDEEL Light low | 90.4° | 87.6° | **2.85°** |
| Primary reading | 94.2° | 95.6° | 1.35° |
| Secondary reading | 91.6° | 89.9° | 1.70° |
| Tertiary neutral | 93.6° | 93.7° | 0.06° |
| Disabled | 88.7° | 88.7° | 0.02° |

**Maximum drift 2.85°, against a declared tolerance of 3°.** Measured on the **recovered** hue of
the quantised hex that ships, not on the authored triple — at QANDEEL's chroma magnitudes the 8-bit
grid moves a hue by more than a degree on its own, and an earlier version of the ink solver let it
move by eight.

## The chroma ladder, in both appearances

| band | DARK | LIGHT |
|---|---|---|
| ERROR | 0.1364 | 0.1368 |
| LIVING BRASS | 0.0516 | 0.0521 |
| QANDEEL LIGHT | 0.0317 – 0.0462 | 0.0308 – 0.0316 |
| ATMOSPHERE | 0.0197 | 0.0191 |
| INK | 0.0081 – 0.0153 | 0.0078 – 0.0145 |
| GROUND | 0.0000 | 0.0041 – 0.0042 |

Check **X-01** asserts that every member of each band is above every member of the next, in both
appearances.

> **ONE CONSEQUENCE IS EASY TO MISS AND IT BROKE THE LADDER ONCE.** The atmosphere's ceiling is
> DERIVED — `0.62 × the least chromatic Light stop` — so a Light that is too quiet drags the
> atmosphere ceiling down **through** the reading ramp and inverts two bands without either value
> being wrong on its own. The Light therefore has to carry enough chroma to hold the atmosphere up
> above the ink, and that is a clause in R-ORDER rather than a hope.

## The cross-appearance truth matrix

`tools/f2-parity.mjs`. **1,452 cells, 0 failures.**

Every accessibility expression I-08B3.1-F1 tested is rendered in **both** appearances, and the truth
is read back out of the **rendered document** — out of the `#qd-truth` block the page actually
shipped and out of the DOM elements that actually exist in it. Nothing is imported from the
generator. Every cell is compared against one reference: the **dark default**.

| | |
|---|---|
| appearances | 2 |
| accessibility expressions | 11 |
| analytical objects | 11 |
| facts per object | 6 |
| **cells** | **1,452** |
| failures | **0** |

The six facts are I-08B3.1-F1's five — EXISTS, RELATIONSHIPS, TEMPORAL, EPISTEMIC, ACTIONS — plus
one F2 added:

> **CHANNELS (non-reducing).** An expression may give an object MORE ways to be perceived and may
> never give it fewer. This replaced a first version that compared the exact `drawn/named` pair and
> reported four failures — all of them cases where an object *gained* a channel, because above the
> label-escape scale the inspection view takes over and the CONNECTION acquires a named presence it
> does not have at default size. **That is I-08B3.1-F1R's own repair working, and a matrix that
> calls it a parity failure is measuring the expression instead of the truth.**

### The planted probes

Four objects — one per family — are removed from the **rendered light document** and the matrix must
fail for that object and for nothing else.

| probe | matrix failed | failed only for the removed object |
|---|---|---|
| the TOPIC removed | yes | yes |
| the CONNECTION removed | yes | yes |
| the PATTERN removed | yes | yes |
| the INSIGHT removed | yes | yes |

> **THE IDS ARE READ OUT OF THE REFERENCE CENSUS, NOT TYPED.** The first version typed
> plausible-looking ids and **three of the four probes silently removed nothing at all** and reported
> that the matrix had not failed. A probe that removes nothing passes quietly and proves the
> opposite of what it claims, which makes it worse than no probe. A probe that matches no element is
> now itself a failure.

## What DID change between the appearances, stated rather than left to be found

- **The World's fill differs**, obviously, and so does every other painted pixel.
- **The `#qd-truth` block is byte-identical** across appearances — check S-01, prohibition 2.
- **The state block differs only in the `appearance` field** — eleven other fields compared.
- **The screen-reader projection is identical**, and could not be otherwise: it has no appearance at
  all. That is evidence about the projection and **not** about a device.
- **No meaning-light source exists in either default** — 0 and 0.
- **Nothing is truncated in any of the 22 rendered expressions.**
