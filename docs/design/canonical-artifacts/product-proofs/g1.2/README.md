# I-08B3.1-G1.2-VOICE-LIVE-CONVERSATION-BACKGROUND-SAFE-PROOF

**Status: READY FOR INDEPENDENT PRODUCT / DESIGN REVIEW.** Not merged. G1.2 is not closed by this package, and no
Voice runtime truth is frozen. G1.1 is treated as CLOSED / FROZEN and is not reopened.

Voice + Live Conversation Experience Proof — Writing, Voice Note and Live Call inside the frozen G1.1 shell. It proves
the Live Call's background continuation and exact restore, and carries a bounded platform / store compliance note for
the future production implementation.

## Read in this order

1. `proof/G12-00-at-a-glance.png`
2. `proof/background-restore/G12-05-background-and-exact-restore.png` and `proof/motion/C-background-restore-ar.mp4`
3. `G1.2_FINAL_REPORT.md` — the Product / design outcome, quality gates, open decisions (§O), what was not verified (§P)
4. `G1.2_BACKGROUND_CALL_PLATFORM_COMPLIANCE_NOTE.md` — iOS, Android, Google Play, Expo; official sources
5. `G1.2_AUDIO_RUNTIME_DEPENDENCY_NOTE.md` — Voice Note audio, call transport, background, Replay audio, provider gaps
6. `G1.2_SKILL_USAGE_LEDGER.md` — the mandatory Skill Gate
7. `EVIDENCE_INDEX.md` — every screen, recording, board and prototype file

## Layout

```text
/
├─ G1.2_FINAL_REPORT.md
├─ G1.2_SKILL_USAGE_LEDGER.md
├─ G1.2_BACKGROUND_CALL_PLATFORM_COMPLIANCE_NOTE.md
├─ G1.2_AUDIO_RUNTIME_DEPENDENCY_NOTE.md
├─ EVIDENCE_INDEX.md
├─ proof/
│  ├─ writing/  voice-note/  live-call/  background-restore/  permissions-failure/
│  ├─ bilingual/  light/  accessibility/      (boards + screens/ at 780 × 1688)
│  └─ motion/                                 (13 MP4s, boards, frames/)
├─ prototype/        index.html (ar) · index-en.html · index-voice-history.html — open in Chrome
├─ data/             G12_CHECKS.json · SCREENS.json · motion truth logs · MANIFEST.json
├─ source/           src/ · tools/ · vendor/ — the whole proof regenerates from here (source/REGENERATE.md)
├─ source-notes/SOURCE_TRACE.md
└─ README.md
```

## Trying the prototype

Open `prototype/index.html`.

- **Writing:** write, and press Enter.
- **Voice Note:** tap the microphone.
- **Live Call:** tap the handset.

The review panel beside the phone simulates the operating system:

- lock the screen, or open another app;
- return to QANDEEL;
- network drops, network returns, reconnection fails;
- the call ends while away;
- force-quit and relaunch;
- speak over QANDEEL (candidate).

The panel's truth box shows the call id and the Conversation id, which never change within one call.

The microphone permission is simulated (`?perm=unknown|granted|denied`). There is no voice runtime: speech follows a
fixed script, and nothing is recorded, stored or sent.
