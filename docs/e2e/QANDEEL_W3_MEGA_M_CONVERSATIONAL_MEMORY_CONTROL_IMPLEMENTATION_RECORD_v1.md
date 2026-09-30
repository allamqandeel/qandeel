# QANDEEL — W3-MEGA-M Conversational Memory Control & Trust — Implementation Record v1

**Task:** W3-MEGA-M — Conversational Memory Control & Trust (E2E-01 wave W3)
**Row:** `E2E-D-13` — ask what QANDEEL remembers; correct it; ask it to forget
**Baseline:** `12282a29180a564f165a5a310a50b8fe1e476a27` (merge of PR #292, the current E2E execution map after W3-MEGA-U)
**Branch:** `feat/w3-mega-m-conversational-memory-control` — one PR, #293
**Status:** **MERGED / CLOSED** — merged through PR #293 at `3c0ea458a22a17a2a50c616b708f097f5911fb34`. `E2E-D-13` is
closed. This was one Product-Owner-authorized Production Integration task; it opened no other wave or Product area and
does not close W3. (Before the merge this banner read "IMPLEMENTED — NOT CLOSED"; §11 below records that state as it
was written.)

---

## 1. Truth and Anti-Duplication (M0)

`origin/main` was exactly `12282a2`, the merge commit of PR #292; the tree was clean; the branch was cut from it.

**BG-05.** The canonical backlog was read. No item names W3-MEGA-M or `E2E-D-13` as its Owner task, so the task
inherits none. `QAN-BL-CTX-01` (conversational relevance) is adjacent and untouched: "what do you remember" orders by
recency of change only and claims no relevance signal.

| Layer | Already frozen / existing — consumed, not rebuilt | Genuinely missing — built here |
|---|---|---|
| Product | P1 §9: no Memory editor; ask in Conversation; supersession, `DISABLED` / `DELETED`, explicit remember, user scope; Memory ≠ QANDEEL Understanding | nothing — no Product decision was needed |
| Runtime | `memories` (0004) with the full lifecycle vocabulary; server-only create / supersede / mark-deleted (0026); owner-token reads; the explicit-remember cue and typed grammar of the write evaluator; the durable-effect precedent (0024) | a `DISABLED` authority (the vocabulary had it, no command reached it); a conversational command boundary; owner-scoped target resolution; clarification; a durable, lost-response-safe command effect |
| Production | the W1A turn route `POST /conversation/sessions/:sessionId/turns`, idempotency key, replay and history reconciliation, claim / finalize lifecycle, `finalize_conversation_turn_v2` (0063), the Safety gate's deterministic-reply precedent | the seam that answers an explicit Memory request on that route |

Nothing in the Conversation surface, the mobile client or the Understanding / Hypothesis / Confidence runtimes needed to
change.

## 2. What the reader can now do (Product language)

In the same Conversation, in Arabic or English:

- **Ask what QANDEEL remembers** — «إنت فاكر عني إيه؟» / "What do you remember about me?" — and get the remembered
  words themselves, newest first (up to eight), plus a separate short list of what QANDEEL still keeps but no longer
  relies on at the reader's request. Nothing remembered → «لسه مش فاكر عنك حاجة محددة.». If Memory cannot be read, the
  turn fails like any failed reply; it never answers "nothing".
- **Ask it to remember** — «افتكر إن أحمد عنده امتحان الخميس.» — a real canonical Memory is created (once, however
  often the request is retried). A secret (password, code, ID number) is refused, in Arabic too.
- **Correct a remembered fact** — «أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.» — the October Memory is superseded by
  its next version; nothing is overwritten and history is kept.
- **Forget** — «انسى إني بحب كافيه النيل.» — that Memory is marked `DELETED`; the row and its history remain.
- **Keep it but stop relying on it** — «متعتمدش على إني بحب الشاي بالنعناع» — that Memory is `DISABLED`: kept, out of
  every retrieval and Evidence path, and listed separately when the reader asks what QANDEEL remembers.
- **Be asked, not guessed** — nothing changes on a partial match, on words that only say "I like", or on words not tied to
  Memory; «امسح موضوع الشغل.» with two matching Memories → «تقصد أنهي واحدة؟» with the two remembered
  sentences numbered; nothing changes until the reader answers («2», «التانية», "the first one", «أيوه» for a single
  option, «لا» to change nothing). A pointer such as «متنساش المعلومة، بس متعتمدش عليها معايا.» is resolved against the
  reader's previous words but is always confirmed before anything changes.

Replies never show an id, a status, a score or implementation vocabulary, and never claim a change the database did not
commit.

## 3. Architecture

### 3.1 The one boundary on the turn path (M1, M4)

`ConversationOrchestratorService`, after the Safety gate and its `BLOCK` short-circuit, and only for an **`ALLOW`** turn
(a `GUIDED` turn keeps its Safety guidance on the ordinary provider path), calls `MemoryControlService.plan(...)` once.
`null` means "not a Memory request" and the turn continues exactly as before. A plan is committed by
`ConversationRepository.finalizeMemoryControlTurn(...)` and the turn ends. The branch launches no Human Intelligence,
Memory retrieval, Hypothesis, Question or provider work; the orchestrator still has exactly one `router.generate`.

`apps/api/src/memory/`:

| File | Role |
|---|---|
| `memory-control.interpreter.ts` | pure, CPU-only interpretation of explicit Memory requests (AR + EN) and of a short reply to a clarification |
| `memory-control.resolution.ts` | pure owner-scoped target resolution |
| `memory-control.service.ts` | turns an intent into a fully decided plan from owner-token reads |
| `memory-control.repository.ts` | the three owner-token reads (candidate rows, rows by id, pending clarification) |
| `memory-control.copy.ts` | the deterministic replies (TASK-APPROVED DELEGATED COPY, §6) |
| `memory-control.types.ts` | the bounded vocabulary, mirroring migration 0128 |

**Interpretation** is deterministic. It recognises only requests addressed to QANDEEL about its Memory and leaves lookalike
idioms alone: a bare «انسى» / «انساها» / "forget it" is "never mind"; «افتكر تجيب العيش» and «متنساش تكلمني» are reminders
(Arabic remember needs «إن / إني»); "remember to…" and "Remember what I told you…?" are not commands; "don't rely on me"
/ «متعتمدش عليا» is about the user; a cue inside reported speech is not a cue. A correction is only a command when its old
words name something remembered; otherwise it is an ordinary statement.

**No provider is involved.** The provider never sees the candidate set and can never name a target; there is no
model-assisted interpretation to fail or be malformed.

### 3.2 Target resolution — no guessed mutation (M1, M5)

Candidates are the reader's own `ACTIVE` (unexpired) and `DISABLED` rows, read with the caller's token under RLS and an
explicit owner filter, bounded to 64, newest change first. Per command: correct → current rows only; forget →
current + `DISABLED`; disable → current + `DISABLED` (an already disabled row converges).

- **Full match only.** The reader's distinctive words (pronouns, particles and "the topic / the information" removed;
  light Arabic prefix / suffix stemming) must **all** appear in **exactly one** candidate. Several full matches →
  "which one?" with at most three remembered sentences. A partial match is never acted on.
