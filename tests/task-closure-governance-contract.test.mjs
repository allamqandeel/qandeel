import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// QAN-GOV-03 — the closure-governance gate.
//
// ## Why this exists
//
// Closing a task has two halves. BG-08 owns one of them: the canonical backlog must agree with
// reality before a task may be called CLOSED / FROZEN. Nothing owned the other half — the task's own
// document — and it drifted three times.
//
//   T-12 closed, and a qualifying residue it had named reached the register only later, as
//   `QAN-BL-AUTH-01`, admitted by a governance task after the fact.
//
//   T-13 closed without reconciling `QAN-BL-T13-01` at all. T-14 recorded that tombstone on its
//   predecessor's behalf.
//
//   T-13 and T-14 then both sat on `main` for months still advertising
//   `CANDIDATE — awaiting independent review`, while the register recorded them closed and merged.
//
// Every one of those was invisible to the repository: prose disagreeing with prose, which no gate
// reads. BG-09 states the missing rule and this contract enforces it, so the next omission fails a
// check instead of waiting for someone to notice.
//
// ## Why it derives its subjects instead of listing them
//
// The obvious shape — a table of closed tasks and their documents, kept in this file — is exactly the
// second lifecycle registry QAN-GOV-03 was forbidden to create, and it would be a ceiling besides:
// every future closed task would need a line here, and forgetting one would silently narrow the gate
// to nothing.
//
// So the canonical backlog stays the single authority. This contract reads which tasks it records as
// closed, binds each to the primary document that declares that task in its own title, and checks
// those. A future task closing correctly is covered the moment its tombstone lands, with no edit
// here. A future task legitimately still in review is not covered at all, because the register does
// not claim it is closed — which is the whole point.
//
// The floor at the bottom of `closedTaskIds` is what keeps that derivation honest: if the backlog is
// reformatted so the parse stops finding anything, this fails loudly rather than passing vacuously.
//
// ## QAN-CW-REM-03 / ASSURE-F07 — the same rule, for a phase
//
// Everything above derives its subjects from `T-`, and scans only top-level `docs/*.md`. The
// Connected Worlds phases are neither: they are `I-04` … `I-07`, they close through a
// `### <id> closure record` section of the same canonical backlog rather than through a
// `CLOSED — TOMBSTONE` index row, and one of them — `I-05` — has no standalone document at all,
// because its canonical record is the Public World half of `database/README.md`.
//
// So this gate could not see any of them. Four closed phases, and the rule that catches a stale
// banner governed none of them.
//
// The second half below closes that, on the same terms as the first. It is NOT a table of phases and
// filenames — that is the second lifecycle registry `QAN-GOV-03` was forbidden to build, and a future
// `I-08` would have to be added to it by hand or be silently ungoverned. Instead:
//
//   * the canonical backlog's own `### <id> closure record` heading says which phases are closed;
//   * a document declares which phase it is the primary record OF, in a machine-readable
//     `**Phase:**` banner it already carried;
//   * a phase the backlog records as closed must have such a record, and that record's banners must
//     state the closure and must not advertise a pre-closure state.
//
// `I-08` becomes governed the moment its closure record lands beside a document that says it is the
// `I-08` record. Nothing here is edited for that to happen, and an OPEN phase is governed by nothing,
// because the register makes no closure claim about it.
//
// Every derivation below is a pure function of text, so the genericity, the non-vacuity and the
// stale-banner detection are each proved against synthetic input rather than against whatever the
// repository happens to contain today.

const rootPath = fileURLToPath(new URL('../', import.meta.url));

/** Reads a repository file with line endings normalized. Windows checkouts are CRLF, CI is LF. */
function read(relative) {
  return readFileSync(join(rootPath, relative), 'utf8').replace(/\r\n/gu, '\n');
}

/**
 * Collapses every whitespace run to a single space, for matching PROSE.
 *
 * These documents are hard-wrapped, so a clause sits on one line today and across two after the next
 * edit reflows the paragraph. Matching the wrapped form would make this gate fail on a change that
 * altered no meaning — and, worse, would push a future editor toward preserving the line breaks
 * rather than the rule. Structure is still matched line by line against the raw text below.
 */
function prose(text) {
  return text.replace(/\s+/gu, ' ');
}

