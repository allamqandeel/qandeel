# QANDEEL — S6-06 Implementation Record v1

**Task:** S6-06 — Progressive Disclosure, Photos, SUCCESS & Reactivation  
**Stage:** 6 — Matching & Introductions  
**Product authority:** the Product Owner's S6-06 Task Contract v1.0; WP0 v1.1 and its five-point correction, approved
on 2026-10-16 («S6-06 — اعتماد WP0 وبدء CP1»), with decisions D-01 … D-12 approved within the agreed limits and three
execution conditions inside CP1. No merge or deployment without the Product Owner's explicit «ادمج».  
**Status:** **IN PROGRESS — CP1 DELIVERED (SECURE BACKEND & MEDIA) — VISUAL GATE AND COPY GATE PRESENTED, NOT APPROVED —
NOT MERGED / NOT DEPLOYED** (2026-10-16). CP1 waits for the Product Owner's review; CP2 (mobile, end-to-end and closure)
is not started, and no user-interface code exists.  
**Base:** `main` = merged PR #343 (S6-05) at `88a475ab6798edbf511e42f78a2f70e5cdb37c34`, re-verified before the branch.  
**Branch:** `s6/s6-06-progressive-disclosure-photos` (one pull request for the whole task).  
**Migrations:** `0162_introduction_progressive_disclosure_media_v1.sql` and `0163_introduction_success_reactivation_v1.sql`
(CP1); both numbers were free.

Nothing here opens a launch gate. Every CW2-08 seam still answers `NOT_EVALUATED`, so in production no text is shared,
no photo byte is decoded or stored, no display grant is made, no SUCCESS transition exists to approve (`prepare` stays
producer-less until Stage 8A) and every resume answers `NOT_AVAILABLE_NOW`. Issue #322 stays open.
`MERGED ≠ DEPLOYED ≠ LAUNCH-READY`.

## 1. WP0 and the Product Owner's decisions (not to be reopened)

WP0 (read-only, on `88a475ab`) and its v1.1 correction were delivered outside the repository; the five-point corrective
reply followed. The Product Owner approved all three on 2026-10-16.

| ID | Decision (approved) |
|---|---|
| D-01 | Supabase Storage over its S3 protocol, credentials in the API only; CI: `rclone serve s3` at a pinned version, sha256-verified, the PostgREST pattern. Supabase conformance belongs to `HOSTED-DEPLOY-01` (§8, `QAN-BL-PROD-08`) |
| D-02 | The raw upload is never stored; the cleaned clear rendition is the stored original |
| D-03 | `sharp` and `@aws-sdk/client-s3` in the API, pinned exactly (`0.35.5`, `3.1142.0`); `expo-image-picker` and `expo-image` in the mobile app (CP2) |
| D-04 | 12 / 48 / 1600 px are technical candidates; the values are decided in the Visual Gate on real samples |
| D-05 | One active photo per person; a deleted shared stage retires its series; a new photo is a new series with all-new approvals |
| D-06 | Storing a photo is gated by the disclosure seam |
| D-07 | Approve gated, withdraw ungated, the commit a separate system execution, `prepare` Stage 8A's |
| D-08 | Reactivation as the frozen `0117` engine allows |
| D-09 | The `FULL_NAME` display consent is in S6-06: the owner's own grant of one exact disclosed version, revocable in every state; never `users.name` |
| D-10 / D-11 | The contact floor on every text value but `CONTACT_METHOD`; exactly four personal keys (`hometown_city` at most 64) |
| D-12 | One sharing action in the Introduction World header; V-1 otherwise unchanged |
| Corrections 1–5 | Picker clean-up with the SDK 57 `File` API; server erasure with access refused at once and no retained verifier; SUCCESS without `SAVEPOINT`; the real `expo-image-picker` permissions and a reachable revoke after END / SUCCESS; corrected deletion copy and the true row count |
| Conditions 1–3 | (1) the upload / deletion race leaves no orphan; (2) rclone's temporary or hidden files are cleaned and emptiness is never proven by ListObjects alone; (3) after the second approval the system attempts completion when the gates allow, retries safely, never touches the approvals and never duplicates the transition |

## 2. CP1 — what was built

### 2.1 Database (`0162`, `0163`; [database/README.md](../../database/README.md))

- **`0162`** adds the schema `introduction_sharing_private` (six relations, RLS on, no policy, no privilege; no column
  that could hold a digest, size, dimension or ETag) and the boundaries of disclosure, photos and the display consent:
  ten authenticated functions (each postgres-owned, SECURITY DEFINER, `search_path`-pinned, human = `auth.uid()`, no
  human parameter), nine service_role-only storage functions (no human identity at all), and five private helpers
  executable by no role. The frozen core is reached only by the two share shells; the frozen owner deletion only by
  removal (pinned by the S6-06 contract).