- **A predicate is not a name.** Words that only say "like / have / want" («بحب», «ساكن», «بشتغل», "like", "prefer") never
  resolve a Memory by themselves, and a partial match must share at least one word that is not such a predicate — so
  «انسى إني بحب المكان ده» can never forget «أنا بحب الكشري».
- **Anchored or not.** A forget / do-not-rely request is *anchored* to Memory when it names Memory or phrases its target
  as a proposition («إن / إني …», "that …", «ذاكرتك», «متفتكرش», «متنساش», «معايا», "anymore", "the fact that", or a
  pronoun pointing at the reader's own preceding clause: "I like tea, but don't rely on it"). Anchored: a unique full
  match is applied, a partial one or none is asked about / answered "nothing like that". **Unanchored**
  («امسح موضوع الشغل», "forget the work stuff"): only full matches count — one match is *confirmed* first («تقصد «…»؟»),
  several are asked about, anything less is ordinary conversation ("forget about work, let's talk movies", «امسح رقم
  أحمد», «امسح الصورة»). An unanchored do-not-rely ("stop relying on coffee", «متعتمدش على حد») is ordinary conversation.
- **A correction restates its predicate.** «ساكن في أكتوبر» → «ساكن في طنطا», "live in …" → "live in …", or "I'm X" → "I'm Y".
  The shared words are set aside so the old value («أكتوبر») names the target. "I don't like my job, but I need the money"
  restates nothing and is ordinary conversation. Partial matches never become corrections.
- **Pointers are confirmed.** "That information" is resolved against the previous user turn's words and always asked
  about first, even with one match.
- **Answers are read only right after the question.** A number / ordinal picks that option (out of range → asked again);
  a verb that repeats the request is fine («انسى التانية», "forget the second one"); pointing («هي دي», "that one") is a
  yes, asked again when there are several options; a no changes nothing; a question is never an answer; words must match
  exactly one offered option. A question asked again keeps the original request's words and language.
### 3.3 The missing primitive and the atomic command (M2, M3) — migration 0128

- **`server_disable_memory_v1(user, memory)`** — owner-bound, row-locked, `service_role` only, status-only
  (`ACTIVE` → `DISABLED`, `updated_at`), convergent on an already disabled row, nothing for anything else. No generic
  status updater exists; no role regained direct Memory write.
- **`memory_control_commands`** — one immutable owner-only record per command, `UNIQUE (source_turn_id)`; ids and a
  bounded outcome only (no content); one `CHECK` gives each outcome its one lawful shape.
- **`server_finalize_memory_control_turn_v1(...)`** — `service_role` only. In ONE transaction: lock the canonical
  `GENERATING` user turn (otherwise no row and no write) → verify every target / option is the owner's and an answer binds
  to the immediately preceding clarification and one of its options → apply the change through the existing narrow
  commands (create / supersede / mark-deleted / disable), with source forced to `USER_STATED` and status to `ACTIVE` →
  record the command → finalize through `finalize_conversation_turn_v2` with the reply for the outcome **actually
  committed**. A target that no longer qualifies under its row lock commits `TARGET_CHANGED` with the "changed" reply and
  changes nothing; `TARGET_CHANGED` cannot be requested.
- **`pending_memory_clarification_v1(session, source_turn)`** — SECURITY INVOKER, `authenticated`: the reader's own
  unanswered clarification of the immediately preceding user turn.

### 3.4 Ordering relative to the reply (task §8.5)

| Question | Answer |
|---|---|
| When is intent / target established? | After Safety `ALLOW`, before any other lane: deterministic interpretation, then owner-token reads and resolution. Nothing is written. |
| When does the change commit? | Inside the one atomic command, under the source turn's and the target's row locks, in the same transaction as the command record and the canonical finalization. |
| How is the result recovered? | It IS the committed assistant turn (and the owner-readable command record) of that user turn. A retry under the same idempotency key finds the turn `COMPLETED` and returns the stored reply through the existing W1A replay; nothing runs again. |
| How is the reply formed? | Deterministically, from the outcome the database commits (`reply` / `replyIfChanged`); never from an assumption. |
| Provider fails after a change? | Not reachable: a Memory-command turn calls no provider. |
| Response lost after a change? | The change and its reply committed together; the same-key retry returns that reply. A new message saying the same thing converges: already remembered / already corrected / nothing like that left to forget. |
| Change without a reply, or a reply without the change? | Impossible: one transaction. A turn that stopped being `GENERATING` (recovered, cancelled) writes nothing. |

The background `MEMORY_WRITE` ledger (0022 / 0024) was deliberately **not** reused: it records inference over a completed
turn, not an explicit human command. The 0024 pattern — a durable, bounded, owner-verified effect result bound to its
source — is reused in the command record, and made stronger by committing with the reply.

### 3.5 Background inference never re-applies a command

`BackgroundIntelligenceEnrichmentService.evaluateAndWriteMemory` (and the legacy `MemoryWriteService`) skip an explicit
Memory command with `MEMORY_CONTROL_COMMAND` after the existing screens: "I like tea, but don't rely on it" would
otherwise have been written as a new Memory while the command disabled the old one (proven in the enrichment spec). An
explicit Memory command is also never a Hypothesis-generation trigger, so "forget that I …" cannot seed a new Hypothesis
about the fact just withdrawn.

## 4. Security and privacy

- Owner scope everywhere: every read is the caller's token under RLS plus an explicit owner filter; every write is the
  service-role atomic command, which re-verifies the owner of the turn, the target and each option. Composite FKs bind
  target and result to the owner. No client supplies a Memory id with authority: ids come only from canonical reads and
  are re-checked under lock.
- No new client grant: `authenticated` may SELECT its own command records and execute the clarification read; the two
  commands are `service_role` only; `PUBLIC` / `anon` have nothing.
- Replies quote only the reader's own remembered words; no id, status, score or implementation vocabulary (proven on the
  route). Memory-control modules log nothing; telemetry records only the existing content-free turn outcome.
