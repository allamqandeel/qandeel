// P4-C — the evidence matrix (data/DECISION_MATRIX.json). Qualitative only — STRONG · ACCEPTABLE · CONCERN ·
// FAILS AUTHORITY — never a number standing in for judgement. Each rating is the proof author's assessment and cites the
// evidence it rests on; where a rating depends on geometry, the geometry is read from data/SHOTS.json and
// data/CHECKS.json here, so the words and the measurements cannot drift apart. A recommendation is ADVISORY; every
// decision stays OPEN for the Product Owner.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PKG } from './lib/session.mjs';
import { DECISIONS, DIRECTIONS, LABEL_CANDIDATE, LABEL_INTEGRATED } from '../src/candidates.mjs';

const SH = Object.fromEntries(JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')).shots.map((s) => [s.id, s]));
const CH = (() => { try { return JSON.parse(readFileSync(join(PKG, 'data', 'CHECKS.json'), 'utf8')); } catch { return null; } })();
const r1 = (v) => Math.round(v * 10) / 10;

/** The free span of the upper chrome between the START group and the END group (or the far edge), in points. */
export function chrome(id) {
  const s = SH[id]; if (!s) throw new Error('no shot ' + id);
  const m = s.measured, h = m.hdr, rtl = m.phone.dir === 'rtl', W = s.w;
  const st = h.start, en = h.end;
  const edge = rtl ? (en ? en.r : 10) : (en ? en.x : W - 10);
  const gap = rtl ? st.x - edge : edge - st.r;
  const overflow = h.scrollW > h.clientW + 0.5;
  const off = h.kids.filter((k) => k.x < -0.5 || k.r > W + 0.5).map((k) => k.id);
  const q = h.q ? (() => { const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)); const hit = h.kids.filter((k) => inter(h.q, k) > 0.5).map((k) => k.id); return { w: h.q.w, clash: hit }; })() : null;
  return { gap: r1(gap), overflow, off, q, controls: h.kids.length, conv: m.conv ? r1(m.conv.h) : null };
}
const E = {
  sA390: chrome('s-A-conv-ad'), sB390: chrome('s-B-conv-ad'), sA320: chrome('s-A-conv-a320'), sB320: chrome('s-B-conv-a320'), sAe320: chrome('s-A-conv-e320'), sBe320: chrome('s-B-conv-e320'), sAsh: chrome('s-A-shared-ad'), sBsh: chrome('s-B-shared-ad'),
  uA390: chrome('u-A-ad'), uB390: chrome('u-B-ad'), uAe320: chrome('u-A-e320'), uBe320: chrome('u-B-e320'), uBa320: chrome('u-B-a320'), uBsA320: chrome('u-B-sA-a320'), uBel: chrome('u-B-el'),
  qB390: chrome('q-B-conv-ad'), qBsA390: chrome('q-B-sA-conv-ad'), qBsA320: chrome('q-B-sA-conv-a320'), qB320: chrome('q-B-conv-a320'), qC390: chrome('q-C-conv-ad'),
};
const convH = { withRow320: SH['u-A-a320'].measured.conv.h, noRow320: SH['u-B-sA-a320'].measured.conv.h };
const ctx = (id) => { const s = SH[id], x = s.measured.ctx[0], R = s.measured.g32.rects, back = R.back, rep = R.replay; const rtl = s.lang === 'ar';
  const gapBack = rtl ? back.x - x.r : x.x - back.r, gapRep = rtl ? x.x - rep.r : rep.x - x.r; return { gapBack: r1(gapBack), gapReplay: r1(gapRep) }; };
const X = { endA320: ctx('x-end-cp320-ad'), endE320: ctx('x-end-cp320-el'), cenA320: ctx('x-centre-cp320-ad'), cenE320: ctx('x-centre-cp320-el') };
const wc = CH ? CH.worldCost.filter((w) => w.placement === 'top') : [];
const worst = wc.length ? wc.reduce((a, b) => (a.unobstructed < b.unobstructed ? a : b)) : null;

