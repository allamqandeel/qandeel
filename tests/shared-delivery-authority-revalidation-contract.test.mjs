// I-03F - Shared Delivery Authority Revalidation Boundary v1: the repository-level
// scope contract for a slice that adds NO database boundary.
//
// The namespace's own behaviour is proven by its Jest spec
// (`apps/api/src/connected-worlds/delivery-authority/shared-delivery-authority-
// revalidator.service.spec.ts`), which this file pins into the toolchain. What a
// Jest spec rooted at `apps/api/src` cannot see is the rest of the tree, so the
// cross-tree half of the I-03F scope guard lives here.
//
// ## What this contract claims, and what it refuses to claim
//
// It proves exactly one thing about I-03F: that THIS slice introduced no database
// boundary, no HTTP/route/module surface, no provider integration, no
// direct-source disclosure detector, no persistence and no delivery commit, and
// that it modified none of the frozen predecessor sources it was required to
// leave alone.
//
// It deliberately does NOT prove that any of those may never appear later. That
// distinction is the whole of I-03F §51, and getting it wrong is the repository's
// known failure mode: a contract that freezes a temporary ABSENCE ("no migration
// 0081 exists", "this directory holds exactly four files", "the domain contains no
// module") fails on correct future work by people who never read it. I-03G's
// Source Disclosure Gate, I-04's Shared output commit path and a real
// source-state adapter are all scheduled, and each of them will legitimately add
// a file to this namespace, a Connected Worlds consumer, a migration, a verifier
// and a CI step.
//
// So every assertion below is scoped to one of exactly two things:
//
//   (a) the four files I-03F introduced, and the two registration lines it added;
//   (b) the frozen predecessor files it was required not to modify, pinned by
//       content hash - which proves immutability without banning additions.
//
// There is no assertion of the form "X does not exist", "this directory contains
// exactly N files", or "no file anywhere may ever contain Y". The final test
// proves that claim the only way it can be proven: it mirrors the repository,
// performs the authorized future additions, and requires this contract to still
// pass - then plants the regressions it must still refuse, so the forward-safety
// is not bought by asserting nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootPath = fileURLToPath(new URL('../', import.meta.url));
const SELF = 'shared-delivery-authority-revalidation-contract.test.mjs';
/** Set in the child runs of the forward-safety probe, so the probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I03F_FORWARD_SAFETY_CHILD';

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

/** The I-03F registration: a Node-only static gate, deliberately not a database verifier. */
const OWN_SCRIPT = 'test:shared-delivery-authority-revalidation-contract';
const OWN_STEP = 'Verify Shared delivery authority revalidation boundary static contract (I-03F)';

// ---------------------------------------------------------------------------