- **`0163`** adds the SUCCESS read, approve, withdraw and completion boundaries and the reactivation boundary, plus one
  private system attempt executable by no role. The approval never shares a transaction with the commit; nothing calls
  `prepare`; nothing is granted to service_role.
- Identities are derived (`QANDEEL_S6_06_INTRODUCTION_DISCLOSURE_IDENTITY_V1`, slot + human + scope + command), so an
  equivalent retry is the same act; the SUCCESS commit's identities are derived from the version alone (a nil "human").

### 2.2 API

- **`apps/api/src/introductions-disclosure/`** (composed through `AccountModule`): the routes of §2.3; the strict
  service; the S3 adapter `S3IntroductionMediaStore` (path-style, credentials from `QANDEEL_MEDIA_S3_*`, TLS-only except
  on loopback, no signed URL, no public ACL, nothing the provider computes is kept); the in-memory image pipeline
  (`sharp` cache off, one image at a time, decode-must-agree-with-magic, no animation, 256 px – 8000 px, 40 MP, ≤ 10 MB,
  re-encoded from raw pixels, so no EXIF / GPS / ICC / XMP survives); and `IntroductionMediaErasureWorker`.
- **`apps/api/src/introductions-continuation/`**: SUCCESS and resume, on the human's own token only (no service_role
  call in the directory, pinned).
- The upload asks the database's gated intent **first**: in production it answers `NOT_AVAILABLE_NOW` and the bytes are
  never decoded. After the intent, any failure removes the series so its keys go to the erasure queue.
- Every photo byte request re-authorizes the reader (`authorize_my_introduction_media_v1`), then resolves the key
  (service_role), then reads the object; the response is `no-store, private`. A client never receives a URL, a key or a
  user id.

### 2.3 Routes and rate classes (`route-rate-limit.census.ts`)

| Route | Class |
|---|---|
| `GET /introductions/worlds/:worldId/disclosures` | AUTHENTICATED |
| `POST /introductions/worlds/:worldId/disclosures/text` | SECURITY_SENSITIVE |
| `POST /introductions/worlds/:worldId/image/:commandId` (raw `image/jpeg`, `png`, `webp`) | SECURITY_SENSITIVE |
| `POST /introductions/worlds/:worldId/image-stages` | SECURITY_SENSITIVE |
| `POST /introductions/worlds/:worldId/image-removal` | AUTHENTICATED |
| `GET /introductions/worlds/:worldId/media/:handle` | AUTHENTICATED |
| `POST /introductions/worlds/:worldId/display-name/grant` | SECURITY_SENSITIVE |
| `POST /introductions/worlds/:worldId/display-name/revoke` | AUTHENTICATED |
| `GET /introductions/shares` | AUTHENTICATED |
| `GET /introductions/worlds/:worldId/success` | AUTHENTICATED |
| `POST /introductions/worlds/:worldId/success/approval` | AUTHENTICATED |
| `POST /introductions/worlds/:worldId/success/withdrawal` | AUTHENTICATED |
| `GET /introductions/participation` | AUTHENTICATED |
| `POST /introductions/participation/resume` | AUTHENTICATED |

A text share is deleted through the existing `POST /shared/worlds/:worldId/materials/:materialId/delete`, unchanged. The
resume route is named `resume`, not `reactivation`, because the S5-04 census forbids the substring `react` in any route.

### 2.4 CI (`.github/workflows/api-ci.yml`)

The S6-06 static contract with the other S6 contracts; the `0162` and `0163` verifiers after `0161`'s; and, in the
existing live-PostgREST step, rclone `v1.75.1` downloaded from rclone's own release, refused unless its sha256 is
`982b5aa7…a13ab`, started on loopback with CI-only throwaway keys, and the two proofs run on every PostgREST line
(v12.2.9, v13.0.8, v14.18, v16.4). No registry, no image, no new service.

## 3. The three conditions

