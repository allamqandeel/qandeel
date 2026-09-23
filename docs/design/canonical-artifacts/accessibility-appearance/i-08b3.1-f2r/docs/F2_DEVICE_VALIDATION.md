# I-08B3.1-F2 — DEVICE VALIDATION RECORD

> **If devices are NOT available: state that plainly. Do not fabricate.** — §29

## No device validation was performed

**No iPhone, no Android, no photometer, no VoiceOver, no TalkBack.** Every figure in this package
was measured on one renderer — headless Chrome on Windows, sRGB colour profile forced, LCD subpixel
antialiasing disabled, device metrics overridden to 390 × 844 CSS px at DPR 2.

§29 also says: *"Do not create F3 solely because a device was unavailable."* F2 does not. What it
does instead is name precisely which claims a device would have to test, so the gap is a list rather
than a feeling.

## What this renderer CAN stand in for

- **Colour arithmetic.** Every conversion is CSS Color 4 and every contrast figure is the WCAG 2.2
  normative definition, computed on the **quantised 8-bit hex** a display actually receives. That
  arithmetic is the same everywhere.
- **Composite behaviour.** Alpha compositing, gradient interpolation and the grayscale / dichromacy
  matrices are browser operations a phone performs identically enough for the distances measured
  here.
- **Layout and type metrics** at a phone viewport, including Arabic at every Dynamic Type step up to
  AX5.
- **The accessibility tree**, as an engine computes it — which is **not** a screen reader.

## What it CANNOT stand in for, and what each one puts at risk

### 1 — Glare, and the Light World's lightness

**The claim at risk:** that `#efeeeb` at OKLCh L 0.9491 is comfortable rather than glaring.

Apple's Color guidance: *"In bright surroundings, colors look darker and more muted. In dark
environments, colors appear bright and saturated."* A light appearance is used in exactly the
condition this renderer cannot reproduce. `qandeel.appearance.light-world-lightness` is classified
**production-default** for this reason and is tunable **downward** on device evidence.

### 2 — The meaning event's source, and the thin margin

**The claim at risk:** that a reader can see a light come on.

The source clears its floor by **about 12%** — a grayscale rise of 0.021 against a just-noticeable
0.020 — and the flooded core sits at OKLCh L 0.9741, near the top of sRGB. **On a display that
cannot reach the sRGB ceiling, or under ambient light bright enough to wash the top of the range,
the source may be lost while the glaze survives.** The event would then read as a stain, which is
the failure §8 names.

This is the **single most device-sensitive claim in the package.** The remedy if it fails is known
and is in the record: lower the Light World. The sweep at `data/F2_DERIVATION.json` shows what the
source's rise becomes at every candidate lightness from 0.880 up.

### 3 — Living Brass as a material

**The claim at risk:** that `#7a6446` reads as the same metal as `#a58e6f`.

Hue and chroma are held to 0.13° and 0.0005, and the ladder rung is unchanged — but **"does it still
feel like brass"** is not a measurement. On a warm-shifted display, under True Tone, or in warm
ambient light, a mid-lightness warm tone is exactly the kind of colour that drifts toward brown.
§32 asks the Product Owner to judge this, and a device is where they should judge it.

### 4 — The Error family

**The claim at risk:** that a Product Owner looking at `#fe907e` and `#ad4739` says *"same QANDEEL
Error."* Hue is held to 0.2°. Whether that is enough is a judgement, and it is judged on a screen.

### 5 — The appearance switch

**The claims at risk:** that no Product state is lost, and that the cross-fade reads as a
re-projection rather than a transformation. The first is an **Android Activity lifecycle** question
this renderer cannot ask at all — see the `uiMode` finding in `F2_IMPLEMENTATION.md`. The second is
a motion judgement.

### 6 — Screen readers

**No VoiceOver or TalkBack run exists, in either appearance.** I-08B3.1-F1 recorded this as a
mandatory implementation / integration validation gate and F2 does not discharge it. **Browser
accessibility-tree evidence does not equal real screen-reader validation**, and the fact that the
screen-reader projection is identical across appearances is evidence about the projection, not about
a device.

### 7 — Weaker Android hardware

§29 asks for a weaker Android device where practical. None was available. Two properties are at risk
there specifically: **panel colour accuracy at the top of the range**, which bears on the source
above, and **gradient banding** in the bloom, which this renderer will not show.

## The device gates, as a list

| # | gate | what fails if it fails |
|---|---|---|
| 1 | The Light World is comfortable in bright ambient light | tune `light-world-lightness` downward; the sweep shows the cost |
| 2 | **The meaning-light source is visible on a real panel** | the event reads as a stain; Part C is re-opened |
| 3 | Living Brass reads as the same material in both appearances | §7; the Product Owner's call |
| 4 | Error reads as the same family in both appearances | §13; the Product Owner's call |
| 5 | **Analytical state survives a real system appearance change on Android** | §16; requires `android:configChanges="uiMode"` |
| 6 | **VoiceOver and TalkBack, in both appearances** | inherited from I-08B3.1-F1, still open |
| 7 | No banding in the bloom on a weaker panel | the glaze's gradient may need dithering |

**Gates 2, 5 and 6 are the ones that could change a Product decision rather than a calibration.**
