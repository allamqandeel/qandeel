# I-08B3.1-F1 — PART A: REDUCED MOTION

## 1. What is inherited, and F1 does not take credit for it

**I-08B3.1-D2R already designed four real reduced counterparts** for the four QANDEEL LIGHT
categories, proved every one reaches the **same settled residue** as its full-motion sibling,
proved **0 frames** of any counterpart contain a moving light, and proved the settled frames
byte-identical across sequences — *the end state does not depend on which version you saw.*

F1 does not redo that, does not re-derive it, and does not quietly absorb it. The six rows in
`data/F1_MOTION.json` marked `owner: "D2R"` are inherited; their `reduced` column is D2R's
decision and the file cites it. `tools/f1-boards.mjs` draws Board D by **calling D2R's own
`insightEvent(t)` and `insightReduced(t)`**, not by reimplementing them.

The principle, in D2R's words, is the one F1 extends:

> **KEEP LEVEL, INK AND DRAW; DROP TRAVEL, CONTRACTION, SCALE AND BLUR.**

## 2. The audit, by the five categories §5 asks for

`1 semantic · 2 navigation/orientation · 3 ambient · 4 decorative · 5 vestibular-triggering`

| motion | cat. | disposition | reduced expression | owner |
|---|---|---|---|---|
| ambient parallax | 2,3,5 | **REDUCE** | the differential goes; **the pan stays** | D2R |
| ambient momentum | 2,5 | **REMOVE** | the map stops where the finger let go — none, not a shorter one | D2R |
| CONNECTION | 1,3 | **REPLACE** | D1's counterpart, with `receptionBlur` 0.7988 → **0.0000** | D2R |
| PATTERN | 1 | **REPLACE** | four lights rise and fall **in place**; links and marks arrive by opacity **at full length** | D2R |
| INSIGHT | 1 | **REPLACE** | five lights at their **arrived** positions; the node arrives **sharp**; the keel draws | D2R |
| the ambient field | 3 | **KEEP** | nothing to reduce — it is already still | D2R |
| **GUIDED THREAD** | 1,2 | **REPLACE** | origin and destination both present from the first frame; the relation arrives by **LEVEL**, no path drawn | **F1** |
| **PRESS** | 1 | **REDUCE** | the ground response **stays**; a scale goes | **F1** |
| **FOCUS** | 1,2 | **KEEP** | the perimeter appears where focus is; it does not travel between targets | **F1** |
| **SELECTED** | 1 | **KEEP** | both channels are static properties of a settled state | **F1** |
| **CAMERA / semantic zoom** | 2,5 | **CARRY FORWARD** | a stated requirement, not a design — §19 forbids F1 designing it | **F1** |

**Eleven motions. Six inherited, five added. No semantic motion is REMOVED**, and check **M-01**
asserts that structurally: every category-1 row declares `keeps: [...]` naming the **surviving
channels** that carry its meaning, and a row that claimed to be carried by a suppressed channel
is rejected by the same predicate on every run.

> That check began as a regex over the prose and failed `light.connection`, whose counterpart is
> entirely correct and whose sentence simply lacked the vocabulary. **A check a row passes by
> being phrased agreeably is not a check.** It reads a field now.

### The two F1 rows that are decisions rather than bookkeeping

**GUIDED THREAD.** The thread's meaning is **continuity** — that this answer came from that
material. Continuity is a **relation between two endpoints**, and a relation is a state. Deleting
the thread under reduced motion would delete the only channel that says where an answer came
from, which is **provenance**, and §3 lists provenance among the things an accessibility
expression may not remove. Apple supplies the replacement in its own words: *"Consider using
fades when you need to relocate an object"* and *"instantaneous directional changes during a
quick fade-out."*

**PRESS.** One behaviour, two channels, different fates. E1 owns PRESSED as a **transient ground
response** — a LEVEL change, the channel reduced motion keeps. A press *scale* is a SCALE, and
Apple's list names scaling. Removing press feedback **entirely** would be the worst available
reading of the setting: it is the one moment where latency is perceived, and a control that does
not acknowledge a finger reads as broken rather than as calm.

## 3. The channels, as values a runtime reads

| channel | value | fate |
|---|---|---|
| `travel` | `{qandeel.illumination.reduced.travel}` | **suppressed** |
| `blur` | `{qandeel.illumination.reduced.blur}` | **suppressed** |
| `scale` | `0` | **suppressed** — F1's addition |
| `parallax-differential` | `{qandeel.illumination.reduced.parallax-differential}` | **suppressed** |
| `decay` | `0` | **suppressed** |
| `level` | `1` | **survives** |
| `ink` | `1` | **survives** |
| `draw` | `1` | **survives** |

Three of them **alias D2R's own scalars** rather than restating the numbers, so the two can never
drift. F1 reads a number there; it does not write a colour, and check S-01 names that crossing as
a declared exemption rather than letting it pass silently.

`draw` deserves its own line. The naive reduced-motion palette is opacity only. `impeccable`'s
craft floor says to *"reach past transform and opacity: blur, backdrop-filter, clip-path, mask,
and shadow belong to the palette"* — and a **reveal at a fixed position is not vestibular
motion**. That distinction is why a PATTERN's membership links and an INSIGHT's keel still
**arrive** rather than simply appear.

## 4. THE FINDING: the runtime default is the failure mode

Reanimated's documented behaviour under `ReduceMotion.System` — **which is the default for every
animation**:

| | |
|---|---|
| `withSpring`, `withTiming` | return the `toValue` **immediately** |
| `withDecay` | returns the current value immediately, respecting `clamp` |
| `withDelay` | starts the next animation immediately |
| `withRepeat` (infinite, or even and reversed) | **does not start** |
| `withSequence` | only starts children whose `reduceMotion` is `Never` |
| entering / keyframe / layout | jump to the endpoint immediately |
| **exiting / shared element transitions** | **ARE OMITTED ENTIRELY** |

Applied globally this does not make a QANDEEL meaning event gentler. **It makes it a cut.** The
last row is the worst: an omitted exit deletes the **1,150 ms settle**, which is the beat that
carries the result.

§25 of the brief lists *"Reduce Motion simply means 'nothing moves' where motion carried
meaning"* as a failure condition. **That is the library default.** So:

1. Do **not** rely on a global `<ReducedMotionConfig mode={ReduceMotion.System} />` and stop there.
2. Declare the **replacement** animation `reduceMotion: ReduceMotion.Never`, so the system setting
   cannot cut the channel that is carrying the meaning.
3. Switch the **suppressed** channels off from `qandeel.accessibility.motion.*`, **at the value**,
   rather than letting the library switch the whole animation off.
4. Read the setting from `AccessibilityInfo.isReduceMotionEnabled` **and** the
   `reduceMotionChanged` event — not only from `useReducedMotion`, which reports the setting *"when
   the app started"* and does not update at runtime.

The token file carries a scalar named `system-default-is-wrong-here` so this cannot be read as an
implementation note. Check **M-03** asserts the record contains the omitted-exit row.

## 5. Motion safety, inherited and re-stated

- **Nothing oscillates**, at any frequency. 0.2 Hz — the frequency two Apple sources name as the
  one people are most sensitive to — is the specific reason the ambient field is still.
- **Nothing flashes.** The fastest luminance change in the system is a 260 ms rise.
- **No full-viewport moving background.** The field moves only under the user's own hand.
- **Peripheral motion is bounded.** Every meaning event happens at a located point in the
  analytical plane; nothing animates at the edges of the frame.