| Condition | How it holds | Proof |
|---|---|---|
| 1 — upload / deletion race | The intent (series + keys) is written before any byte. Removal while an upload is in flight queues the keys with `not_before ≥ deadline + 60 s`; the API aborts its uploads at a 60 s budget inside the 120 s deadline; a late completion is refused. A listing reconciliation enqueues any stored object the database no longer knows | `verify-0162` C05, G03; `prove-0162` P06 (a real in-flight upload, removed, then landing late: not erased before the deadline, erased after; an object written after every erasure found by the reconciliation and erased) |
| 2 — rclone temporary / hidden files | An aborted PUT: rclone removes its partial file (its log says so) and the directory scan finds nothing. A KILLED server leaves one hidden `.rclone_temp_put_*` file that ListObjects never shows; the harness removes it, and only the directory scan proves it | `prove-0162` P07 (both cases, live); every emptiness claim in the proof is a scan of rclone's data directory, hidden files included, never a listing |
| 3 — SUCCESS completion | The approval commits in its own RPC; the completion is a separate RPC that takes no actor and derives one command from the version. The API runs it right after the second approval (three attempts) and again on every read by an approving human. A closed gate, a `40001` inside the commit or a withdrawal answer `PENDING` and roll back only that attempt | `verify-0163` B02–B07, G01; `prove-0163` S02 (an injected `40001` inside the commit on the real wire: still `APPROVED`, both approvals intact, nothing terminal; the next read completes exactly once) and S03 (closed gate: nothing written, nothing opened; the next read after it allows completes once) |

A timer-driven completion worker was **not** built: it would be a service_role path to Matching writes, which the
SEC-MATCH-00 census (`verify-0149` NO_BACKDOOR) forbids. When CW2-08 one day allows SUCCESS, the transition completes on
the next approval or read by either human.

## 4. The five corrections

| # | CP1 status |
|---|---|
| 1 | Mobile picker clean-up is CP2 (`new File(uri).delete()` after `.exists`, the exact-URI ledger, the `ImagePicker` sub-directory sweep, `getPendingResultAsync`). The server never writes a temporary file: the body is read into memory with a 10 MB cap |
| 2 | Built and proven (§3, `verify-0162` C03–C08, `prove-0162` P04–P05): refused at once, erased by DELETE + HEAD, deferred on failure and never dropped, no key / handle / media reference left (`0122`) |
| 3 | Built and proven (§3) |
| 4 | Permissions (`cameraPermission: false`, `microphonePermission: false`, `android.blockedPermissions` for storage, our own iOS Photos purpose string PD-83) are CP2's native build. The revoke is reachable in every state: in the World (P15) and on the Settings page P16 over `list_my_introduction_shares_v1` (`verify-0162` D02, D04) |
| 5 | PD-26b and PD-31 corrected; the true count is 68 in WP0 v1.1 and 74 in rev.1 ([gate record](QANDEEL_S6_06_VISUAL_COPY_GATE_v1.md)) |

## 5. Security and privacy posture

- **Gates.** No seam is changed; `0162` / `0163` assert at deploy time that the disclosure, SUCCESS and reactivation
  seams still answer `NOT_EVALUATED`. Production shape is proven to write nothing (`verify-0162` A05, `verify-0163` A03,
  `prove-0162` P01).
- **No manufactured consent.** Every human act is `auth.uid()` with no human parameter (asserted). The SUCCESS commit is
  system execution with no actor, executable only because both current approvals exist (`0116`), and the private attempt
  is asserted to read no session subject and touch no approval.
- **No service_role path to Matching.** The two continuation boundaries are the named S6-06 exceptions of the
  NO_BACKDOOR census, authenticated-only; service_role reaches only the storage boundary.
- **Storage.** A private bucket; keys only in the API environment (`.env.example` documents them, empty); no signed URL
  or public link; the API ignores the provider's ETag; nothing in QANDEEL's records verifies deleted content.
- **Limits stated, not hidden.** Blur bounds the information but does not prevent recognition (PD-21b). What the other
  person saw, screenshotted or kept cannot be recalled (PD-13, PD-26b, PD-31). Provider backups and PITR are outside
  QANDEEL's records. rclone is not Supabase: Supabase's own behaviour is proven only at `HOSTED-DEPLOY-01`.

## 6. Contracts and verifiers re-anchored (only where S6-06 changes their truth)

