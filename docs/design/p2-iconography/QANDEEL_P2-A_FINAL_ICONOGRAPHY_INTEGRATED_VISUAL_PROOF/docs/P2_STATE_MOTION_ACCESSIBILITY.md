# P2-A — State, Motion and Accessibility

**Status:** `P2-A EVIDENCE — NOT FROZEN`. The checks are in `data/CHECKS.json`: **24 / 24 pass, 8 / 8 planted defects
rejected**.

**Browser evidence only.** This proof runs in headless Chrome. VoiceOver / TalkBack, device Reduce Motion, Increase
Contrast, CallKit / Telecom and real touch remain device gates for the implementation (G1.2 §7; G3 §F). They are not
claimed here.

## 1. Accessibility, what was proved

| Requirement (task §16) | Proof | Check / board |
|---|---|---|
| Minimum target sizes | every button in every capture ≥ 44 × 44 pt: the Call Rail 44 × 44, navigation items 56 pt high, Return Live 60 pt, the Track band 44 pt | K08; board 15 |
| Screen-reader naming | every control carries its accessible name; icon-only controls use `aria-label` with the G1.2 R1 action label, e.g. «كتم الميكروفون» / «تشغيل الميكروفون» | K19; board 15 table |
| Decorative glyph handling | every glyph inside a control is `aria-hidden="true" focusable="false"`. Planted "mic glyph exposed" is rejected | K19 |
| Focus order = visual order | the DOM runs top → bottom and start → end: upper chrome, world, Track, Live act, OrientationChrome, Call Rail (route, mic, end), rail | board 15 overlay (numbers) |
| Detached focus perimeter | E1R's 2-pt indicator at a 2-pt offset, with its world-colour companion, on the rail controls, the Track, the Live act and navigation | board 11 crops; board 03 |
| Non-colour state | Mute = slash + a cut through the drawing; Route = fill + wave count; selection = marker + weight; press = the ground | K21 (planted "slash removed" rejected); K18 |
| Selected / pressed / disabled compatibility | selection and press never touch the Brass glyph (byte-identical and equal body pixels); disabled = E1R's one availability ink | K18; board 11 |
| RTL semantic direction | the Track runs SP1 → Live from the START edge; only the chevron and the layout art mirror | K20 (planted "mirrored mic" rejected); boards 08 and 09 |
| Reduced Motion parity | the same stance, Moment, offered acts, line and controls | K22; boards 15 and 07 |
| Dark / light contrast | inks are the frozen F2 / E1R tokens. Brass light 4.84 : 1 on the World (F2); rest ink on Surface per B4R. No new colour is introduced (K04) | board 12 |
| Icon-only controls understandable | universal metaphors (mic, handset, speaker, replay) plus names. The navigation keeps its **words**: the glyph never replaces the destination name | boards 03 and 05 |
| Every Moment reachable | the Live act no longer intercepts the Track's end (F-P2-02). There is a non-drag route for every temporal act (keyboard ← → Enter Escape, T-06) | K09; board 15 |

**Where geometry does not solve accessibility.** The Live terminal keeps its words: it is never icon-only (T-12). The
navigation glyphs are decorative, and the words name the buttons. Toggles expose `aria-pressed` and their action names.
The shapes are for sighted scanning only.

## 2. State model (the E1R channels, and what the glyph does)

See `P2_ICON_GEOMETRY_SPEC.md` §6. In short:
- the glyph never changes for REST, PRESSED, FOCUS or SELECTED;
- toggles change FORM;
- DISABLED is one ink;
- Brass never changes.

Found and fixed while measuring: G3.2's rail press wash was a positioned `::before` painted **over** the unpositioned
word and glyph. It tinted the Brass while pressed. The wash now lies under the content, as E1R's "PRESSED belongs to
the ground" requires (K18).

## 3. Motion — Calm State Morphing

| Transition | Standard | Reduced Motion | Clip |
|---|---|---|---|
| Mic → Muted → Mic | the slash draws and the cut opens **together**, 180 ms (T-10 curve `0.23, 1, 0.32, 1`); reverse withdraws both | the same draw (drawing a line is kept under RM: F1 "keep level, ink and draw; drop travel, contraction, scale and blur") | `M01`, `M01r` |
| Speaker ↔ earpiece | the body fills / empties and the outer wave draws / withdraws together, 180 ms | the same (fill and draw) | `M02` |
| Press (Mic, Route, End) | E1R's ground wash from pointer-down, no residue | the same (a ground response is kept; a scale would go) | `M03` |
| End Call | the press, then the rail leaves with the call (the G3.2 call line's existing exit) | no travel | `M03` |
| Scrub | the preview aperture is **drawn at the finger** (0 ms, no easing), ≤ 0.04 pt | identical (1:1 is not animation) | `M04`, `M04r` |
| Preview → committed | release: retarget from the finger to the Moment in 140 ms (M1), then **one** settle, +9 % scaleY, 80 / 120 ms (M2) | on the Moment at once; no settle | `M04`, `M04r` |
| Cancel | the preview returns to the committed opening in 240 ms (M3) and fades | gone at once | `M05` |
| Return Live | the aperture closes **in place** (140 ms); the terminal engages (160 ms); nothing travels, nothing pulses | the aperture is cut; the terminal resolves in 140 ms of opacity | `M06`, `M06r` |
| A new Moment | its notch resolves in, in 140 ms of opacity; nothing else moves | the same resolve | `M07` |

**Rules held** (animate-expo; T-10; apple-design; checks K11–K16):
- motion reinforces a state change and never invents one;
- no bounce: every curve is T-10's single ease-out, and the only overshoot is M2's single settle after a finger commit;
- no decorative loop, and no attention pulse: a 10-s still state is constant;
- no lag under the finger;
- the same semantic result under Reduced Motion (K22).

Durations are T-06 / T-10 values, plus G1.2-style 180-ms toggles. They are craft, not Product law.

**Motion clips.** Ten clips in `motion/`, each described in `data/motion/*.truth.json`, with 30-fps frame truth
(TM / TC / PTC / LH, the drawn aperture positions, the finger position). Each clip decodes back to its exact frame count
(K23). They show the phone's lower 48 % at 3× (390 × 844 phone), which is where both machines live.

## 4. Gaps (honest)

- Device assistive technology, device Reduce Motion and real touch latency are **not validated** here. These are
  implementation gates.
- **Increase Contrast.** It was not rendered as a separate board. F1R2 moves functional ink tertiary → secondary and
  focus 2 → 3 pt, and the machines use only those tokens, so the system inherits the rule. A device capture is still
  owed.
- **Large text** at 320 pt in the densest call + PINNED state remains the G3-recorded implementation item (G3 §G,
  F-08).
