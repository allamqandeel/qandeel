# Qandeel Mobile — Live Analysis Render Spike

**Status: SPIKE, NOT PRODUCTION-FINAL.** This is Task 01: proof that a schema-driven
renderer can turn `AnalysisBeat[]` into the seven visual primitives, bilingual from the
first commit. It is not the product screen, and colour/typography here are placeholders
(`src/theme/tokens.ts` says so at the top of the file).

The previous placeholder README said not to implement product screens before the core
text runtime path and its contracts are stable. That still holds: nothing here talks to
`apps/api`, and the beat data comes from fixtures, not a runtime.

## Running it

```bash
cd apps/mobile
npm install
npm run web
```

`prestart`/`preweb` copy `canvaskit.wasm` out of `node_modules` into `public/` — Skia on
web is CanvasKit, and without that file the thread layer silently renders nothing.

For iOS/Android:

```bash
npx expo start
```

**Skia and Reanimated 4 are not in Expo Go**, so a native run needs a development build
(`npx expo run:ios` / `npx expo run:android`, or EAS). Web is the only target that runs
straight from a clean checkout with no native toolchain.

### Review deep links (web only)

- `?lang=ar` / `?lang=en` — start in that language
- `?beats=N` — start with N beats already played

They exist so a given frame can be opened and compared across the two directions without
clicking through playback. See `src/shell/reviewParams.ts`.

## Layout of the code

| Path | What it holds |
|---|---|
| `src/schema/types.ts` | The pack's shapes, transcribed. Departures are commented. |
| `src/schema/honesty.ts` | The weight-ceiling rule. Every emphasis decision goes through here. |
| `src/schema/adapter.ts` | `project(fixture, cursor)` → render state. The only module that knows the wire shape. |
| `src/render/primitives/` | The seven primitives, consuming view models. |
| `src/render/ThreadLayer.tsx` | The Skia overlay: threads, card brackets, meter traces. |
| `src/render/measure.tsx` | `measureLayout`-based positioning against the surface node. |
| `src/shell/layoutDirection.ts` | Reconciles selected-language direction with the engine's own. |
| `src/fixtures/` | `case_study_01.ar.json` (the pack's file, verbatim) and its English mirror. |

## Two things worth knowing before changing anything

**Positions come from `measureLayout`, not `onLayout`.** On react-native-web `onLayout`
reports `x: 0` for nested views; composing those rects collapses every span onto one point
and the threads degenerate into a single horizontal line that looks plausible and is
completely wrong. See the comment in `src/render/measure.tsx`.

**`I18nManager.isRTL` does not mean the same thing on web and native.** On iOS/Android a
true flag means Yoga has already mirrored `flexDirection: 'row'`. On web the flag exists
and nothing acts on it. `src/shell/layoutDirection.ts` is the only place that decides, and
no component hard-codes `row-reverse` or `flex-end`.
