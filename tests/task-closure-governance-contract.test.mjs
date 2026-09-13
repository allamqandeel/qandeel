import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
