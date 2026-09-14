// I-03F - Shared Delivery Authority Revalidation Boundary v1: the repository-level
// scope contract for a slice that adds NO database boundary.
//
// The namespace's own behaviour is proven by its Jest spec
// (`apps/api/src/connected-worlds/delivery-authority/shared-delivery-authority-
// revalidator.service.spec.ts`), which this file pins into the toolchain. What a
// Jest spec rooted at `apps/api/src` cannot see is the rest of the tree, so the
// cross-tree half of the I-03F scope guard lives here: that the frozen I-03A /
// I-03B / I-03C / I-03D / I-03E sources were not edited, that the slice added no
// SQL, verifier or database wiring, that nothing outside the Connected Worlds
// domain learned about the boundary, and that no Source Disclosure Gate was
// invented.
//
// ## What this contract deliberately does NOT claim
//
// It does not claim "no migration numbered above 0080 exists", and it does not
// enumerate migrations. A later authorized slice - I-03G's Source Disclosure
// Gate, I-04's Shared output commit, a source-state adapter - will add
// migrations, and a contract that counted them would fail on correct work by
// someone who never read it (the repository's forward-safety gate exists
// because that has happened here before). "I-03F added no database boundary" is
// proven instead as a property of I-03F itself: its own namespace contains no
// SQL and no transport, it registers no database verifier, and the Connected
// Worlds migrations that already existed are byte-identical to their merged
// blobs - so this slice neither wrote one nor edited one.
//
// It also does not freeze the future consumers. The delivery-authority boundary
// is deliberately unwired: I-04 owns the Shared generation / commit path and
// will be the first authorized consumer. The invoker assertions below therefore
// say only "nothing OUTSIDE the Connected Worlds domain knows this boundary",
// never "only this namespace may ever use it".
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const stripTsComments = (ts) => ts
  .replace(/\/\*[\s\S]*?\*\//gu, '')
  .replace(/^[ \t]*\/\/.*$/gmu, '')
  .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');

const NAMESPACE = '../apps/api/src/connected-worlds/delivery-authority/';
const TYPES = 'shared-delivery-authority.types.ts';
const SOURCE_TYPES = 'shared-private-source-state-resolver.types.ts';
const SERVICE = 'shared-delivery-authority-revalidator.service.ts';
const SPEC = 'shared-delivery-authority-revalidator.service.spec.ts';
const PRODUCTION = [TYPES, SOURCE_TYPES, SERVICE];

const sources = Object.fromEntries(PRODUCTION.map((name) => [name, read(`${NAMESPACE}${name}`)]));
const executable = Object.fromEntries(PRODUCTION.map((name) => [name, stripTsComments(sources[name])]));
const spec = read(`${NAMESPACE}${SPEC}`);
const packageJson = read('../package.json');
const workflow = read('../.github/workflows/api-ci.yml');

const apiSrc = new URL('../apps/api/src/', import.meta.url);
const apiFiles = readdirSync(apiSrc, { recursive: true }).map(String).filter((name) => /\.(?:ts|js|mjs)$/u.test(name));
const separator = (name) => (name.includes('\\') ? '\\' : '/');

// ---------------------------------------------------------------------------

test('the delivery-authority namespace carries exactly its three production files and one spec, and no other surface', () => {
  const entries = readdirSync(new URL(NAMESPACE, import.meta.url)).sort();
  assert.deepEqual(entries, [SPEC, SERVICE, TYPES, SOURCE_TYPES].sort(), 'the namespace is closed: three production files and their one spec');
  assert.deepEqual(entries.filter((name) => !name.endsWith('.ts')), [], 'no SQL, JSON, snapshot or generated file lives in the namespace');
  assert.deepEqual(entries.filter((name) => /controller|\bmodule\b|gateway|\.dto\.|resolver\.ts$|route/u.test(name)), [],
    'no controller, Nest module, gateway, DTO or route is added');

  // The whole Connected Worlds domain still carries no HTTP or registration surface.
  const connectedWorlds = readdirSync(new URL('connected-worlds/', apiSrc), { recursive: true }).map(String);
  assert.deepEqual(connectedWorlds.filter((name) => /controller|module|gateway|\.dto\./u.test(name)), [],
    'no controller, Nest module, gateway or DTO under connected-worlds');
});

test('I-03F adds no database boundary: no SQL, no verifier, no database wiring, and no existing Connected Worlds migration was edited', () => {
  // (a) The slice's production files contain no SQL, DDL, RPC name, table name or
  // transport. The spec is deliberately NOT scanned with these patterns: its own
  // scope guard quotes banned shapes as regex literals, so scanning it would only
  // ever measure the guard's vocabulary against itself.
  for (const name of PRODUCTION) {
    for (const pattern of [
      /\b(?:CREATE|INSERT|UPDATE|MERGE|TRUNCATE|ALTER|GRANT|REVOKE)\s+(?:TABLE|FUNCTION|POLICY|ROLE|INDEX|ON|INTO)\b/u,
      /\/rest\/v1\/|\bfetch\(|resolve_shared_world_\w+|SUPABASE|SERVICE_ROLE/u,
      // Spelled without any full table name, so this guard can never be satisfied
      // or broken by its own text if a future contract scans the repository whole.
      /shared_worlds|membership_episodes|standing_context_\w*(?:grants|consent)|grant_audience|conversation_turns|conversation_sessions|memories/u,
    ]) {
      assert.doesNotMatch(executable[name], pattern, `${name} carries no database or transport surface`);
    }
  }
  // The spec proves behaviour against fakes, so it opens no transport of its own
  // and names no RPC: it never reaches PostgreSQL, and CI needs no database step.
  const executableSpec = stripTsComments(spec);
  assert.doesNotMatch(executableSpec, /\bfetch\(|globalThis\.fetch|resolve_shared_world_\w+|new Pool\(|require\('pg'\)/u,
    'the spec opens no transport and names no RPC');
  assert.match(executableSpec, /const sources: SharedPrivateSourceStateResolver = \{/u, 'the source-state dependency is faked in tests, not implemented');
  // (b) It registers no database verifier and no CI database step of its own.
  assert.doesNotMatch(packageJson, /"verify:shared-delivery-authority[^"]*"/u, 'no database verifier script is registered for this slice');
  assert.doesNotMatch(workflow, /verify:shared-delivery-authority/u, 'no CI database verification step is added for this slice');
  assert.equal(existsSync(new URL('../database/verify-migration-0081.mjs', import.meta.url)), false, 'I-03F reserved no 0081 verifier');
  assert.deepEqual(readdirSync(new URL('../database/tests/', import.meta.url)).filter((name) => /delivery[-_]authority|revalidat/iu.test(name)), [],
    'I-03F added no database contract, because it added no database object');

  // (c) The Connected Worlds migrations that already existed are untouched, so the
  // slice neither wrote a migration nor edited one. Nothing here enumerates or
  // counts what comes after 0080 - a later authorized migration is not this
  // contract's business.
  for (const [name, blob] of [
    ['0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
    ['0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
    ['0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
    ['0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
    ['0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
    ['0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ]) {
    assert.equal(gitBlobId(read(`../database/migrations/${name}`)), blob, `${name} is byte-identical to its merged blob`);
  }
});

test('every frozen I-03A / I-03B / I-03C / I-03D / I-03E production source is byte-unchanged', () => {
  for (const [path, blob] of [
    ['../apps/api/src/connected-worlds/kernel/authority.types.ts', '1dd6f0e49aa64685b4650a72872c01fceebd517e'],
    ['../apps/api/src/connected-worlds/kernel/material.types.ts', '86b89d87965763405ac79086bae99655eb8d110d'],
    ['../apps/api/src/connected-worlds/kernel/principal.types.ts', '654633ad8b7181c5636d2dd4041bdeb6ec1d3892'],
    ['../apps/api/src/connected-worlds/kernel/shared-world.types.ts', '7f65364091a0896ee229add95baad941ad656cbc'],
    ['../apps/api/src/connected-worlds/kernel/world-invariants.ts', 'bd000e20700253dbba5684e2bb745ff3872470f7'],
    ['../apps/api/src/connected-worlds/kernel/world.types.ts', '597c0e8b736300c911fc542a38bf9c99e308c9cc'],
    ['../apps/api/src/connected-worlds/authority/standing-context-authority.types.ts', '7b6478480a5490ae52bae2316c2c0aa51a679cf5'],
    ['../apps/api/src/connected-worlds/authority/standing-context-authority.ts', 'f08a3349994a6273ee9f4be4f6fa91bf50d0bc97'],
    ['../apps/api/src/connected-worlds/authority-resolution/standing-context-grant-resolver.service.ts', 'f72b2665e543c5259a9a682c53c721653c9779b7'],
    ['../apps/api/src/connected-worlds/audience/shared-human-audience-resolution.types.ts', '39dfdb3c443882682bc05e56bfc2fe1762a8d40f'],
    ['../apps/api/src/connected-worlds/audience/shared-human-audience-resolver.service.ts', '940eaa77736efb9b171e878b45790cbccbe556c9'],
    ['../apps/api/src/connected-worlds/effective-context/shared-effective-context.types.ts', 'c765d1c4c97a522f7256b637a58bcaa11534540d'],
    ['../apps/api/src/connected-worlds/effective-context/shared-effective-context.service.ts', '109a630f575be30e91efc81a636eff4968194abc'],
    ['../apps/api/src/connected-worlds/effective-context/shared-pre-model-world-state-resolver.service.ts', '9f3b9a43fccc46c42b391cab66388bcc3d75d0e5'],
  ]) {
    assert.equal(gitBlobId(read(path)), blob, `${path} is byte-identical to its merged blob`);
  }
  // I-03F consumes the I-03E fingerprint helper and the frozen I-03A evaluator as
  // EXPORTED production API; it did not have to widen either one to do so.
  assert.match(executable[SERVICE], /import \{ fingerprintSharedEffectiveContext \} from '\.\.\/effective-context\/shared-effective-context\.service';/u);
  assert.match(executable[SERVICE], /import \{ evaluateStandingContextAuthority \} from '\.\.\/authority\/standing-context-authority';/u);
});

test('nothing outside the Connected Worlds domain knows the delivery-authority boundary, and no Model Router, intelligence-runtime, conversation or mobile file was touched', () => {
  // A later authorized Connected Worlds slice (I-04's Shared generation / commit
  // path) WILL consume this boundary. That is not an I-03F property, so this
  // contract proves only that the boundary has not escaped the domain.
  const outside = apiFiles.filter((name) => !name.startsWith('connected-worlds')
    && /SharedDeliveryAuthority|SharedPrivateSourceState|delivery-authority/u.test(readFileSync(new URL(name, apiSrc), 'utf8')));
  assert.deepEqual(outside, [], 'no API file outside Connected Worlds names the revalidator: no model, provider, conversation, controller or messaging wiring');

  // Within the domain, only the delivery-authority namespace itself knows it yet.
  const domainInvokers = apiFiles.filter((name) => !name.includes(`connected-worlds${separator(name)}delivery-authority`)
    && /SharedDeliveryAuthorityRevalidatorService|SHARED_PRIVATE_SOURCE_STATE_RESOLVER/u.test(readFileSync(new URL(name, apiSrc), 'utf8')));
  assert.deepEqual(domainInvokers, [], 'I-03F wires itself into no existing runtime path; I-04 owns the first consumer');

  const mobileSrc = new URL('../apps/mobile/src/', import.meta.url);
  if (existsSync(mobileSrc)) {
    const mobile = readdirSync(mobileSrc, { recursive: true }).map(String)
      .filter((name) => /\.(?:ts|tsx)$/u.test(name) && /DeliveryAuthority|delivery-authority|revalidat/iu.test(readFileSync(new URL(name, mobileSrc), 'utf8')));
    assert.deepEqual(mobile, [], 'a server-side authority boundary never reaches a client');
  }
});

test('no Source Disclosure Gate is implemented: CW2-02 §58 defers the detector and I-03F invented none', () => {
  for (const name of PRODUCTION) {
    for (const pattern of [
      /\bquote\b|quoting|verbatim|excerpt|snippet|paraphras/iu,
      /redact|scrub|sanitizeOutput|rewriteOutput|summari[sz]e|rerank/iu,
      /Classifier|classifyOutput|classifyDisclos|detector|detect\w*(?:Disclos|Leak|Quote|Fact)|semanticMatch/iu,
      /similar|threshold|embedding|cosine|jaccard|levenshtein/iu,
      /sourceDisclosureSafe|disclosureSafe|declaredSafe|providerAsserts|selfDeclar/iu,
    ]) {
      assert.doesNotMatch(executable[name], pattern, `${name} invents no direct-source disclosure detection`);
    }
  }
  // The provider output is hashed and never inspected.
  assert.match(executable[SERVICE], /createHash\('sha256'\)\.update\(outputText, 'utf8'\)/u);
  assert.doesNotMatch(executable[SERVICE], /outputText\s*[.[]/u, 'the output text is never indexed, searched, sliced or compared');
  // And the result says so structurally.
  assert.match(executable[TYPES], /readonly sourceDisclosureAuthority: 'NOT_EVALUATED';/u);
  assert.match(executable[TYPES], /readonly systemSafetyAuthority: 'NOT_EVALUATED';/u);
});

test('a CURRENT revalidation is authority freshness only, never delivery, disclosure or material permission', () => {
  assert.match(executable[TYPES], /readonly authorityStatus: 'CURRENT';/u);
  assert.match(executable[TYPES], /readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';/u);
  assert.match(executable[TYPES], /readonly directPrivateDisclosureAuthority: 'NOT_GRANTED';/u);
  assert.match(executable[TYPES], /readonly materialDisclosureAuthority: 'NOT_GRANTED';/u);
  assert.match(executable[TYPES], /readonly provenanceDisclosure: 'SEALED';/u);
  for (const name of PRODUCTION) {
    for (const pattern of [
      /deliveryAllowed|publishAllowed|materialDisclosureAllowed|canDeliver|mayDeliver|allowDelivery/u,
      /\ballowed\s*:|\bsafe\s*:|\bpermitted\s*:/u,
      /'DISCLOSE_PRIVATE_FACT'|'QUOTE'|'MATERIAL_TRANSFER'|'PUBLICATION'|'REPLAY_DISTRIBUTION'|'HISTORY_ACCESS'|'DELIVERY_ALLOWED'|'SOURCE_DISCLOSURE_SAFE'/u,
      /SourceMaterialRef|materialId|MATERIAL_DEPENDENCY|REASONING_DEPENDENCY|SEALED_PROVENANCE_DEPENDENCY|ProvenanceRecord|HistoryAccessGrant|ReplayArtifact/u,
    ]) {
      assert.doesNotMatch(executable[name], pattern, `${name} grants no delivery, disclosure or material authority`);
    }
  }
  // Nothing is persisted or committed: Shared output persistence belongs to I-04.
  for (const pattern of [/persist|\bcommit\b|outbox|writeAudit|auditEvent|\.save\(|repository/iu, /randomUUID|Math\.random|Date\.now|new Date|performance\.now/u]) {
    assert.doesNotMatch(executable[SERVICE], pattern, 'the revalidator writes nothing and uses no clock or random identity');
  }
});

test('the bounded stale / unresolved vocabularies leak no per-owner consent, grant or source fact', () => {
  const staleReasons = ['WORLD_STATE_CHANGED', 'WORLD_READ_ONLY_CLOSED', 'AUDIENCE_CHANGED', 'NO_ACTIVE_HUMANS', 'PRIVATE_AUTHORITY_CHANGED', 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE'];
  const unresolvedReasons = ['MALFORMED_EFFECTIVE_CONTEXT', 'WORLD_STATE_UNRESOLVED', 'AUDIENCE_UNRESOLVED', 'PRIVATE_AUTHORITY_UNRESOLVED', 'PRIVATE_SOURCE_STATE_UNRESOLVED'];
  for (const reason of [...staleReasons, ...unresolvedReasons]) {
    assert.ok(executable[TYPES].includes(`'${reason}'`), `${reason} is part of the frozen vocabulary`);
    assert.doesNotMatch(reason, /REVOKED|ABSENT|DENIED|OWNER_|PARTICIPANT|GRANT_ID|COUNTERPART/u, `${reason} names a class, not a person or a consent state`);
  }
  // Known staleness and unknown state stay distinct: neither union collapses into the other.
  for (const reason of staleReasons) assert.ok(!unresolvedReasons.includes(reason));
  // No I-03A internal reason class escapes into an I-03F result.
  for (const leaked of ['GRANT_REVOKED', 'NO_STANDING_CONTEXT_GRANT', 'GRANTOR_MISMATCH', 'AUDIENCE_EXCEEDS_GRANT_CEILING', 'GRANT_STATE_UNRESOLVED', 'MALFORMED_GRANT_SNAPSHOT']) {
    for (const name of PRODUCTION) assert.doesNotMatch(executable[name], new RegExp(`'${leaked}'`, 'u'), `${name} does not re-export an I-03A internal reason`);
  }
});

test('the contract is registered in the toolchain and API CI exactly once, and is not vacuous', () => {
  assert.match(packageJson, /"test:shared-delivery-authority-revalidation-contract": "node --test tests\/shared-delivery-authority-revalidation-contract\.test\.mjs"/u);
  assert.equal((workflow.match(/test:shared-delivery-authority-revalidation-contract/gu) ?? []).length, 1, 'registered exactly once in API CI');
  assert.match(workflow, /Verify Shared delivery authority revalidation boundary static contract \(I-03F\)/u);
  // Anti-vacuity: the files this contract asserts over are real and substantial,
  // and the comment-stripping really removed the prose the bans were aimed at.
  for (const name of PRODUCTION) {
    assert.ok(executable[name].length > 500, `${name} has substantial executable source`);
    assert.ok(sources[name].length > executable[name].length, `${name} really was comment-stripped`);
  }
  assert.ok(spec.length > 20000, 'the behavioural spec this contract pins is substantial');
  assert.match(spec, /describe\('SharedDeliveryAuthorityRevalidatorService'/u);
});