const BACKLOG = 'docs/qandeel-canonical-backlog-v1.md';
const backlog = read(BACKLOG);
const backlogProse = prose(backlog);
const agents = read('AGENTS.md');
const agentsProse = prose(agents);

/**
 * A lifecycle banner that says the task is NOT finished yet.
 *
 * Both observed spellings are `CANDIDATE — awaiting …`, but the defect is either word: a banner
 * still calling itself a candidate, or one still waiting on a review that has already happened.
 */
const PRE_CLOSURE = /\bCANDIDATE\b|\bawaiting\b/iu;

/**
 * A task identifier, matched so that `T-12P` and `T-03B2b2` are themselves and not `T-12` or `T-03`.
 *
 * This matters here rather than being pedantry: `T-12` is recorded closed and `T-12P` is not, and a
 * boundary that let one match the other would drag a document into this gate that the register makes
 * no closure claim about.
 */
const TASK_ID = /\bT-\d+[A-Za-z0-9]*\b/u;

/** `| `id` | title | `owner task` | `severity` | `status` |` — the §4 index row. */
const INDEX_ROW = /^\|\s*`([^`]+)`\s*\|[^|]*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/u;

/** Every task the canonical backlog records as having closed something. */
const closedTaskIds = new Set();
for (const line of backlog.split('\n')) {
  const row = INDEX_ROW.exec(line.trim());
  if (row === null) continue;
  const [, , ownerTask, , status] = row;
  if (status !== 'CLOSED — TOMBSTONE') continue;
  const id = TASK_ID.exec(ownerTask);
  // An owner that is not a `T-` task — `QAN-SEC-01` and the like — closes nothing through a task
  // document, so there is no banner for this gate to check.
  if (id !== null) closedTaskIds.add(id[0]);
}

/**
 * Primary task documents, and the task each declares in its own H1.
 *
 * Top level only, deliberately. `docs/design/**` is frozen phase material with its own unrelated
 * vocabulary — several of those documents say `FREEZE CANDIDATE` about a design, meaning something
 * entirely different from an unreviewed task — and sweeping them would produce confident nonsense.
 */
const primaryDocuments = [];
for (const file of readdirSync(join(rootPath, 'docs'))) {
  if (!file.endsWith('.md')) continue;
  const text = read(`docs/${file}`);
  const heading = /^#\s+(.+)$/mu.exec(text);
  if (heading === null) continue;
  const id = TASK_ID.exec(heading[1]);
  if (id === null) continue;
  const banner = /^\*\*Status:\*\*[^\n]*/mu.exec(text);
  primaryDocuments.push({ file, taskId: id[0], heading: heading[1], banner: banner?.[0] ?? null });
}

/** The documents this gate actually governs: a closed task's own primary document. */
const governed = primaryDocuments.filter((doc) => closedTaskIds.has(doc.taskId));

// ---------------------------------------------------------------------------------------------
// Connected Worlds phases (ASSURE-F07). Pure derivations first, so each one can be proved against
// synthetic text and cannot quietly stop matching anything.
// ---------------------------------------------------------------------------------------------

/**
 * A Connected Worlds PARENT PHASE identifier: `I-04`, `I-08`, and nothing else.
 *
 * The suffix is the whole point, and it runs the opposite way to `TASK_ID` above. There, `T-12` and
 * `T-12P` are two different things the register speaks about separately, so the grammar admits both
 * shapes and lets exact equality tell them apart. Here, `I-07` is a PHASE and `I-07A` … `I-07D` are
 * its implementation slices — not phases at all, and never things this register records a phase
 * closure for. ASSURE-F07 governs phase closure.
 *
 * A grammar that accepted the suffix would classify a future `### I-07D closure record` heading as a
 * closed phase and then demand a primary `**Phase:** I-07D` record that should never exist. No slice
 * closure heading is in the repository today, which is exactly why green CI could not have caught
 * that: the proofs below therefore run the parsers against synthetic text that contains one.
 *
 * `\b` after `\d+` does the work. In `I-42A` the digits cannot be followed by a word boundary at any
 * backtrack position, so the identifier does not match at all — rather than matching a truncated
 * `I-42`, which would be worse than not matching.
 */
