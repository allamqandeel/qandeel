# QANDEEL — I-08B3.1-G1.2-R1
## Direct Product Correction Record

**Status:** `CORRECTED BY INDEPENDENT REVIEW — DELTA ONLY`  
**Parent proof:** `I-08B3.1-G1.2-VOICE-LIVE-CONVERSATION-BACKGROUND-SAFE-PROOF`  
**Original proof ZIP SHA-256:** `1b297be9402960928dfc85574cdf7fc3a88b1c59e6777af806e5a1d9f7ec3e96`

This delta was applied directly during independent review. Claude was **not** rerun and the full G1.2 proof/render pipeline was **not** repeated, because the accepted behavioral proof is unchanged and the corrections are bounded to Product naming / visible-state presentation.

## Corrections applied

1. **Shared World Product-area name**
   - Stable Arabic name is now **«العالم المشترك»**.
   - It remains singular whether the user currently has zero, one, or multiple Shared Worlds.
   - «مع الآخرين» and count-dependent «عوالم مشتركة» are not the stable area/navigation name.
   - English Product-area name is **Shared World** as a stable singular name regardless of count.

2. **Ordinary Live Call state words are no longer persistently visible**
   - «الميكروفون شغّال» is not shown as a persistent normal-state sentence.
   - «الميكروفون مكتوم» is not shown as a persistent normal-state sentence.
   - «قنديل بيتكلم» is not shown as a persistent normal-state sentence.
   - Call-active state remains visually legible through the call controls, elapsed time and current proof activity language.
   - Exceptional/transitional states still keep visible explanatory text: connecting, reconnecting, failure, permission/recovery.

3. **Accessibility truth is retained**
   - Normal call-state strings remain available to assistive technology through a dedicated visually-hidden live status.
   - The mute control changes its accessible action label between **كتم الميكروفون** and **تشغيل الميكروفون**.
   - The visible-copy reduction therefore does not make call state color/motion-only for screen-reader users.
   - Final independent review removed redundant duplicate announcements: normal/transition call state now uses one dedicated assistive live-status channel rather than also announcing the same state through the generic live region.

4. **Microphone permission education is first-need / recovery only**
   - The existing proof runtime already behaved correctly: granted permission bypasses the prompt, denied permission surfaces recovery, and unknown permission invokes the OS prompt only from explicit Voice Note / Live Call intent.
   - No repeated custom microphone education is required before every later call while permission remains granted.

## Deliberately unchanged / deferred

The following are **proof-only and not frozen by G1.2**:

- current small icon/glyph shapes;
- microphone / call / speaker / end-call / Replay icon craft;
- current audio strip / waveform / activity visualization;
- final Voice visual language.

These were intentionally **not redesigned here**. Their final premium craft belongs in the appropriate later iconography / voice-visual-language work.

The following behavioral contracts are also unchanged:

- Live Call starts Analysis-first;
- Live Call continues through lock/background/other apps;
- returning to QANDEEL restores the last truthful in-call surface;
- call identity and Conversation identity remain continuous;
- force-stop / genuine termination is never faked as an active call;
- Replay audio/runtime limitations remain unchanged.

## Why no rerender cycle was required

The correction does **not** redesign geometry, iconography, audio-strip morphology, Analysis visuals, background behavior, motion timing, or call navigation. Re-running the full 97 MB proof and all motion recordings would add process cost without proving new Product behavior.

The source/prototype was rebuilt after the patch and a targeted static/runtime-contract verification was run. The original G1.2 motion/behavior evidence remains valid for continuity/background behavior; its visible normal-state wording is superseded by this R1 correction record.

## Verification

`R1_TARGETED_CHECKS.json` records **16/16 PASS**. It verifies:

- stable «العالم المشترك» naming;
- removal of old shared-area labels from current proof source;
- normal call-state text removed from the visible call line;
- the same normal-state truth retained for accessibility;
- mute accessibility semantics;
- first-need/recovery microphone permission logic;
- iconography source byte-identical to the original package;
- audio activity-strip logic byte-identical to the original package;
- background/foreground call restoration functions byte-identical to the original package;
- rebuilt prototype source carries the correction;
- call-state accessibility uses a single live-status channel without duplicate state announcements.

> **G1.2-R1 — CORRECTION COMPLETE / READY FOR FINAL INDEPENDENT G1.2 CLOSURE REVIEW**

This record does not itself merge or freeze a Voice runtime.
