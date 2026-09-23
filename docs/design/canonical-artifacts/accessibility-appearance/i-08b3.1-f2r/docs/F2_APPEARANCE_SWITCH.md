# I-08B3.1-F2 — THE APPEARANCE-SWITCH CONTRACT

> An appearance change is **NOT** a meaning event, a new insight, a new analytical state, a
> navigation event or a temporal event. — §16

## It happens unprompted, and that is why this matters

Apple's Dark Mode guidance is explicit:

> *"people can choose the Auto appearance setting, which switches between the light and dark
> appearances as conditions change throughout the day, **potentially while your app is running**."*

And React Native's own source says the same from the other side: `getColorScheme()` *"may change at
runtime, either at the system level (e.g. scheduled color scheme change at sunrise or sunset)"*.

**So the switch is not a rare user action. It is a scheduled system event that arrives in the middle
of whatever the person is doing** — and `tools/f2-switch.mjs` treats an unprompted mid-session
switch as the normal case.

## The contract

```
qandeel.appearance.switch.is-not-a-meaning-event = "reproject-only"
```

QANDEEL Light is not replayed. Analytical motion is not restarted. Semantic state is not altered.
Selection, focus and navigation are not reset. No Timeline history is created. **Only the appearance
projection changes.**

## Five prohibitions, five different failures, five different measurements

**State: PASS.**

The proof runs against a **deliberately non-default** state — a selected row, the shared world, an
enlarged text setting, bold text and increased contrast — because testing the default would prove
nothing: **the default is what a reset produces.**

### 1 — No meaning replay

Count the meaning-light sources in both projections. **Dark: 0. Light: 0.** The `data-qd-event`
attribute is `none` on both. If an appearance change enqueued a meaning event, it would be telling
the user that something was understood when nothing was.

### 2 — No semantic change

The `#qd-truth` block, **byte for byte**, across the switch. 3,894 bytes on both sides, identical.

### 3 — No state reset

The `#qd-state` block, **field by field**: eleven fields compared, **zero differing**, plus the
count of `aria-current` rows, the count of focusable controls and the rendered world name.

### 4 — No new history

The canonical order and the object counts, unchanged: 8 topics, 1 connection, 1 pattern, 1 insight.

### 5 — The cross-fade adds nothing

**This is the strongest of the five and the only one about the transition rather than its ends.**

A cross-fade between appearances is a cross-dissolve of two projections. So both are rendered, the
blend is computed at phases 0, 0.25, 0.5, 0.75 and 1, and the property asserted is:

> **every channel of every intermediate pixel lies between its dark value and its light value,
> inclusive, within one 8-bit step.**

If no pixel at any phase lies outside that segment, then **nothing appears during the transition
that is not already in one of the two projections.** A replayed light, a flash, an overshoot or a
settling animation would all put a pixel outside it, and there is nowhere else for them to hide.

**Result: 0 channels outside the segment at every phase.**

> **IT IS MEASURED ON RASTERS RATHER THAN RENDERED AS A PAGE.** Rendering an HTML approximation of a
> cross-fade would produce a picture of F2's *idea* of one and then measure that. The blend is
> computed instead, on the arithmetic a compositor will actually perform.

### The probe

A cross-fade that **replays the meaning light at its midpoint** — precisely the failure §16 names.
The segment test rejects it with **4,559 channels outside the segment**, worst excursion **48**.

## The cross-fade itself

```
qandeel.appearance.switch.crossfade                = 200 ms
qandeel.appearance.switch.crossfade-reduced-motion =   0 ms
```

**It exists because Apple's accessibility guidance asks for it.** §14 of the `apple-design` skill:
*"avoid … abrupt brightness jumps (ease dark↔light theme changes)"*. A dark-to-light switch is the
largest brightness jump the Product can make.

**It is deliberately NOT the meaning lifecycle.** I-08B3.1-D2R's meaning envelope is 260 ms of rise
and 1,150 ms of fall, asymmetric, because a meaning event **arrives**. An appearance change does not
arrive; it is the same world seen differently. So it is a **symmetric** cross-fade with no rise, no
settle and no residue. **A reader who cannot tell an appearance change from an insight has been told
something untrue**, and check **S-02** asserts that the cross-fade duration is neither the rise nor
the fall.

## Under Reduced Motion the cross-fade is REMOVED, not shortened

**This is the one place F2 departs from the obvious reading of I-08B3.1-F1's channel model**, which
keeps opacity and colour changes because they carry comprehension.

The same sentence of Apple's guidance that asks for the ease also names the hazard: *"avoid
full-viewport moving backgrounds, slow looping oscillations … and abrupt brightness jumps"*. A
full-viewport luminance ramp is large, it covers the whole field of view, and for a light-sensitive
reader **the transition itself is the problem**.

**The cross-fade carries no meaning** — the appearance change is not a semantic event — **so
removing it costs no comprehension at all.** F1's rule protects channels that carry something. A
channel that carries nothing is not defended.

## The implementation requirement that only the Reference Gate found

> *"When the app's theme changes, either through the system setting or AppCompat, it triggers a
> `uiMode` configuration change, **which automatically recreates activities**."* — Android
> Developers, Dark theme

**On Android, by default, an appearance change destroys and recreates the Activity.** The platform's
default behaviour is precisely the thing prohibition 3 forbids.

A package that proved this contract only in a browser would have shipped a contract the runtime
violates on one of its two platforms. So `F2_IMPLEMENTATION.md` carries a **required declaration** —
`android:configChanges="uiMode"` on the hosting Activity — and an integration gate that the
analytical state survives a real system appearance change on a device.

It is the same shape of finding I-08B3.1-F1 recorded when a documented Reanimated default silently
deleted the exit that carries QANDEEL's settle.

## System appearance, and the toggle F2 did not build

```
qandeel.appearance.system-appearance = "follow-system-no-in-app-override"
```

`Appearance.setColorScheme()` exists in React Native and would make an in-app override trivial. It
is deliberately not used:

> *"Avoid offering an app-specific appearance setting. An app-specific appearance mode option
> creates more work for people because they have to adjust more than one setting to get the
> appearance they want. Worse, they may think your app is broken because it doesn't respond to their
> systemwide appearance choice."* — Apple HIG, Dark Mode

§17 says the same. **An explicit override is a Product preference decision** with its own surface,
its own persistence and its own relationship to Settings QANDEEL does not yet have. It is recorded
as an open Product option rather than taken.

**And Android dynamic colour is not adopted.** Material 3 can derive an entire scheme from the user's
wallpaper. QANDEEL's palette *is* its identity — Living Brass is the material the Product is made of,
and the chroma ladder is how its semantics are encoded. Platform theming informs the implementation;
it does not author the system.