- **Pre-existing Product defect found and fixed (Safety):** the shared secret screen wrapped its Arabic alternatives in
  `\b…\b`, and JavaScript's `\b` is ASCII-only, so «كلمة السر», «باسورد», «كود التحقق», «الرقم القومي» could never match
  and Arabic secrets passed the screen — including on the background write path. The screen now uses Unicode-aware
  boundaries (English behaviour unchanged), accepts the Arabic clitics و / ب / ل / ف / ال on the keyword, and also screens
  PIN / CVV, card, account, IBAN and passport numbers and identity-number keywords; an explicit statement is at most 280
  characters.
- No human-review path, no Memory screen, no Settings destination, no service-role credential on the client.

## 5. Command matrix

| Command | Example | Committed outcome(s) | Memory effect |
|---|---|---|---|
| Inspect | «إنت فاكر عني إيه؟» / "What do you remember about me?" | `INSPECTED`, `NOTHING_REMEMBERED` | none |
| Remember | «افتكر إن أحمد عنده امتحان الخميس.» | `REMEMBERED`, `ALREADY_REMEMBERED`, `DECLINED_SENSITIVE` | one new `ACTIVE` `USER_STATED` row |
| Correct | «أنا مش ساكن في أكتوبر دلوقتي، أنا ساكن في طنطا.» | `CORRECTED`, `ALREADY_CORRECT`, `CLARIFICATION_REQUIRED`, `TARGET_CHANGED`, `DECLINED_SENSITIVE` | predecessor `SUPERSEDED`, successor version + 1 |
| Forget | «انسى إني بحب كافيه النيل.» | `FORGOTTEN`, `TARGET_NOT_FOUND`, `TARGET_NOT_SPECIFIED`, `CLARIFICATION_REQUIRED`, `TARGET_CHANGED` | `DELETED` (row kept) |
| Do not rely | «متعتمدش على إني بحب الشاي بالنعناع» | `DISABLED`, same others | `DISABLED` (row kept) |
| Ambiguous | «امسح موضوع الشغل.» (two matches) | `CLARIFICATION_REQUIRED`, then the answer's outcome or `CLARIFICATION_DECLINED` | none until answered |