const DIMS = ['canonical compliance', 'discoverability', 'semantic clarity', 'hierarchy', 'chrome crowding', 'Personal-centeredness', 'brand restraint', 'Arabic RTL', 'English LTR', '320 pt resilience', 'accessibility', 'cross-surface coherence', 'implementation risk'];
const S = 'STRONG', A = 'ACCEPTABLE', C = 'CONCERN', FA = 'FAILS AUTHORITY';
const dims = (a) => { if (a.length !== DIMS.length) throw new Error('13 ratings'); return Object.fromEntries(DIMS.map((d, i) => [d, a[i]])); };
const cand = (id, name, boards, ratings, evidence, status = LABEL_CANDIDATE) => ({ id, name, status, boards, dimensions: dims(ratings), evidence });

const decisions = [
  { dq: 'P4-DQ-01', title: DECISIONS.settings.title, state: 'OPEN', boards: ['02-dq01-settings-placement', '07-integrated-ar-dark', '08-integrated-en-light', '09-compact-320-stress'],
    candidates: [
      cand('S-A', DECISIONS.settings.options.A.name, ['02', '07', '08', '09'], [S, S, A, A, C, A, S, S, C, C, S, S, A], [
        `the same icon-only entry in the same START utility group on every non-Analysis surface (Personal and Shared measured; Activity stays at the START edge — C-ACT-1)`,
        `Personal chrome at 390 AR: ${E.sA390.controls} controls in two groups, ${E.sA390.gap} pt free between them; at 320 AR: ${E.sA320.gap} pt, no overflow`,
        `at 320 EN the Personal chrome OVERFLOWS by ${Math.round(SH['s-A-conv-e320'].measured.hdr.scrollW - SH['s-A-conv-e320'].measured.hdr.clientW)} pt (${E.sAe320.off.join(', ') || 'the END group'} pushed past the edge): Activity + Settings + the door's proof English label "Conversation analysis" + Replay do not fit. That label is OPEN copy (G1.1 §2) and belongs to P4-DQ-09; S-A fits at 320 EN only if the final English label is at least that much narrower. S-B at 320 EN: ${E.sBe320.overflow ? 'overflows' : E.sBe320.gap + ' pt free'}`,
        `a second neutral glyph beside Open Ledger reads as the global utility pair; the END group stays the conversation's own acts — two groups, within the HIG's "aim for a maximum of three"; craft note (Review Pool): the curated Hugeicons gear reads optically denser than Open Ledger beside it, so the secondary utility can outweigh Activity — a weight / size tuning inside P2's utility rule, not a placement change`,
        `320 resilience is conditional: combined with U-B the Personal chrome overflows (${E.uBsA320.off.join(', ') || 'none'} pushed off-screen), and with Q-B the Q strikes ${E.qBsA320.q ? E.qBsA320.q.clash.join(', ') || 'nothing' : 'n/a'}`]),
      cand('S-B', DECISIONS.settings.options.B.name, ['02', '07', '09'], [A, C, C, S, S, S, S, S, S, S, S, C, S], [
        `global chrome keeps only P3's Activity (${E.sB390.gap} pt free at 390 AR; ${E.sB320.gap} pt at 320 AR); Settings sits at the END of the Personal row`,
        `from a Shared World (and, once drawn, the Public World) the one destination is not visible: the user switches to QANDEEL first — the P3 Activity page's Notifications & Activity shortcut is the only other route`,
        `a gear on the Personal row beside «فهم قنديل» can read as the settings OF QANDEEL (a Personal/Profile setting) rather than the app's account / privacy / appearance / notifications`,
        `tension, not a conflict: I-08A4 §7 / P1 §8 call Settings a "secondary Global Shell utility"; S-B reaches it from the shell's Personal root only`]),
    ],
    notEarned: DECISIONS.settings.notEarned,
    recommendation: { advisory: true, direction: 'S-A, conditional on P4-DQ-09', strength: 'conditional', why: 'Settings holds app-wide account, privacy, appearance and notification controls, and S-A keeps the one destination in one predictable place on every non-Analysis surface, as a utility pair with Activity. But with the current proof English door label the Personal chrome overflows at 320 pt in English: S-A is advisable only together with an English Conversation → Analysis label (P4-DQ-09) that fits; if the Product Owner keeps a label of that length, S-B is the placement the evidence supports.' },
    productOwnerJudgement: 'Whether the one General Settings destination should feel global (S-A: one more glyph in every non-Analysis upper chrome) or Personal-rooted (S-B: reached from Personal QANDEEL only, accepting that a Shared World shows no Settings entry).',
    question: 'Is the General Settings entry an icon-only utility beside Activity in the upper chrome of every non-Analysis surface (S-A), or a stable entry on the Personal QANDEEL surface only (S-B)?' },
  { dq: 'P4-DQ-02', title: DECISIONS.understanding.title, state: 'OPEN', boards: ['03-dq02-understanding-placement', '07-integrated-ar-dark', '09-compact-320-stress'],
    candidates: [
      cand('U-A', DECISIONS.understanding.options.A.name, ['03', '07', '08', '09'], [S, S, S, A, A, S, S, S, A, A, S, S, A], [
        `the Personal row: «فهم قنديل» in its own words with the depth chevron (mirrored by meaning), START-aligned, on Personal QANDEEL only — the counterpart of a Shared World's own name row`,
        `it costs one 44 pt row: the Personal conversation at 320 × 568 keeps ${r1(convH.withRow320)} pt (${r1(convH.noRow320)} pt without the row)`,
        `reads as a Personal depth, not a tab, a Profile or Settings: it is words (no glyph), outside the switcher, and away from the gear under S-A`,
        `English "QANDEEL Understanding" is long; it fits the row at 320 pt without truncation (C-TGT-1, captures u-A-e320)`,
        'the row has no edge of its own: conversation content leaves the top through the conversation\'s own 22 pt fade (G3.2\'s conversation grammar, applied to every candidate and the baseline), so the opener and its Q are never sliced by a hard cut (Review Pool finding, corrected)']),
      cand('U-B', DECISIONS.understanding.options.B.name, ['03', '09'], [C, A, C, C, C, A, S, C, C, C, A, C, C], [
        `beside «تحليل المحادثة» the two Personal depths read as two similar text acts; «فهم قنديل» next to the Conversation's own analysis invites "the understanding of THIS conversation", close to the in-Analysis «القراءات»`,
        `390 AR: ${E.uB390.gap} pt left in the chrome; 390 EN: ${E.uBel.overflow ? 'overflows — ' + E.uBel.off.join(', ') + ' pushed off-screen on a standard phone' : E.uBel.gap + ' pt'}`,
        `320 AR (S-B): ${E.uBa320.overflow ? 'overflows — ' + (E.uBa320.off.join(', ') || 'no control') + ' off-screen' : E.uBa320.gap + ' pt free'}; 320 EN: ${E.uBe320.overflow ? 'overflows — ' + (E.uBe320.off.join(', ') || 'no control') + ' off-screen' : E.uBe320.gap + ' pt free'}; with S-A at 320 AR: ${E.uBsA320.off.join(', ') || 'none'} off-screen`,
        `keeping it on screen at 320 pt would take the door's word or Replay's place, which G1.1 §1 and P3 §3 keep ("leaves «تحليل المحادثة» and Replay their G1.1 places") — as drawn it therefore fails at 390 EN and at 320 pt. That is a weakness of the one U-B form drawn, not an authority rejection: the queue lists U-B as viable, and a refined U-B that kept the door and Replay would need a second line, which is U-A's shape`]),
      { id: 'U-S', name: 'a General Settings row', status: 'REJECTED BY AUTHORITY', boards: ['03'], dimensions: dims([FA, C, FA, C, S, C, S, A, A, S, A, C, S]), evidence: [DECISIONS.understanding.rejected[0].why, 'shown only as the planted defect `understandinginsettings`, which C-UND-1 rejects'] },
    ],
    recommendation: { advisory: true, direction: 'U-A', strength: 'moderate', why: 'U-A is the only studied form that is stable, discoverable, on Personal QANDEEL, distinct from «تحليل المحادثة» and «القراءات», and resilient at 320 pt; U-B as drawn overflows at 390 pt in English and at 320 pt, where it would displace frozen chrome.' },
    productOwnerJudgement: 'Whether a Personal row under the upper chrome (one 44 pt line) is the right price for a stable Understanding entry; the control form (words + depth chevron, no new glyph) is part of the same choice.',
    question: 'Is «فهم قنديل / QANDEEL Understanding» entered from a persistent Personal row under the upper chrome (U-A), or from the Conversation chrome beside «تحليل المحادثة» (U-B)?' },
  { dq: 'P4-DQ-03', title: DECISIONS.q.title, state: 'OPEN', boards: ['04-dq03-q-placement', '11-decision-summary'],
    candidates: [
      cand('Q-A', DECISIONS.q.options.A.name, ['04'], [S, A, S, S, S, A, S, S, S, S, S, S, S], [
        'no chrome Q: the Q appears where it says something — the frozen Matching cue (G2.3 §1, G3.2 M1_CUE), and beside QANDEEL\'s opening turn as G3.2 draws it (G3.2 proof composition; whether the opener counts as an identity moment is part of the choice)',
        'matches C3 §8\'s cited HIG ("Resist the temptation to display your logo throughout your app") and HIG Branding "Ensure branding always defers to content"',
        'launch / splash / gateway stay P4-DQ-06; this answer does not decide them']),
      cand('Q-B', DECISIONS.q.options.B.name, ['04'], [C, A, C, C, C, A, C, A, A, C, A, C, A], [
        `given its best case (the centre of the free chrome span, not the physical centre): Personal 390 AR with S-B leaves ${E.qB390.q ? E.qB390.gap : '—'} pt around a ${E.qB390.q ? r1(E.qB390.q.w) : '—'} pt Q; with S-A ${E.qBsA390.q && E.qBsA390.q.clash.length ? 'the Q strikes ' + E.qBsA390.q.clash.join(', ') : E.qBsA390.gap + ' pt'}; 320 AR with S-A: ${E.qBsA320.q && E.qBsA320.q.clash.length ? 'the Q strikes ' + E.qBsA320.q.clash.join(', ') : 'fits'}`,
        'the only Brass object in the chrome, centred between two neutral groups, pulls the eye away from the conversation; on Personal it doubles the opener\'s Q; at chrome size the ring-and-tail can read as a search / magnifier glyph (Review Pool)',
        '"persistent" stops at the Analysis: G3\'s chrome composition has no Q and P4-C adds none; pushed pages (Activity, Settings) would also need it — "every screen" cannot be met without further authority']),
      cand('Q-C', DECISIONS.q.options.C.name, ['04'], [A, A, C, C, C, S, A, A, A, C, A, C, A], [
        `the same slot as Q-B, on Personal only (390 AR, S-B: ${E.qC390.gap} pt around the Q)`,
        'implies the Personal surface is "the branded one" and a Shared World is somehow less QANDEEL — while I-08A4 §2 makes QANDEEL the relationship underneath every Area',
        'Personal is the busiest chrome (Activity, the door, Replay, and S-A\'s gear): the Q lands where room is scarcest']),
    ],
    recommendation: { advisory: true, direction: 'Q-A', strength: 'strong', why: 'the evidence now supports the queue\'s weak recommendation: a chrome Q adds no information, costs the scarcest chrome room on Personal, collides at 320 pt with S-A, cannot reach the Analysis, and runs against the platform branding guidance C3 §8 itself cites.' },
    productOwnerJudgement: 'Whether the opener\'s Q (G3.2 composition) is one of the named identity moments; launch / gateway belong to DQ-06.',
    question: 'Is the canonical Q limited to named identity moments (Q-A), persistent in the shell chrome (Q-B), or persistent on Personal QANDEEL only (Q-C)? And under Q-A, does QANDEEL\'s opening turn count as an identity moment?' },
  { dq: 'P4-DQ-04A', title: DECISIONS.switcher.title, state: 'OPEN', boards: ['05-dq04-switcher-form', '07-integrated-ar-dark', '08-integrated-en-light'],
    candidates: [
      cand('SW-1', DECISIONS.switcher.options.plate.name, ['05'], [S, S, A, A, S, A, S, S, S, S, S, A, S], [
        'the reviewed incumbent (P2-A, P3-A): one plate from the composer down, SELECTED as a crown rule at the item\'s top edge + word weight',
        'the plate is continuous with the composer\'s plate, so the crown rule sits on an edge that is not visible: the switcher\'s top boundary is carried only by the composer\'s writing line',
        'no change to production risk: the proven form']),
      cand('SW-2', DECISIONS.switcher.options.ground.name, ['05'], [S, A, C, C, S, A, S, S, S, S, A, C, A], [
        'no plate: the switcher stands on the page ground under a hairline; SELECTED as a rule under the word',
        'the under-word rule is the grammar P3 Activity uses for its in-page filter chips — global navigation and a page filter would share one marker, blurring the level of the choice',
        'the composer plate now floats between the conversation and a plate-less switcher; in the Analysis the switcher sits on the world\'s ground']),
      cand('SW-3', DECISIONS.switcher.options.seam.name, ['05', '07', '08'], [S, S, S, A, S, A, S, S, S, S, S, S, A], [
        'the plate keeps the incumbent depth; a hairline seam states where the switcher begins, and the selected cell\'s seam thickens into the E1R marker — the marker is part of the machine\'s edge, not a floating rule',
        'Call Rail A already uses the seam as QANDEEL\'s machinery grammar (P2 §6): the switcher and the call rail read as one family of machines',
        'the widest, most legible SELECTED marker of the three at 320 pt and under Increased Contrast (boards 05, 10)',
        'honestly: SW-1 and SW-3 share the plate and a top-edge marker — two plate variants that differ in edge and marker geometry; SW-2 is the only plate-less form. SW-3 also stacks three horizontals within about 20 pt (the composer\'s writing line, the seam, the marker) (Review Pool)']),
    ],
    recommendation: { advisory: true, direction: 'SW-3', strength: 'moderate', why: 'SW-3 keeps the incumbent plate and depth, gives the switcher a stated edge, and carries SELECTED in the most legible E1R marker; SW-1 is a close, proven alternative. Both keep every frozen semantic.' },
    productDecisionVsCraft: { product: ['container form (plate / ground)', 'tab depth (flush on the page ground — SW-2 · a raised plate continuous with the composer — SW-1 · a seamed plate — SW-3)', 'relationship to the page ground (continuous with the composer, or seamed)', 'selected-indicator geometry (crown rule / under-word rule / seam segment)'], craft: ['the exact marker length and inset', 'the hairline weight and its ink step', 'the plate\'s exact height inside 56 pt', 'motion between destinations (T-10 / P2 §9)'] },
    productOwnerJudgement: 'Visual taste between the proven incumbent (SW-1) and the seamed plate (SW-3); SW-2 changes the switcher\'s relationship to the ground most.',
    question: 'Which physical form does the Global Switcher take: SW-1 plate with a crown rule, SW-2 plate-less with an under-word rule, or SW-3 plate with a keyed seam?' },
  { dq: 'P4-DQ-04B', title: DECISIONS.context.title, state: 'OPEN', boards: ['06-dq04-context-placement', '07-integrated-ar-dark', '09-compact-320-stress'],
    candidates: [
      cand('X-A', DECISIONS.context.options.end.name, ['06', '07', '08', '09'], [S, S, S, A, A, A, S, S, A, S, A, S, S], [
        `in the chrome row, grouped with Replay — both are acts on the current conversation; it never enters the world and overlaps no frozen control (C-X-2, C-X-3)`,
        `320 × 568 in a call while PINNED: ${X.endA320.gapBack} pt to «المحادثة», ${X.endA320.gapReplay} pt to Replay (AR); ${X.endE320.gapBack} / ${X.endE320.gapReplay} pt (EN, PROOF COPY)`,
        'English "In play now" is VI-01\'s candidate, marked PROOF COPY — NOT CANONICAL; the final English wording goes to P4-DQ-09',
        'the two 44 pt targets stand only 2 pt apart (no overlap); in the chrome\'s muted ink and without a glyph, it can read as a caption for Replay rather than an act (Review Pool)',
        'accessibility in the Analysis is not fully evidenced: the proof overlay sits outside G3.2\'s frame, so its place in G3.2\'s focus order cannot be shown; in production it belongs in the chrome row\'s own focus sequence']),
      cand('X-B', DECISIONS.context.options.centre.name, ['06'], [S, A, C, C, A, A, S, C, A, A, A, A, S], [
        `given its best case (the centre of the free span between «المحادثة» and Replay): 320 AR ${X.cenA320.gapBack} pt to «المحادثة»; 320 EN ${X.cenE320.gapBack} pt`,
        'alone at the centre of a chrome row it takes the position of a place title: the Analysis would appear to be named «سياق الكلام»',
        'in Arabic it stands in the same reading line as «المحادثة»; at 320 pt the two short phrases read as one run']),
      cand('X-C', DECISIONS.context.options.top.name, ['06', '09'], [worst && worst.belowFloor ? FA : A, S, A, C, S, A, S, C, C, worst && worst.belowFloor ? FA : A, C, C, A], [
        worst ? `measured world cost: in ${worst.page} the world is ${worst.world} pt and the control takes ${worst.overlayCost} pt of it, leaving ${worst.unobstructed} pt against the ${worst.floor} pt floor (T-11 §3; G3 T-11 / T-12 amendment §3 rule 1: no support region may take the world below its floor)` : 'world cost not measured',
        'it lies over the world, where I-08B1 draws its own labels (for example «جلسة 11» at the world\'s upper START edge in G3.2\'s PINNED camera): legibility and occlusion depend on the camera',
        'REJECTED BY AUTHORITY outright: the densest reviewed state (320 × 568, Live Call + PINNED) is a state the Product reaches, and there the placement takes the world below its floor — a placement is judged by its worst reachable state, even though at 390 pt it leaves ' + (wc.find((w) => w.page === 'an-top-p1-el') || { unobstructed: '—' }).unobstructed + ' pt; kept on the board because it is the placement G1.2 used (a key / value line in the world region)'], 'REJECTED BY AUTHORITY'),
    ],
    recommendation: { advisory: true, direction: 'X-A', strength: 'strong', why: 'X-A is the only studied placement that never touches the world, keeps clear of every frozen control at 320 pt in both languages, and groups «سياق الكلام» with the other act on the current conversation (Replay).' },
    copyAuthority: { arabic: '«سياق الكلام» — VI-01 Terminology Matrix S03 / A01, Arabic APPROVED', english: 'OPEN (VI-01 §7.2, S03). Proof renders "In play now" — VI-01\'s own candidate — as PROOF COPY — NOT CANONICAL; final wording → P4-DQ-09' },
    productOwnerJudgement: 'Placement only. The meaning of «سياق الكلام», the Live Context panel it opens and the English word are not decided here.',
    question: 'Where does «سياق الكلام» sit in the Analysis: in the upper chrome beside Replay (X-A), or centred in the upper chrome (X-B)? (X-C, the world\'s upper edge, is rejected by the measured floor.)' },
];