const PHASE_ID = /\bI-\d+\b/u;
const PHASE_ID_ALL = /\bI-\d+\b/gu;

/** `**Status:**` and `**Phase:**` — the two lifecycle banners a canonical record may carry. */
const BANNER_LINE = /^\*\*(?:Status|Phase):\*\*/u;

/**
 * Every Connected Worlds phase the canonical backlog records a closure for.
 *
 * A phase closes through a `### <id> closure record` section, not through a `CLOSED — TOMBSTONE`
 * index row: a phase that inherited nothing tombstones nothing, which is exactly why the row-based
 * derivation above cannot see one. The heading is the register's own closure statement, and it is
 * the authority here for the same reason the index row is the authority there.
 */
function closedPhaseIdsIn(backlogText) {
  const closed = new Set();
  for (const raw of backlogText.split('\n')) {
    const heading = /^###\s+(\S+)\s+closure record\b/u.exec(raw.trim());
    if (heading === null) continue;
    const id = PHASE_ID.exec(heading[1]);
    // `### T-14 closure record` is a task, and the first half of this file governs it; `### I-07D
    // closure record` is a slice, and the grammar above declines it. The equality is what stops a
    // heading that merely CONTAINS a phase id — `### (I-42) closure record` — from being read as
    // that phase's closure statement.
    if (id !== null && id[0] === heading[1]) closed.add(id[0]);
  }
  return closed;
}

/**
 * The phases one document declares itself the primary canonical record OF, with the banner lines
 * that speak about each.
 *
 * A `**Phase:**` banner naming a phase id is the declaration; a `**Status:**` banner naming the same
 * id speaks about it too. `I-04` puts its lifecycle on `**Status:**` and `I-06` puts it on
 * `**Phase:**`, so both are read and neither shape is privileged.
 *
 * A slice reaches this twice and is refused twice, on purpose. A `**Slice:**` banner is not a
 * banner shape this reads at all, and a slice id is not an identifier `PHASE_ID_ALL` recognizes —
 * so `**Slice:** I-07D` declares nothing, and so would `**Phase:** I-07D` if anyone ever wrote it.
 */
function phaseRecordsIn(text) {
  const spoken = new Map();
  const declared = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!BANNER_LINE.test(line)) continue;
    const ids = line.match(PHASE_ID_ALL) ?? [];
    for (const id of ids) {
      if (line.startsWith('**Phase:**')) declared.add(id);
      if (!spoken.has(id)) spoken.set(id, []);
      spoken.get(id).push(line);
    }
  }
  return [...declared].map((phaseId) => ({ phaseId, banners: spoken.get(phaseId) }));
}

/** A banner that positively states the phase reached its final lifecycle state. */
const CLOSED_BANNER = /CLOSED \/ FROZEN/u;

/**
 * The canonical surfaces a phase record can live on.
 *
 * A shape rule, never a list of phases: top-level `docs/*.md`, the repository README, and the README
 * of any top-level directory. `I-05`'s record is `database/README.md` and is reached by the third of
 * those without being named; a future phase documented under `docs/` is reached by the first. A file
 * that carries no `**Phase:**` banner contributes nothing wherever it sits.
 */
function canonicalRecordPaths() {
  const paths = [];
  if (existsSync(join(rootPath, 'README.md'))) paths.push('README.md');
  for (const file of readdirSync(join(rootPath, 'docs'))) {
    if (file.endsWith('.md')) paths.push(`docs/${file}`);
  }
  for (const entry of readdirSync(rootPath)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    if (!statSync(join(rootPath, entry)).isDirectory()) continue;
    if (existsSync(join(rootPath, entry, 'README.md'))) paths.push(`${entry}/README.md`);
  }
  return paths;
}

const closedPhaseIds = closedPhaseIdsIn(backlog);
/** Every phase record in the repository, whatever the register says about it. */
const phaseRecords = canonicalRecordPaths()
  .flatMap((file) => phaseRecordsIn(read(file)).map((record) => ({ file, ...record })));
/** The ones this gate governs: a closed phase's own primary record. */
const governedPhases = phaseRecords.filter((record) => closedPhaseIds.has(record.phaseId));