## 6. Copy (TASK-APPROVED DELEGATED COPY — W3-MEGA-M §10)

Server-side, typed per outcome and language beside the Safety gate's precedent (`memory-control.copy.ts`). Egyptian
conversational Arabic, verb-led, no gendered imperative toward the reader, failures framed as the process's («اتغيّرت»).

| Outcome | Arabic | English |
|---|---|---|
| inspect | ده اللي فاكره من كلامنا: / • «…» | Here's what I remember from our conversations: / • “…” |
| older | وفيه حاجات أقدم كمان. | There are a few older things too. |
| kept, not relied on | وفيه حاجات لسه فاكرها، بس مش بعتمد عليها بناءً على طلبك: | And some things I still remember but don't rely on, as you asked: |
| nothing | لسه مش فاكر عنك حاجة محددة. | I don't have anything specific remembered about you yet. |
| remembered | تمام، هفتكر ده: «…» | Got it, I'll remember: “…” |
| already | فاكر ده أصلًا: «…» | I already remember that: “…” |
| sensitive | دي معلومة حساسة، زي كلمة سر أو كود أو رقم هوية، ومش بحتفظ بالحاجات دي. | That looks sensitive, like a password, a code or an ID number, so I don't keep it. |
| corrected | تمام، صحّحتها. بقيت فاكر «جديد» بدل «قديم». | Got it, I've corrected it. I now remember “new” instead of “old”. |
| already correct | فاكرها كده أصلًا: «…» | I already have it that way: “…” |
| forgotten | تمام، نسيت «…» ومش هرجع له تاني. | Done, I've forgotten “…” and won't bring it up again. |
| disabled | تمام، مش هعتمد على «…» في كلامنا، بس هفضل فاكرها. | Done, I won't rely on “…” when we talk, but I'll keep it. |
| which one | تقصد أنهي واحدة؟ / 1. «…» / رقمها يكفي. | Which one do you mean? / 1. “…” / The number is enough. |
| one option | تقصد «…»؟ | Do you mean “…”? |
| one at a time | خلّينا ناخدهم واحدة واحدة. تقصد أنهي واحدة الأول؟ | Let's take them one at a time. Which one first? |
| not found | مش لاقي حاجة زي كده في اللي فاكره. | I don't have anything like that in what I remember. |
| not specified | تقصد أنهي معلومة بالظبط؟ | Which piece of information do you mean exactly? |
| changed | المعلومة دي اتغيّرت قبل ما أعدّلها، فماغيّرتش حاجة. | That changed before I could update it, so I didn't change anything. |
| declined | تمام، ماغيّرتش حاجة. | OK, I haven't changed anything. |