| File | Why |
|---|---|
| `database/verify-migration-0149.mjs` | NO_BACKDOOR names the two S6-06 continuation boundaries (`S6_06_INTRODUCTION_CONTINUATION`) with refusal probes f10 / f11 |
| `database/verify-migration-0150.mjs` | ABSORBED names the approval, withdrawal and reactivation boundaries (each absorbs the cores' `40001` with a handler naming `PT409`) |
| `tests/s6-02-…`, `tests/s6-04-…`, `tests/s6-05-mutual-match-…`, `tests/s6-05-introduction-world-messaging-…` | their pins of the `0149` census line, the `0150` list and the `AccountModule` imports now include S6-06's additions |
| `tests/conversation-focus-runtime-integration-readiness-contract.test.mjs` | the two S6-06 services join the exact list of production readers of the typed database identity, for the one `22023` refusal only |

`verify-0122`'s erasure census was met by naming, not by re-anchoring: the private schema is `introduction_sharing_private`
(it holds photos and display consents, not the disclosure), and `verify-0162` A02b asserts that no erasure-queue boundary
reaches a disclosure relation or function.

## 7. Verification (local, real PostgreSQL 17.10, PostgREST v12.2.9, rclone v1.75.1)

- `verify-migration-0162`: **25 / 25**; `verify-migration-0163`: **12 / 12**.
- Re-anchored and neighbouring verifiers on the same fully migrated database: `0149` 28 / 28, `0150` 28 / 28, `0122`
  23 / 23, `0117`, `0115`, `0116`, `0118`, `0119`, `0120`, `0121`, `0109`, `0111`, `0112`, `0113`, `0114`, `0139`, `0143`,
  `0155`, `0158`, `0159`, `0160`, `0161` all green; the full 156-verifier sweep is reported in §7.1.
- `prove-0162-introduction-media-store` and `prove-0163-introduction-success-postgrest`: **pass** (one line locally; CI
  runs all four).
- API: the three new specs (pipeline 6, disclosure 35, continuation 15) and the full suite (§7.1).
- Root contracts: all pass, including `forward-safety` (35) and the new `s6-06-introduction-disclosure-contract` (7).
- Exact-head CI: the first head `70a93201` failed at `prove-0162` P02; the cause and the correction are in §7.2.

### 7.1 Full sweeps

- **Every database verifier** (156) on one fully migrated database (`0001` … `0163`): 155 pass; `verify-migration-0133`
  cannot run on this host because it shells out to `psql`, which is not installed here (an environment limit, already
  known; CI runs it).
- **The whole API suite:** 255 suites, 5996 tests, all pass.
- **Every root contract** (`tests/*.test.mjs`): all pass.

### 7.2 CI correction R1 — parallel first writes on rclone serve s3

- **Failure (exact head `70a93201`, API CI, PostgREST v12.2.9 line):** `prove-0162` P02 answered `UNAVAILABLE`
  instead of `READY`; the storage log shows `Dir.Rename error: file does not exist` on the first of the three
  renditions, which the API then wrote concurrently (`Promise.all`).
- **Root cause (rclone v1.75.1 source, confirmed by the CI log):** `serve s3` keeps S3 keys as files under a VFS.
  `PutObject` runs `mkdirRecursive` - a Stat followed by a Mkdir, not atomic - and `vfs.Dir.Mkdir` registers a NEW
  directory node that replaces the existing one; `DeleteObject` removes the emptied `intro-media/` directory again
  (`rmdirRecursive`). Three concurrent first writes into the absent directory therefore registered three nodes (the CI
  log has three `vAddDir "intro-media"` lines for one upload); the first upload's temporary object belonged to a node
  already replaced, so its rename into place found nothing. Real S3 / Supabase Storage has no directories; the race is
  the CI store's, and it could not be reproduced on the Windows build used locally (100 / 100 trials passed).
- **Correction (smallest safe one, no change to the hosted target):** the service writes the three renditions **one at a
  time, in stage order**; the first failure stops before the next object is written (the series is removed and its
  keys queued, as before). No store ever sees concurrent first writes under one prefix. P02 and its conditions are
  unchanged; a new spec pins one-at-a-time order and stop-on-failure; P06 keeps the race - the first object is held in
  flight, the photo is removed, nothing is erased before the deadline, all three objects land late, the completion is
  refused, and all three are erased after the deadline - and now also asserts that nothing had landed before the
  removal.
- **Re-run locally on an EMPTY rclone data directory (the CI starting state):** both proofs pass; the storage log has no
  `Dir.Rename` error, and `intro-media/` was recreated five times, each by a single write.

## 8. Backlog (BG-05 / BG-06, CP1)

- **Inherited (BG-05):** none named `S6-06`; the S6-02 closure's `FULL_NAME` display consent and the photo / disclosure /
  SUCCESS / reactivation scope are S6-06's own and are delivered here (D-09).
- **Admitted:** `QAN-BL-PROD-08` — Introduction photo object store: hosted Supabase Storage provisioning and live
  conformance (owner `HOSTED-DEPLOY-01`, `HIGH`, `DEFERRED — OWNED`).
- **Dated notes:** `QAN-BL-ACCT-01` (the new relations and the stored photo objects join the Connected Worlds deletion
  footprint) and `QAN-BL-PRIV-04` (the reader's own shares, photos and display-consent acts join the export scope).

## 9. Deliberately not in CP1

Every mobile surface and the picker (CP2, after both gates close); the native permission build proof and the device
cache-directory proof (CP2); a SUCCESS producer (Stage 8A); content moderation of photos (CW2-08 / Stage 9); Activity,
Push and Direct Entry (S6-07); erasure telemetry beyond the count-only state RPC (the PROD-OPS-01 outcome map is pinned
by its own contract; CP2 decides it inside S6-06).