const integrated = Object.entries(DIRECTIONS).map(([k, d]) => ({ id: `Direction ${k}`, name: d.name, status: LABEL_INTEGRATED, combination: { s: d.s, u: d.u, q: d.q, sw: d.sw, x: d.x }, why: d.why,
  boards: ['07-integrated-ar-dark', '08-integrated-en-light', '09-compact-320-stress', '10-accessibility-rtl-focus'] }));
const out = {
  generated: 'tools/p4matrix.mjs', note: 'Qualitative evidence matrix. No numeric score exists or is implied. Every recommendation is advisory; every decision is OPEN.',
  scale: { STRONG: 'meets the dimension well, with evidence', ACCEPTABLE: 'meets it with a visible cost or caveat', CONCERN: 'a real weakness the Product Owner should weigh', 'FAILS AUTHORITY': 'contradicts frozen authority as drawn' },
  dimensions: DIMS, decisions, integrated,
  integratedAdvice: { advisory: true, stronger: 'conditional', why: 'Direction II combines the advisory recommendation of every decision (S-A, U-A, Q-A, SW-3, X-A), but its Personal chrome overflows at 320 pt in English with the current proof door label, so it stands only together with a fitting English label from P4-DQ-09. Direction I (S-B, SW-1) fits everywhere measured and is the Personal-centred alternative.' },
  measured: { overflow: Object.values(SH).filter((s) => s.measured.hdr && s.measured.hdr.scrollW > s.measured.hdr.clientW + 0.5).map((s) => ({ id: s.id, by: Math.round(s.measured.hdr.scrollW - s.measured.hdr.clientW) })), chrome: E, conversationHeight320: convH, contextGaps: X, worldCost: wc },
};
writeFileSync(join(PKG, 'data', 'DECISION_MATRIX.json'), JSON.stringify(out, null, 1) + '\n');