## 7. Validation

Local (this host; the API bootstrap spec and real PostgreSQL cannot run here — see §8):

| Evidence | Result |
|---|---|
| `tsc -p apps/api` and `tsc -p apps/api/tsconfig.scripts.json` | clean |
| New API Jest: interpreter, resolution, **production-route** spec | 93 / 93 |
| Production route (`conversation-memory-control.route.spec.ts`): the REAL `ConversationService` → orchestrator → Context Builder → Safety gate → Memory-control boundary → Conversation / Memory-control repositories, over an in-memory store that applies RLS by token and mirrors the SQL commands; every non-Memory lane is a proxy that records any touch. Arabic M-01…M-06 and English; lost answer after commit + same-key retry (one Memory, one record, one assistant turn, one command call); lost correction + re-sent message (one successor); a competing correction committed first (`TARGET_CHANGED`, one successor); cross-reader isolation; failed Memory read = failed turn; no id / status in any reply; RPC parameter names pinned to the migration's SQL signature | pass |
| Orchestrator spec: ALLOW Memory command ends in the atomic command with no other lane or provider; previous-words hand-off; GUIDED never consults the boundary; stale turn → current canonical state; boundary failure fails the turn closed | pass (217 with the HIM regression gate) |
| Evaluator spec (+ Arabic secrets on both paths, explicit statements) and enrichment spec (+ command guard) | pass |
| Full API Jest except `api-http-bootstrap` | 201 suites, 4,600 tests — all pass |
| `tests/w3-mega-m-conversational-memory-control-contract.test.mjs` | 31 / 31 — 8 detectors clean, 30 planted defects caught |
| 61 static contracts that read any touched file (incl. W1A-01, U1–U3, QIR-001/003/004/006, Full-Intelligence and Integrated-Brain smokes) | all pass |
| `database/tests/*.test.mjs` (incl. the verifier-hazard contract over the new verifier) | 1,257 / 1,257 |

CI (authoritative for what this host cannot run): API CI runs the full API Jest, the static contract before the
database bootstrap, and `database/verify-migration-0128.mjs` against real PostgreSQL (catalog, grants, the primitive,
every outcome, replay, `TARGET_CHANGED`, clarification binding, ownership, immutability, and committed two-connection
races). The results are reported on the PR, not claimed here.

## 8. Host limitations (infrastructure, not Product)

- No local PostgreSQL (Smart App Control blocks `initdb`): the 0128 verifier was written blind and is proven by API CI /
  the Focused Database Verification dispatch.
- `src/health/api-http-bootstrap.spec.ts` cannot run on this host's stale install (`@nestjs/platform-express` missing);
  CI runs it. Local Jest runs through a scratchpad-only resolver shim (native `unrs-resolver` is blocked); no repository
  file changes for it.

## 9. Defects found and their class

Two independent review agents (security / authority and correctness) reviewed the first commit adversarially, with
probes; every accepted finding was fixed and proven on this PR.