test('the four files I-03F introduced exist and add no HTTP, route, module, gateway or DTO surface', () => {
  // Presence, never a census: a later authorized helper, adapter or second spec
  // in this namespace is exactly the growth I-03G / I-04 are expected to bring.
  for (const name of [...PRODUCTION, SPEC]) {
    assert.ok(existsSync(new URL(`${NAMESPACE}${name}`, import.meta.url)), `${name} is part of the I-03F slice`);
  }
  for (const name of PRODUCTION) {
    for (const pattern of [
      /@Controller|@Get\(|@Post\(|@Put\(|@Patch\(|@Delete\(|@Module|@WebSocketGateway|@SubscribeMessage/u,
      /\bexpress\b|RouterModule|\bNestFactory\b|\.dto\b|createParamDecorator/u,
    ]) {
      assert.doesNotMatch(executable[name], pattern, `${name} opens no route and registers no module`);
    }
  }
  // Exactly one Nest surface across the three files I-03F added: an injectable
  // service with one injected contract. Nothing here registers it anywhere.
  assert.equal((executable[SERVICE].match(/@Injectable\(\)/gu) ?? []).length, 1);
  assert.equal((executable[SERVICE].match(/@Inject\(/gu) ?? []).length, 1);
  for (const name of [TYPES, SOURCE_TYPES]) assert.doesNotMatch(executable[name], /@Injectable|@Inject\(|@Module/u, `${name} is vocabulary only`);
});

test('I-03F added no database boundary: its own files carry no SQL or transport, and its own registration is a Node-only static gate', () => {
  // (a) The files this slice introduced contain no SQL, DDL, RPC name, table name
  // or transport. Scoped to those files; nothing is claimed about any other file,
  // now or later.
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

  // (b) The ONE script and the ONE workflow step this slice registered are a
  // `node --test` static gate. That is a positive statement about I-03F's own
  // registration - it neither counts the scripts in the manifest nor forbids a
  // later slice from registering a database verifier of its own.
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --test tests/${SELF.replace(/\./gu, '\\.')}"`, 'u'),
    'the I-03F script is a Node-only static contract, not a database verifier');
  assert.equal((workflow.match(new RegExp(OWN_SCRIPT, 'gu')) ?? []).length, 1, 'the I-03F gate is registered exactly once in API CI');
  assert.ok(workflow.includes(`{name: ${OWN_STEP}, run: npm run ${OWN_SCRIPT}}`), 'the I-03F CI step runs exactly that gate');
  assert.doesNotMatch(workflow.slice(workflow.indexOf(OWN_STEP), workflow.indexOf(OWN_STEP) + 200), /--env-file|database\/verify-migration/u,
    'the I-03F step needs no database');
});

test('every frozen predecessor source and Connected Worlds migration I-03F was required not to modify is byte-unchanged', () => {
  // Content pins on files that already existed. They prove immutability of the
  // I-03A / I-03B / I-03C / I-03D / I-03E baseline; they say nothing at all about
  // files that do not exist yet, so a later migration, resolver or adapter is
  // free to appear without touching this claim.
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
    ['../database/migrations/0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
    ['../database/migrations/0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
    ['../database/migrations/0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
    ['../database/migrations/0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
    ['../database/migrations/0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
    ['../database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ]) {
    assert.equal(gitBlobId(read(path)), blob, `${path} is byte-identical to its merged blob`);
  }
  // I-03F consumes the I-03E fingerprint helper and the frozen I-03A evaluator as
  // EXPORTED production API; it did not have to widen either one to do so.
  assert.match(executable[SERVICE], /import \{ fingerprintSharedEffectiveContext \} from '\.\.\/effective-context\/shared-effective-context\.service';/u);
  assert.match(executable[SERVICE], /import \{ evaluateStandingContextAuthority \} from '\.\.\/authority\/standing-context-authority';/u);
});

test('the delivery-authority boundary stays inside the Connected Worlds domain and never reaches a client', () => {
  // The one containment invariant this contract keeps. It is a boundary rule, not
  // a temporary absence: a server-side authority gate belongs to its domain, and
  // the same claim is already made by the merged 0079 and 0080 contracts for
  // their resolvers.
  //
  // It deliberately does NOT say "only the delivery-authority namespace may
  // consume this". I-04 owns the Shared generation / commit path and will be the
  // first authorized consumer; a Connected Worlds module, service or barrel that
  // imports the revalidator is expected growth and is proven acceptable by the
  // forward-safety probe below.
  const outside = apiFiles.filter((name) => !name.startsWith('connected-worlds')
    && /SharedDeliveryAuthority|SharedPrivateSourceState|delivery-authority/u.test(readFileSync(new URL(name, apiSrc), 'utf8')));
  assert.deepEqual(outside, [], 'no API file outside Connected Worlds names the revalidator: no model-router, conversation, intelligence-runtime or controller wiring');

  const mobileSrc = new URL('../apps/mobile/src/', import.meta.url);
  if (existsSync(mobileSrc)) {
    const mobile = readdirSync(mobileSrc, { recursive: true }).map(String)
      .filter((name) => /\.(?:ts|tsx)$/u.test(name) && /SharedDeliveryAuthority|SharedPrivateSourceState|delivery-authority/u.test(readFileSync(new URL(name, mobileSrc), 'utf8')));
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
      /'SAFE'|'UNSAFE'|isSafe|markSafe/u,
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

test('the contract is not vacuous: the files it asserts over are real, substantial and really comment-stripped', () => {
  for (const name of PRODUCTION) {
    assert.ok(executable[name].length > 500, `${name} has substantial executable source`);
    assert.ok(sources[name].length > executable[name].length, `${name} really was comment-stripped`);
  }
  assert.ok(spec.length > 20000, 'the behavioural spec this contract pins is substantial');
  assert.match(spec, /describe\('SharedDeliveryAuthorityRevalidatorService'/u);
});

// ---------------------------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
//
// Every claim above is meant to be a statement about what I-03F DID, never about what the
// repository may contain later. The only honest way to show that is to build the repository one
// authorized step into its future and require this contract to still pass - and then to plant the
// regressions it must still refuse, so the forward-safety is not bought by asserting nothing.
// ---------------------------------------------------------------------------------------------

/** Only the paths this contract actually reads. Copying the whole tree would cost seconds for nothing. */
const MIRRORED = ['apps/api/src', 'apps/mobile/src', 'database/migrations', '.github/workflows/api-ci.yml', 'package.json', `tests/${SELF}`];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = mkdtempSync(join(tmpdir(), 'qandeel-i03f-forward-'));
  for (const entry of MIRRORED) {
    const from = join(rootPath, entry);
    if (!existsSync(from)) continue;
    const to = join(mirror, entry);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, filter: (src) => !SKIP.test(src.slice(rootPath.length)) });
  }
  return mirror;
}

/**
 * Runs THIS contract against the mirrored tree, in a child that does not run the probe again.
 *
 * `NODE_TEST_CONTEXT` is stripped deliberately. Inherited, it makes the spawned Node believe it is
 * a reporting child of this runner: it switches to the parent's serialization protocol and exits 0
 * whatever its tests did, which would make every refusal below read as an acceptance.
 */
function runInMirror(mirror) {
  const env = { ...process.env, [PROBE_CHILD]: '1' };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', join(mirror, 'tests', SELF)], { cwd: mirror, encoding: 'utf8', env });
  assert.equal(result.error, undefined, `the mirrored contract could not be started: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'the mirrored contract did not exit normally');
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function write(mirror, relative, content) {
  const target = join(mirror, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function patch(mirror, relative, transform, marker) {
  const target = join(mirror, relative);
  const before = readFileSync(target, 'utf8');
  const after = transform(before);
  assert.notEqual(after, before, `the ${relative} mutation matched nothing`);
  assert.ok(after.includes(marker), `the ${relative} mutation did not introduce ${marker}`);
  writeFileSync(target, after);
}

/** Puts one mirrored path back, or removes a file the scenario added. */
function restore(mirror, ...paths) {
  for (const relative of paths) {
    const from = join(rootPath, relative);
    const to = join(mirror, relative);
    if (existsSync(from)) cpSync(from, to);
    else rmSync(to, { force: true });
  }
}

const CW = 'apps/api/src/connected-worlds';
const DA = `${CW}/delivery-authority`;
/** Paths every scenario below may touch, restored after each one. */
const SCENARIO_PATHS = [
  `${DA}/shared-private-source-state-postgres-adapter.ts`,
  `${DA}/shared-delivery-authority.helpers.ts`,
  `${CW}/shared-runtime/connected-worlds-shared.module.ts`,
  `${CW}/shared-runtime/shared-delivery.service.ts`,
  'database/migrations/0081_shared_private_source_state_v1.sql',
  'package.json',
  '.github/workflows/api-ci.yml',
  `${DA}/${SERVICE}`,
  `${DA}/${TYPES}`,
  'apps/api/src/connected-worlds/authority/standing-context-authority.ts',
  'database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql',
  'apps/api/src/conversation/i03f-forward-safety-probe.ts',
];

test('a later authorized addition never breaks this contract, and a real regression still does', { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, () => {
  const mirror = buildMirror();
  try {
    // The baseline. Every claim below is worthless if the untouched mirror does not already pass.
    assert.ok(runInMirror(mirror).ok, 'the untouched mirror must reproduce this contract exactly');

    // ---- authorized future work, applied together -------------------------------------------
    //
    // A real source-state adapter and a helper inside this very namespace (the file-count
    // ceiling); a Connected Worlds module and service that CONSUME the revalidator, which is
    // I-04's entire job (the domain-wide module ban and the "no other consumer" ban); and a
    // migration, its verifier registration and its CI step (the 0081 / verifier-name bans).
    write(mirror, `${DA}/shared-private-source-state-postgres-adapter.ts`,
      "import { Injectable } from '@nestjs/common';\n"
      + "import type { SharedPrivateSourceStateResolver } from './shared-private-source-state-resolver.types';\n\n"
      + '@Injectable()\n'
      + 'export class SharedPrivateSourceStatePostgresAdapter implements SharedPrivateSourceStateResolver {\n'
      + '  async resolveCurrent() {\n'
      + "    await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/resolve_shared_private_source_state_v1`);\n"
      + "    return { state: 'UNAVAILABLE' } as const;\n"
      + '  }\n'
      + '}\n');
    write(mirror, `${DA}/shared-delivery-authority.helpers.ts`, 'export const ordinalOf = (index: number): string => `#${index}`;\n');
    write(mirror, `${CW}/shared-runtime/shared-delivery.service.ts`,
      "import { Injectable } from '@nestjs/common';\n"
      + "import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';\n\n"
      + '@Injectable()\n'
      + 'export class SharedDeliveryService {\n'
      + '  constructor(private readonly revalidator: SharedDeliveryAuthorityRevalidatorService) {}\n'
      + '}\n');
    write(mirror, `${CW}/shared-runtime/connected-worlds-shared.module.ts`,
      "import { Module } from '@nestjs/common';\n"
      + "import { SharedDeliveryService } from './shared-delivery.service';\n\n"
      + '@Module({ providers: [SharedDeliveryService] })\n'
      + 'export class ConnectedWorldsSharedModule {}\n');
    write(mirror, 'database/migrations/0081_shared_private_source_state_v1.sql',
      '-- A hypothetical later migration owning its own object.\n'
      + 'CREATE TABLE public.shared_private_source_state_v1 (id uuid PRIMARY KEY);\n');
    patch(mirror, 'package.json',
      (text) => text.replace(`    "${OWN_SCRIPT}":`,
        '    "verify:shared-delivery-authority-source-state:integration": "node --env-file-if-exists=.env database/verify-migration-0081.mjs",\n'
        + `    "${OWN_SCRIPT}":`),
      'verify:shared-delivery-authority-source-state:integration');
    patch(mirror, '.github/workflows/api-ci.yml',
      (text) => text.replace(`      - {name: ${OWN_STEP}, run: npm run ${OWN_SCRIPT}}`,
        `      - {name: ${OWN_STEP}, run: npm run ${OWN_SCRIPT}}\n`
        + '      - {name: Verify Shared private source-state boundary against real PostgreSQL, run: npm run verify:shared-delivery-authority-source-state:integration}'),
      'verify:shared-delivery-authority-source-state:integration');

    const grown = runInMirror(mirror);
    assert.ok(grown.ok,
      'a later source-state adapter, a Connected Worlds module that consumes the revalidator, and a later migration '
      + `with its verifier and CI step are all authorized work, and none of them is this contract's business\n\n${grown.output}`);
  } finally {
    restore(mirror, ...SCENARIO_PATHS);
  }

  // ---- the other half: what must still be refused ------------------------------------------
  const refusals = [
    ['a source-disclosure detector in the revalidator', () => patch(mirror, `${DA}/${SERVICE}`,
      (text) => text.replace('    const outputDigest = digestProviderOutput(outputText);',
        "    if (outputText.includes('private')) return unresolved('MALFORMED_EFFECTIVE_CONTEXT');\n"
        + '    const outputDigest = digestProviderOutput(outputText);'),
      "outputText.includes('private')")],
    ['a transport opened inside the boundary', () => patch(mirror, `${DA}/${SERVICE}`,
      (text) => text.replace("import { createHash } from 'node:crypto';",
        "import { createHash } from 'node:crypto';\nconst probe = async () => fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/resolve_shared_world_pre_model_state_v1`);"),
      '/rest/v1/rpc/')],
    ['a delivery permission on the CURRENT result', () => patch(mirror, `${DA}/${TYPES}`,
      (text) => text.replace("  readonly authorityStatus: 'CURRENT';", "  readonly deliveryAllowed: true;\n  readonly authorityStatus: 'CURRENT';"),
      'deliveryAllowed')],
    ['an edit to the frozen I-03A evaluator', () => patch(mirror, 'apps/api/src/connected-worlds/authority/standing-context-authority.ts',
      (text) => text.replace("if (grant.status === 'REVOKED') return deny('GRANT_REVOKED');", "if (grant.status === 'REVOKED') return deny('GRANT_REVOKED'); // probe"),
      '// probe')],
    ['an edit to a frozen Connected Worlds migration', () => patch(mirror, 'database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql',
      (text) => `${text}\n-- probe\n`, '-- probe')],
    ['the boundary escaping into the Personal conversation runtime', () => write(mirror, 'apps/api/src/conversation/i03f-forward-safety-probe.ts',
      "import type { SharedDeliveryAuthorityRevalidation } from '../connected-worlds/delivery-authority/shared-delivery-authority.types';\n"
      + 'export type Probe = SharedDeliveryAuthorityRevalidation;\n')],
  ];
  for (const [reason, mutate] of refusals) {
    try {
      mutate();
      assert.equal(runInMirror(mirror).ok, false, `this contract must refuse ${reason}`);
    } finally {
      restore(mirror, ...SCENARIO_PATHS);
    }
  }

  // And the mirror is back to where it started, so the refusals above were real.
  assert.ok(runInMirror(mirror).ok, 'every mutation was reverted');
  rmSync(mirror, { recursive: true, force: true, maxRetries: 3 });
});