// ---- the human-readable study, generated from the same object so the two can never disagree
const md = [];
const abbr = { STRONG: 'STRONG', ACCEPTABLE: 'ACCEPTABLE', CONCERN: '**CONCERN**', 'FAILS AUTHORITY': '**FAILS AUTHORITY**' };
md.push('# P4-C — Decision Study', '', '**Status:** `EVIDENCE MATRIX — ADVISORY ONLY — P4-DQ-01 … P4-DQ-04 OPEN — NO CANDIDATE SELECTED`', '',
  'Generated by `source/tools/p4matrix.mjs` from [`data/DECISION_MATRIX.json`](../data/DECISION_MATRIX.json); every geometry figure below is read from',
  '[`data/SHOTS.json`](../data/SHOTS.json) and [`data/CHECKS.json`](../data/CHECKS.json). There is **no numeric score**: each cell is the proof author\'s',
  'qualitative assessment on the scale below, and each rests on the evidence listed under it.', '',
  '| Rating | Means |', '|---|---|', ...Object.entries(out.scale).map(([k, v]) => `| ${k} | ${v} |`), '');
for (const d of decisions) {
  md.push('---', '', `## ${d.dq} — ${d.title}`, '', `**State: ${d.state}.** Boards: ${d.boards.map((b) => `[\`${b}\`](../boards/${b}.png)`).join(', ')}.`, '');
  if (d.copyAuthority) md.push(`**Copy authority.** Arabic: ${d.copyAuthority.arabic}. English: ${d.copyAuthority.english}.`, '');
  md.push(`| Dimension | ${d.candidates.map((c) => `${c.id} ${c.name}`).join(' | ')} |`, `|---|${d.candidates.map(() => '---').join('|')}|`);
  for (const k of DIMS) md.push(`| ${k} | ${d.candidates.map((c) => abbr[c.dimensions[k]]).join(' | ')} |`);
  md.push(`| status | ${d.candidates.map((c) => '`' + c.status + '`').join(' | ')} |`, '');
  for (const c of d.candidates) md.push(`**${c.id} — evidence**`, '', ...c.evidence.map((e) => `- ${e}`), '');
  if (d.notEarned) md.push('**Considered, not earned as a third option**', '', ...d.notEarned.map((n) => `- ${n.name}: ${n.why}`), '');
  if (d.productDecisionVsCraft) md.push(`**Product decision:** ${d.productDecisionVsCraft.product.join('; ')}. **Craft / implementation tuning:** ${d.productDecisionVsCraft.craft.join('; ')}.`, '');
  md.push(`**Tradeoff and advisory recommendation — ${d.recommendation.direction} (${d.recommendation.strength}).** ${d.recommendation.why}`, '',
    `**Still the Product Owner's judgement.** ${d.productOwnerJudgement}`, '', `**The question.** ${d.question}`, '');
}
md.push('---', '', '## Integrated directions', '', `| Direction | Settings | Understanding | Q | Switcher | «سياق الكلام» | Status |`, '|---|---|---|---|---|---|---|',
  ...integrated.map((i) => `| ${i.name} | ${i.combination.s} | ${i.combination.u} | ${i.combination.q} | ${i.combination.sw} | ${i.combination.x} | \`${i.status}\` |`), '',
  `Advisory: ${out.integratedAdvice.why}`, '');
writeFileSync(join(PKG, 'docs', 'P4C_DECISION_STUDY.md'), md.join('\n'));
console.log('wrote data/DECISION_MATRIX.json', JSON.stringify(E.uBa320), JSON.stringify(worst));