| Found | By | Class | Disposition |
|---|---|---|---|
| Arabic secrets passed the shared secret screen (ASCII `\b`) | implementation | Product defect (pre-existing, Safety) | fixed on both write paths |
| …and the fix still missed clitics («وكلمة السر», «والباسورد»), PIN / CVV / IBAN / account / passport numbers; free-text remember had no length bound | security review | Product defect (Safety) | fixed: clitics allowed, identifiers added, statements ≤ 280 characters |
| a Memory-command turn could still seed background Hypothesis generation from the words just withdrawn | security review | Product defect (reliance) | fixed: an explicit Memory command is never a generation trigger |
| any "I don't X, … I Y" sentence could supersede a Memory ("I don't like my job but I need the money") | correctness review | Product defect (HIGH) | fixed: a correction must restate its predicate; partial matches never correct |
| «انسى إني بحب المكان ده» reduced to «بحب» and could forget another preference | correctness review | Product defect (HIGH) | fixed: «مكان» is distinctive; a predicate alone never resolves or partially matches |
| "that one" picked option 1; «تاني؟» counted as an answer | correctness review | Product defect (HIGH) | fixed: pointing is a yes; questions are not answers |
| ordinary talk hijacked («انسى الموضوع ده», "stop relying on coffee", «امسح رقم أحمد») | correctness review | Product defect | fixed: the anchored / unanchored rule (§3.2); an unanchored unique match is confirmed first |
| «خلي بالك إن…», "remember that movie I told you about" stored | correctness review | Product defect | fixed |
| a question asked again lost the original request and language; «انسى التانية» was not an answer | correctness review | implementation defect | fixed (migration 0128's clarification read follows the chain) |
| the verifier's `finally { RESET ROLE }` in an aborted transaction would have masked every expected refusal (`25P02`) | correctness review | validation defect | fixed before any CI run |
| a correction's shared predicate made a re-sent correction ask instead of "already"; «5» fell to ordinary talk | implementation | implementation defect | fixed |
| the command guard ran before the secret screen and changed the frozen `SENSITIVE_DATA` skip reason | implementation | validation / ordering defect (no write either way) | fixed: the existing screens answer first |
| route-spec doubles crashed Node with unhandled rejections; two planted contract defects were mis-built | implementation | validation / proof defects | fixed in the proofs only |
| API CI (R1): migration 0026's verifier asserted the exact set of functions returning `public.memories`, so the legitimate `server_disable_memory_v1` failed it at `effective ACLs` before the 0128 verifier could run | GitHub CI | validation / forward-compatibility defect — the command already held the full 0026 posture | replaced the closed list with a discovered surface (superseded by R2) |
| API CI (R2): the R1 verifier still failed at `effective ACLs` — its grantee array was `name[]`, which node-pg does not decode, so the rules iterated the string `{postgres,service_role}` and rejected an original 0026 command (`EXECUTE held by {`); R1 also applied 0026's per-command shape rules (owner binding, which columns move, no physical delete) to every later command | GitHub CI + review | validation defect (decoding) and validation scope defect (a historical verifier linting later behaviour) | fixed in the verifier only: `database/memory-authority-surface-v1.mjs` now states only 0026's permanent invariants over a decoded catalog snapshot (`text[]` casts; undecoded facts fail as `CATALOG_SHAPE`) — no client table write, no service-role direct write, legacy RPC owner-only, no end-user-executable Memory writer, definer writers pin `search_path`, no generic mutation surface (generic argument, dynamic SQL, caller-chosen status), no end-user definer bridge or definer Memory read. Each command's behaviour stays with its own migration's verifier (0128 for `server_disable_memory_v1`). Failures print the function, the invariant and the reason; 24 static cases |

Kept deliberately (review LOW): the confirmation quotes the remembered words — the reader must see WHICH Memory changed,
and their own request already carries those words in the transcript (§10.8).

## 10. Deliberately not done / residues (BG-06: none is a new backlog item)

1. **No re-enable of a `DISABLED` Memory.** No Product authority defines one; none was invented. A disabled Memory stays
   disabled until forgotten.
2. **No "forget everything" / bulk command.** Only one target per command; a bulk request is ordinary conversation.
3. **Candidates are bounded to the 64 most recently changed controllable Memories**; an older one cannot be named in
   conversation, and "exactly one match" is judged inside that bound.
4. **Remembered words are shown as stored**, in whatever language they were said; no rewrite into the reply language.
5. **Egyptian «افتكر إن …» can also mean "I think that …".** Arabic remember needs «إن / إني» and a statement that does not
   point back at the conversation; the "I think" reading remains an ambiguity of the dialect.
6. **A short reply (≤ 6 words) triggers one owner-token read** to learn whether a clarification is pending; a failure of
   that read only means the reply is ordinary conversation.
7. **INSPECT orders by recency only** (`QAN-BL-CTX-01` unclaimed).
8. **Confirmation replies quote the remembered words**, so a forgotten / disabled fact's words also stand in that reply
   in the transcript the provider may read as recent history (they already stand in the reader's own request).
9. **Two answers to one clarification racing** hit `UNIQUE (answers_command_id)`: one applies, the other turn fails
   closed with the ordinary failed-reply state.
10. **Arabic copula-less corrections** («أنا مش مهندس، أنا دكتور») share no predicate word and stay ordinary conversation.
## 11. Lifecycle truth

- **`E2E-D-13` — IMPLEMENTED on the Draft PR; closes on merge.** Not closed now. *(Superseded: CLOSED by the merge of
  PR #293 at `3c0ea458a22a17a2a50c616b708f097f5911fb34`; see the Status banner.)*
- **W3 remains ACTIVE.** `E2E-D-03` and `D-05` stay open; `E2E-D-02` stays advanced only. No other Stage is opened.
- The current-state locators say exactly this and nothing more; no historical audit was rewritten.