test('the canonical backlog still names the tasks it records as closed', () => {
  // The non-vacuity floor. Every assertion below is derived from this parse, so a backlog whose
  // index this file can no longer read must fail here rather than quietly govern nothing.
  //
  // A FLOOR, never a ceiling: it says these two must be found, and says nothing whatever about how
  // many others there are or may later be.
  assert.ok(closedTaskIds.has('T-13'), `the backlog index no longer records T-13 as closed; found ${[...closedTaskIds].join(', ') || 'nothing'}`);
  assert.ok(closedTaskIds.has('T-14'), `the backlog index no longer records T-14 as closed; found ${[...closedTaskIds].join(', ') || 'nothing'}`);
  for (const taskId of ['T-13', 'T-14']) {
    assert.ok(governed.some((doc) => doc.taskId === taskId),
      `no primary document under docs/ declares ${taskId} in its title, so its banner is ungoverned`);
  }
});

// ---------------------------------------------------------------------------------------------
// G1 / G2 — a closed task's own document must not advertise a pre-closure state.
// ---------------------------------------------------------------------------------------------

test('no closed task advertises a pre-closure lifecycle banner (BG-09)', () => {
  const offenders = governed
    .filter((doc) => doc.banner !== null && PRE_CLOSURE.test(doc.banner))
    .map((doc) => `docs/${doc.file} (${doc.taskId}): ${doc.banner.trim()}`);
  assert.deepEqual(offenders, [],
    'the canonical backlog records these tasks as closed while their own primary documents still '
    + 'advertise a candidate or awaiting-review state. Closure-state metadata belongs to the closing '
    + 'change itself (BG-09); a successor task is not the place to repair it.');
});

test('T-13 and T-14 state their closure truthfully', () => {
  // Rejecting the stale banner is only half of "status truth". A banner deleted altogether, or
  // replaced with something that declines to say, would pass the check above while telling a reader
  // nothing — so the two documents this task repaired must positively carry their final state.
  for (const taskId of ['T-13', 'T-14']) {
    for (const doc of governed.filter((entry) => entry.taskId === taskId)) {
      assert.notEqual(doc.banner, null, `docs/${doc.file} lost its Status banner entirely`);
      assert.match(doc.banner, /CLOSED \/ FROZEN/u,
        `docs/${doc.file} must state that ${taskId} is CLOSED / FROZEN`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// G1P / G2P — the same rule, for a Connected Worlds phase (ASSURE-F07).
// ---------------------------------------------------------------------------------------------

test('the canonical backlog still names the Connected Worlds phases it records as closed', () => {
  // The non-vacuity FLOOR for the phase half. It names four phase IDS and no filenames: a parse
  // that stops reading the register must fail here rather than govern nothing, and nothing about
  // this says how many phases there are or may later be.
  for (const phaseId of ['I-04', 'I-05', 'I-06', 'I-07']) {
    assert.ok(closedPhaseIds.has(phaseId),
      `the backlog no longer records a ${phaseId} closure record; found ${[...closedPhaseIds].join(', ') || 'nothing'}`);
  }
  assert.ok(phaseRecords.length >= 4,
    `phase-record discovery found ${phaseRecords.length} canonical phase records, which cannot be right`);
});

test('every closed Connected Worlds phase has a governed primary record', () => {
  const ungoverned = [...closedPhaseIds]
    .filter((phaseId) => !governedPhases.some((record) => record.phaseId === phaseId))
    .sort();
  assert.deepEqual(ungoverned, [],
    'the canonical backlog records these phases as closed and no canonical document declares itself '
    + 'their primary record, so their lifecycle banner is governed by nothing. A phase record '
    + 'declares itself with a `**Phase:**` banner naming the phase; where a phase has no standalone '
    + 'document, that banner belongs on the canonical record it does have.');
});

test('no closed Connected Worlds phase advertises a pre-closure lifecycle banner (BG-09)', () => {
  const offenders = governedPhases
    .flatMap((record) => record.banners
      .filter((line) => PRE_CLOSURE.test(line))
      .map((line) => `${record.file} (${record.phaseId}): ${line}`));
  assert.deepEqual(offenders, [],
    'the canonical backlog records these phases as closed while their own canonical records still '
    + 'advertise a candidate or awaiting-review state. BG-09 applies to a phase exactly as it '
    + 'applies to a task.');
});

test('every closed Connected Worlds phase states its closure truthfully', () => {
  // Rejecting the stale banner is only half of status truth. A record that declines to say would
  // pass the check above while telling a reader nothing.
  const silent = governedPhases
    .filter((record) => !record.banners.some((line) => CLOSED_BANNER.test(line)))
    .map((record) => `${record.file} (${record.phaseId})`);
  assert.deepEqual(silent, [],
    'these canonical phase records must positively state that the phase is CLOSED / FROZEN');
});

test('I-05 is governed through the canonical record it actually has', () => {
  // The specific gap ASSURE-F07 named. I-05 has no `docs/I-05….md`, so a `docs/`-only sweep could
  // never reach it, and skipping it "because it has no document" is how it stayed ungoverned. This
  // asserts that the phase is governed — not WHERE from, which discovery decides.
  assert.ok(governedPhases.some((record) => record.phaseId === 'I-05'),
    'I-05 must be governed through whichever canonical record declares itself its primary record');
});

// ---------------------------------------------------------------------------------------------
// G5P — the phase derivations are generic, non-vacuous and actually detect the defect.
//
// Proved against synthetic text. A repository-shaped proof could only ever say "the four phases
// that exist today pass", which is what a hardcoded registry would also say.
// ---------------------------------------------------------------------------------------------

test('phase discovery is generic: a future phase needs no edit here', () => {
  const futureBacklog = ['## 8. Closure records', '', '### I-42 closure record (a phase nobody has written yet)',
    '', '**Inherited: none.**', ''].join('\n');
  assert.deepEqual([...closedPhaseIdsIn(futureBacklog)], ['I-42'],
    'a future phase closure record must be discovered by shape, not by being listed here');

  const futureRecord = ['# QANDEEL — Something v1', '', '**Phase:** `I-42 — Something` — **CLOSED / FROZEN**',
    '**Slice:** `I-42A — a slice` — **CLOSED / MERGED**', ''].join('\n');
  assert.deepEqual(phaseRecordsIn(futureRecord).map((r) => r.phaseId), ['I-42'],
    'the primary record declares the phase, and a slice banner is not the phase');
});

test('phase discovery reads both banner shapes the repository already uses', () => {
  const statusShape = ['# I-40 — A Phase v1', '', '**Status:** `I-40 — CLOSED / FROZEN`',
    '**Phase:** Connected Worlds v2 — `I-40`', ''].join('\n');
  const [statusRecord] = phaseRecordsIn(statusShape);
  assert.equal(statusRecord.phaseId, 'I-40');
  assert.ok(statusRecord.banners.some((line) => CLOSED_BANNER.test(line)),
    'a phase whose lifecycle sits on the Status banner is read');

  const phaseShape = ['# QANDEEL — A Phase v1', '', '**Phase:** `I-41 — A Phase` — **CLOSED / FROZEN**', ''].join('\n');
  const [phaseRecord] = phaseRecordsIn(phaseShape);
  assert.equal(phaseRecord.phaseId, 'I-41');
  assert.ok(phaseRecord.banners.some((line) => CLOSED_BANNER.test(line)),
    'a phase whose lifecycle sits on the Phase banner is read too');
});

test('a stale closed-phase banner is detected', () => {
  // The mutation the gate exists for: the register says closed, the record says candidate.
  const closed = closedPhaseIdsIn('### I-43 closure record (a closed phase)');
  const stale = phaseRecordsIn('**Phase:** `I-43 — A Phase` — **CANDIDATE — awaiting independent review**');
  const governedStale = stale.filter((record) => closed.has(record.phaseId));
  assert.equal(governedStale.length, 1, 'the stale record is governed');
  assert.ok(governedStale[0].banners.some((line) => PRE_CLOSURE.test(line)),
    'a closed phase still advertising a candidate banner must be caught');
  assert.ok(!governedStale[0].banners.some((line) => CLOSED_BANNER.test(line)),
    'and it must not be able to pass the positive half either');
});

test('an open phase is not falsely forced closed', () => {
  // `I-08` is real, unstarted, and must be governed by nothing: the register makes no closure claim
  // about it, so neither does this gate.
  const closed = closedPhaseIdsIn('### I-44 closure record (a closed phase)');
  const open = phaseRecordsIn('**Phase:** `I-45 — an open phase` — **IN PROGRESS**');
  assert.deepEqual(open.filter((record) => closed.has(record.phaseId)), [],
    'a phase the register does not record as closed is governed by nothing');
  assert.ok(!closedPhaseIds.has('I-08'),
    'I-08 has not closed, so nothing here may require it to say that it has');
});

// ---------------------------------------------------------------------------------------------
// G-SCOPE — a slice is not a phase (REM03-GOV-01).
//
// The grammar recognizes parent phases only. The repository contains no slice closure heading
// today, so every proof below is against synthetic text: a gate whose scope is only ever exercised
// by the four ids that happen to exist has not been shown to have a scope at all.
// ---------------------------------------------------------------------------------------------

test('G-SCOPE-01 a parent phase closure heading is discovered', () => {
  assert.deepEqual([...closedPhaseIdsIn('### I-42 closure record (a phase nobody has written yet)')],
    ['I-42'], 'a parent phase closes through this heading and must be discovered by shape');
});

test('G-SCOPE-02 a SLICE closure heading discovers no phase', () => {
  // The defect itself. A slice tombstone must not make the gate demand a `**Phase:** I-42A`
  // record — there is no such thing, and the register never claimed a phase closed.
  assert.deepEqual([...closedPhaseIdsIn('### I-42A closure record (a slice, not a phase)')], [],
    'a slice closure heading is not a phase closure record');
  for (const slice of ['I-07A', 'I-07B', 'I-07C', 'I-07D', 'I-04G', 'I-05C', 'I-06B']) {
    assert.deepEqual([...closedPhaseIdsIn(`### ${slice} closure record`)], [],
      `${slice} is an implementation slice and must never be discovered as a phase`);
  }
});

test('G-SCOPE-03 a phase banner declares the parent phase', () => {
  const record = ['# QANDEEL — Something v1', '',
    '**Phase:** `I-42 — Something` — **CLOSED / FROZEN**', ''].join('\n');
  assert.deepEqual(phaseRecordsIn(record).map((r) => r.phaseId), ['I-42']);
});

test('G-SCOPE-04 a slice banner declares no phase', () => {
  assert.deepEqual(phaseRecordsIn('**Slice:** `I-42A — a slice` — **CLOSED / MERGED**'), [],
    'a slice banner is not a phase declaration');
  // And neither would a `**Phase:**` banner that named a slice id, which is the half the banner
  // shape alone never covered.
  assert.deepEqual(phaseRecordsIn('**Phase:** `I-42A — a slice` — **CLOSED / FROZEN**'), [],
    'a slice id on a phase banner still declares no phase');
});

test('G-SCOPE-05 a phase line mentioning a slice in prose declares only the phase', () => {
  // A `**Phase:**` banner is a line of prose as well as a declaration, and prose names slices.
  // Every id on such a line is a declaration candidate, so this is where a suffix-accepting
  // grammar manufactures a phase that does not exist — on the one line shape it reads hardest.
  assert.deepEqual(
    phaseRecordsIn('**Phase:** `I-42 — Something` — **CLOSED / FROZEN** (closed by slice I-42D)')
      .map((r) => r.phaseId), ['I-42'],
    'the parent phase is declared and the slice named beside it is not');

  // And the whole document shape `I-07` actually has: the phase banner, its slice banners, a
  // status line that mentions both, and prose. Exactly one phase comes out of it.
  const document = ['# QANDEEL — Matching / Introductions Runtime v1', '',
    '**Phase:** `I-42 — Introductions / Matching Runtime` — **CLOSED / FROZEN**',
    '**Slice:** `I-42A — Foundation v1` — **CLOSED / MERGED**',
    '**Slice:** `I-42B — Eligibility v1` — **CLOSED / MERGED**',
    '**Status:** `I-42 — CLOSED / FROZEN` (slices I-42A and I-42B merged)',
    '', 'I-42 closed once I-42D landed.', ''].join('\n');
  const records = phaseRecordsIn(document);
  assert.deepEqual(records.map((r) => r.phaseId), ['I-42'],
    'one parent phase, and no slice invented from a line that mentions several');
  assert.ok(records[0].banners.some((line) => CLOSED_BANNER.test(line)),
    'and the banners that speak about it are still read');
  assert.ok(!records[0].banners.some((line) => line.startsWith('**Slice:**')),
    'while a slice banner is not one of them');
});

test('G-SCOPE-06 the four phases that exist today are still governed', () => {
  // Narrowing the grammar must not narrow the gate. Every current phase is discovered, has a
  // record, and that record still states its closure.
  for (const phaseId of ['I-04', 'I-05', 'I-06', 'I-07']) {
    assert.ok(closedPhaseIds.has(phaseId), `${phaseId} is still discovered as closed`);
    const records = governedPhases.filter((record) => record.phaseId === phaseId);
    assert.ok(records.length > 0, `${phaseId} still has a governed primary record`);
    assert.ok(records.some((record) => record.banners.some((line) => CLOSED_BANNER.test(line))),
      `${phaseId} still states CLOSED / FROZEN on a banner this gate reads`);
  }
  // And a future parent phase is still discovered with no edit here, which is the property the
  // narrowing could plausibly have cost.
  assert.deepEqual([...closedPhaseIdsIn('### I-08 closure record\n### I-09 closure record')].sort(),
    ['I-08', 'I-09'], 'future parent phases are discovered generically');
});

test('phase discovery cannot become vacuous', () => {
  // Each derivation must return NOTHING for text that does not carry the real shape, and the floor
  // above must therefore fail if either parser is loosened into matching everything or tightened
  // into matching nothing.
  assert.equal(closedPhaseIdsIn('### I-46 closure notes\n### closure record\nI-46 closure record').size, 0,
    'only the canonical heading shape is a closure record');
  assert.equal(closedPhaseIdsIn('### T-99 closure record').size, 0,
    'a task closure record is not a phase closure record');
  assert.equal(phaseRecordsIn('**Slice:** `I-47 — a slice` — **CLOSED / FROZEN**\nI-47 is closed.').length, 0,
    'prose and a slice banner do not make a document a primary phase record');
  assert.equal(phaseRecordsIn('**Phase:** VII — QANDEEL Connected Worlds').length, 0,
    'a phase banner that names no Connected Worlds phase id declares nothing');
});

// ---------------------------------------------------------------------------------------------
// G3 — BG-08 remains the one closure-reconciliation authority, unweakened.
// ---------------------------------------------------------------------------------------------

test('BG-08 remains the canonical closure-reconciliation authority', () => {
  assert.match(backlog, /\*\*BG-08 — Closure reconciliation \/ backlog admission\.\*\*/u,
    'BG-08 is the existing closure-reconciliation authority and may not be removed or renamed');

  // Each clause below is load-bearing, and each is a distinct way the rule could be hollowed out
  // while the heading survived: dropping the ordering, dropping a disposition, or dropping the
  // sentence that stops a qualifying item from living in a report instead of the register.
  for (const [clause, what] of [
    [/Before an ACTIVE task may be declared CLOSED \/ FROZEN/u, 'that it applies before closure is declared'],
    [/reconciles that task's cross-task residue against this backlog/u, 'reconciliation against this backlog'],
    [/\*before\* closure/u, 'that admission happens BEFORE closure, not after'],
    [/completed → `CLOSED — TOMBSTONE`, re-owned to one named task, or still deferred/u,
      'the three permitted dispositions of an inherited item'],
    [/may not exist only in a review comment, a final report, a task-local note or a model's memory/u,
      'the rule that a qualifying item must reach this register'],
  ]) {
    assert.match(backlogProse, clause, `BG-08 no longer requires ${what}`);
  }

  // The closure checklist is how BG-08 is actually performed, so it has to keep pointing at it.
  assert.match(backlog, /## 9\. Task lifecycle checklist \(BG-05 at kickoff, BG-08 at closure\)/u,
    'the task lifecycle checklist is the operative form of BG-05 and BG-08');
});

// ---------------------------------------------------------------------------------------------
// G4 — the complementary closure-state synchronization rule exists.
// ---------------------------------------------------------------------------------------------

test('BG-09 states the closure-state synchronization invariant (complementing BG-08)', () => {
  assert.match(backlog, /\*\*BG-09 — Same-task closure-state synchronization\.\*\*/u,
    'BG-09 is the rule whose absence let T-13 and T-14 sit closed behind candidate banners');

  for (const [clause, what] of [
    [/may not be treated as CLOSED \/ FROZEN while its primary canonical task document still advertises a pre-closure lifecycle state/u,
      'that a closed task may not advertise a pre-closure state'],
    [/CANDIDATE — awaiting independent review/u, 'the concrete banner this rule exists to prevent'],
    [/must not be relied upon to finish a predecessor's closure record/u,
      'that a successor task is not responsible for a predecessor\'s closure record'],
    [/governance-reconciliation task that records the correction without reopening Product semantics/u,
      'that a post-hoc repair is an explicit governance task, not a silent rewrite'],
  ]) {
    assert.match(backlogProse, clause, `BG-09 no longer states ${what}`);
  }

  // BG-09 complements BG-08; a BG-09 that replaced it, or that stood up a parallel register, would be
  // the duplicate authority QAN-GOV-03 was explicitly forbidden to build.
  assert.match(backlogProse, /adds no second register, no second lifecycle model and no new Product state/u,
    'BG-09 must remain complementary to BG-08 rather than a competing backlog or task registry');
  assert.match(backlogProse, /updates that task's own primary canonical document from its candidate\/review banner/u,
    'the closure checklist must carry the BG-09 step, or the rule is never performed');
});

test('the historical record of the missed reconciliations is preserved', () => {
  // The failure mode this guards is tidying: a later editor smoothing the register until every task
  // reads as though it closed cleanly. The misses are the evidence BG-09 exists for, and a rule
  // whose justification has been deleted is the next rule to be deleted.
  for (const [clause, what] of [
    [/T-13 closed without reconciling its own inherited item/u, 'that T-13 closed without reconciling QAN-BL-T13-01'],
    [/This tombstone was recorded by `T-14 — Mobile Product Sign-In Gateway v1` under BG-08/u,
      'that T-14 recorded the T-13 tombstone on its behalf'],
    [/\*\*Late BG-08 reconciliation\.\*\*/u, 'the late QAN-BL-AUTH-01 reconciliation after T-12 closure'],
  ]) {
    assert.match(backlogProse, clause, `the backlog no longer records ${what}`);
  }
});

// ---------------------------------------------------------------------------------------------
// G5 — the guardrail a future implementation agent actually reads.
// ---------------------------------------------------------------------------------------------

test('AGENTS.md points closure work back at the canonical backlog', () => {
  assert.match(agents, /## 10\. Task closure discipline/u,
    'AGENTS.md must carry the closure rule where an implementation agent will meet it');
  for (const [clause, what] of [
    [/docs\/qandeel-canonical-backlog-v1\.md/u, 'the canonical backlog it must read'],
    [/BG-08/u, 'the backlog reconciliation authority'],
    [/BG-09/u, 'the closure-state synchronization rule'],
    [/Silence is not a disposition/u, 'that an unmentioned inherited item is not reconciled'],
    [/Leave no successor task responsible/u, 'that a successor must not inherit a closure record'],
    [/npm run test:task-closure-governance-contract/u, 'the gate that checks the result'],
    // ASSURE-F07: the same discipline, said where a phase-closing agent will meet it.
    [/A Connected Worlds phase \(`I-0N`\) closes on exactly these terms/u,
      'that a Connected Worlds phase closes on the same terms as a task'],
    [/`\*\*Phase:\*\*` banner that must reach `CLOSED \/ FROZEN` in the same change/u,
      'the phase banner the closing change must move'],
    [/A phase with no standalone document still has one/u,
      'that a phase without its own document is still governed'],
    // REM03-GOV-01: the rule an agent needs before writing a closure heading.
    [/A SLICE is not a phase/u, 'that a slice does not close as a phase'],
  ]) {
    assert.match(agentsProse, clause, `the AGENTS.md closure rule no longer names ${what}`);
  }
});

test('this gate is registered and runs in CI', () => {
  const rootPackage = JSON.parse(read('package.json'));
  assert.equal(rootPackage.scripts['test:task-closure-governance-contract'],
    'node --test tests/task-closure-governance-contract.test.mjs');
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run test:task-closure-governance-contract/u,
    'an unregistered governance gate is a file nobody runs');
});
