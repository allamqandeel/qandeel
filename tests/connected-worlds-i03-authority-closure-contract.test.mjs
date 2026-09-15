// I-03 - Connected Worlds Authority / Consent / Effective Context Runtime: the
// final phase closure contract.
//
// The parent phase is a chain of seven slices, each merged under its own
// independent review:
//
//   A  authority law                 pure ALLOW / DENY / UNKNOWN evaluator
//   B  current grant resolution      one resolved grant per (grantor, World)
//   C  consent commands / history    append-only events + human self-authority
//   D  audience snapshot             the exact current human audience
//   E  EffectiveContext admission    PRE-model private admission
//   F  delivery authority revalidation   POST-generation freshness
//   G  Source Disclosure Gate + ordered privacy/authority readiness
//
// This file proves the phase-level properties no single slice's own spec can
// see: that the seven layers exist and stay separate, that admission happens
// before the model and disclosure/authority checking after generation, that the
// two I-03 gates run in the frozen CW2-02 §22 order, that nothing in the chain
// says an output may be delivered, that the direct-source disclosure detector is
// still abstract, that no Shared output persistence was smuggled in, that the
// Personal runtime stayed separate, and that no generic World permission engine
// appeared.
//
// ## What this contract refuses to claim
//
// It is a HISTORICAL contract, and I-03 is deliberately not the end of the road:
// I-04 owns the Shared conversation, output persistence and delivery/commit path;
// CW2-08 owns System / Safety and the Launch Gate; and CW2-02 §58 leaves the
// exact detector implementation to a later reviewed slice that is expected to
// write real matching code. So every assertion below is scoped to one of exactly
// three things:
//
//   (a) the files I-03G introduced, and the two registration lines it added;
//   (b) the merged predecessor files I-03G was required not to modify, pinned by
//       content hash - immutability of what exists, never a ban on additions;
//   (c) one permanent architectural boundary - a server-side Connected Worlds
//       authority gate never reaches the Personal runtime or a client - which is
//       the same claim the merged 0079, 0080 and I-03F contracts already make.
//
// There is no assertion of the form "X does not exist", "this directory contains
// exactly N files", "no migration after 0080 may exist", "no module may ever
// appear", "no detector implementation may ever appear" or "no consumer may ever
// import I-03G". Those are mutable-global ceilings: they were true when written
// and are guaranteed to become false the moment somebody does authorized work,
// and this repository has already paid for that mistake more than once.
//
// The last test proves the distinction the only way it can be proven. It mirrors
// the repository, performs EVERY authorized future addition at once - a real
// detector implementation, a Shared runtime module that consumes the readiness
// boundary, a Shared output persistence service, a System/Safety gate, a Launch
// Gate, a 0081 migration with its verifier and CI step - and requires this
// contract to still pass. Then it plants the regressions it must still refuse,
// so the forward safety is not bought by asserting nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarnessMirror, removeHarnessMirror } from './harness-temp-dir.mjs';

const rootPath = fileURLToPath(new URL('../', import.meta.url));
const SELF = 'connected-worlds-i03-authority-closure-contract.test.mjs';
/** Set in the child runs of the forward-safety probe, so the probe never recurses into itself. */
const PROBE_CHILD = 'QANDEEL_I03_CLOSURE_FORWARD_SAFETY_CHILD';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const gitBlobId = (content) => {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};
const stripTsComments = (ts) => ts
  .replace(/\/\*[\s\S]*?\*\//gu, '')
  .replace(/^[ \t]*\/\/.*$/gmu, '')
  .replace(/[ \t]\/\/[^'"\n]*$/gmu, '');

const CW = '../apps/api/src/connected-worlds/';

/** The seven layers of I-03, by the production file that carries each one's law. */
const LAYERS = {
  A_LAW: 'authority/standing-context-authority.ts',
  A_TYPES: 'authority/standing-context-authority.types.ts',
  B_GRANTS: 'authority-resolution/standing-context-grant-resolver.service.ts',
  D_AUDIENCE: 'audience/shared-human-audience-resolver.service.ts',
  D_TYPES: 'audience/shared-human-audience-resolution.types.ts',
  E_ADMISSION: 'effective-context/shared-effective-context.service.ts',
  E_TYPES: 'effective-context/shared-effective-context.types.ts',
  E_WORLD: 'effective-context/shared-pre-model-world-state-resolver.service.ts',
  F_REVALIDATOR: 'delivery-authority/shared-delivery-authority-revalidator.service.ts',
  F_TYPES: 'delivery-authority/shared-delivery-authority.types.ts',
  F_SOURCE_STATE: 'delivery-authority/shared-private-source-state-resolver.types.ts',
  G_TYPES: 'source-disclosure/shared-source-disclosure.types.ts',
  G_DETECTOR: 'source-disclosure/shared-source-disclosure-detector.types.ts',
  G_GATE: 'source-disclosure/shared-source-disclosure-gate.service.ts',
  G_READINESS: 'source-disclosure/shared-privacy-authority-delivery-readiness.service.ts',
};

/** The four production files I-03G itself introduced. Every I-03G-specific ban below is scoped to these. */
const G_PRODUCTION = [LAYERS.G_TYPES, LAYERS.G_DETECTOR, LAYERS.G_GATE, LAYERS.G_READINESS];
const G_SPECS = [
  'source-disclosure/shared-source-disclosure-gate.service.spec.ts',
  'source-disclosure/shared-privacy-authority-delivery-readiness.service.spec.ts',
];
/** Every production file of the I-03 chain. Each is either pinned below or introduced by I-03G. */
const CHAIN = Object.values(LAYERS);

const source = Object.fromEntries(CHAIN.map((name) => [name, read(`${CW}${name}`)]));
const code = Object.fromEntries(CHAIN.map((name) => [name, stripTsComments(source[name])]));
const packageJson = read('../package.json');
const workflow = read('../.github/workflows/api-ci.yml');

const apiSrc = new URL('../apps/api/src/', import.meta.url);
const apiFiles = readdirSync(apiSrc, { recursive: true }).map(String).filter((name) => /\.(?:ts|js|mjs)$/u.test(name));

/** The I-03G registration: a Node-only static gate, deliberately not a database verifier. */
const OWN_SCRIPT = 'test:connected-worlds-i03-authority-closure-contract';
const OWN_STEP = 'Verify Connected Worlds I-03 authority / consent / EffectiveContext phase closure contract (I-03G)';

/** Anything that would read as permission to deliver, publish or disclose. */
const DELIVERY_PERMISSION = /deliveryAllowed|publishAllowed|materialDisclosureAllowed|canDeliver|mayDeliver|allowDelivery|commitReady|approvedForDelivery/u;
const PERMISSION_ENGINE = /\bcan[A-Z]\w*\(|\bmay[A-Z]\w*\(|isAuthorized|checkPermission|hasPermission|evaluatePolicy|PolicyEngine|PermissionEngine|AbilityBuilder|\bcasl\b/u;

// ---------------------------------------------------------------------------

test('the seven I-03 layers exist as separate namespaces, and each one depends only downward', () => {
  for (const name of [...CHAIN, ...G_SPECS]) {
    assert.ok(existsSync(new URL(`${CW}${name}`, import.meta.url)), `${name} is part of the merged I-03 chain`);
  }
  // The dependency direction of the chain, asserted on the files themselves.
  // Each entry is a file and the namespaces it may NOT reach upward into.
  const imports = (name) => [...new Set([...code[name].matchAll(/^import\b[^;]*?\bfrom '([^']+)';/gmu)].map((match) => match[1]))].sort();
  const upward = {
    [LAYERS.A_LAW]: /authority-resolution|audience\/|effective-context|delivery-authority|source-disclosure/u,
    [LAYERS.A_TYPES]: /authority-resolution|audience\/|effective-context|delivery-authority|source-disclosure/u,
    [LAYERS.B_GRANTS]: /effective-context|delivery-authority|source-disclosure/u,
    [LAYERS.D_AUDIENCE]: /effective-context|delivery-authority|source-disclosure/u,
    [LAYERS.E_ADMISSION]: /delivery-authority|source-disclosure/u,
    [LAYERS.E_TYPES]: /delivery-authority|source-disclosure/u,
    [LAYERS.F_REVALIDATOR]: /source-disclosure/u,
    [LAYERS.F_TYPES]: /source-disclosure/u,
  };
  for (const [name, forbidden] of Object.entries(upward)) {
    for (const specifier of imports(name)) {
      assert.doesNotMatch(specifier, forbidden, `${name} does not depend upward on ${specifier}`);
    }
  }
  // And I-03G composes the layers below it rather than reimplementing them.
  assert.deepEqual(imports(LAYERS.G_TYPES), [], 'the I-03G result vocabulary is self-contained');
  assert.deepEqual(imports(LAYERS.G_DETECTOR), ['../effective-context/shared-effective-context.types'], 'the detector contract borrows only the frozen source reference');
  for (const needed of [
    "import { digestReasoningContent, fingerprintSharedEffectiveContext } from '../effective-context/shared-effective-context.service';",
    "import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';",
  ]) {
    assert.ok(code[LAYERS.G_GATE].includes(needed), `the gate reuses the frozen helper: ${needed}`);
  }
  assert.ok(code[LAYERS.G_READINESS].includes("import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';"));
  assert.ok(code[LAYERS.G_READINESS].includes("import { SharedSourceDisclosureGateService } from './shared-source-disclosure-gate.service';"));
  // No competing digest or fingerprint semantics were invented anywhere in G.
  for (const name of G_PRODUCTION) {
    assert.doesNotMatch(code[name], /QANDEEL_CWV2_SHARED_EFFECTIVE_CONTEXT|QANDEEL_CWV2_SHARED_DELIVERY_AUTHORITY|QANDEEL_CWV2_SHARED_HUMAN_AUDIENCE|QANDEEL_CWV2_SHARED_PRE_MODEL/u,
      `${name} does not re-declare a predecessor's fingerprint version`);
  }
});

test('Context Admission is pre-model, and the Source Disclosure Gate is post-generation', () => {
  // I-03E decides eligibility from candidates and World/audience state. It never
  // sees an output, a provider response or an output digest: post-generation
  // filtering is explicitly NOT the privacy boundary (I-00 §7, R2).
  assert.match(code[LAYERS.E_ADMISSION], /async resolve\(targetWorldId: SharedWorldId, candidates: ReadonlyArray<SharedPrivateContextCandidate>\)/u);
  for (const name of [LAYERS.E_ADMISSION, LAYERS.E_TYPES]) {
    assert.doesNotMatch(code[name], /outputText|outputDigest|digestProviderOutput|providerOutput/u, `${name} is pre-model and knows nothing about an output`);
  }
  // Every admitted item leaves I-03E carrying exactly the frozen I-03A ALLOW
  // branch, whose delivery position is REQUIRES_REVALIDATION - so a pre-model
  // admission can never be read as delivery authority (CW2-02 §6-§8, B7).
  assert.match(code[LAYERS.E_TYPES], /Extract<StandingContextAuthorityDecision, \{ readonly decision: 'ALLOW' \}>/u);
  assert.match(code[LAYERS.A_TYPES], /readonly deliveryAuthority: 'REQUIRES_REVALIDATION';/u);
  assert.match(code[LAYERS.E_TYPES], /readonly authority: StandingContextAllowDecision;/u);

  // I-03F and I-03G are post-generation: both take the exact output bytes.
  assert.match(code[LAYERS.F_REVALIDATOR], /async revalidate\(effectiveContext: SharedEffectiveContext, outputText: string\)/u);
  assert.match(code[LAYERS.G_GATE], /async evaluate\(effectiveContext: SharedEffectiveContext, outputText: string\)/u);
  assert.match(code[LAYERS.G_READINESS], /async evaluate\(effectiveContext: SharedEffectiveContext, outputText: string\)/u);
  // Both bind that output through ONE digest definition, so the two gates can
  // never disagree about which bytes they judged.
  assert.match(code[LAYERS.F_REVALIDATOR], /createHash\('sha256'\)\.update\(outputText, 'utf8'\)/u);
  assert.doesNotMatch(code[LAYERS.G_GATE], /createHash\('sha256'\)\.update\(outputText/u, 'I-03G reuses the frozen output digest rather than defining a second one');
  assert.ok(code[LAYERS.G_GATE].includes('const outputDigest = digestProviderOutput(outputText);'));
});

test('authority revalidation follows the Source Disclosure Gate, and the two never run together', () => {
  const readiness = code[LAYERS.G_READINESS];
  const gateCall = readiness.indexOf('this.sourceDisclosure.evaluate(');
  const authorityCall = readiness.indexOf('this.authority.revalidate(');
  assert.ok(gateCall > 0 && authorityCall > 0, 'the readiness boundary calls both gates');
  assert.ok(gateCall < authorityCall, 'the Source Disclosure Gate is entered first (CW2-02 §22)');
  assert.equal((readiness.match(/this\.sourceDisclosure\.evaluate\(/gu) ?? []).length, 1, 'exactly one Source Disclosure Gate call site');
  assert.equal((readiness.match(/this\.authority\.revalidate\(/gu) ?? []).length, 1, 'exactly one authority revalidation call site');
  // Both stop conditions are decided before the second gate is reachable.
  for (const guard of ["disclosure.state === 'BLOCKED'", "disclosure.state === 'UNRESOLVED'"]) {
    assert.ok(readiness.includes(guard), `the readiness boundary stops on ${guard}`);
    assert.ok(readiness.indexOf(guard) < authorityCall, `${guard} is decided before authority is revalidated`);
  }
  // An ordered sequence, never a set: no combinator that could start both.
  assert.doesNotMatch(readiness, /Promise\.all|Promise\.allSettled|Promise\.race|Promise\.any/u, 'the two gates are never raced or parallelised');
  // The exact same envelope object and the exact same bytes reach both.
  assert.ok(readiness.includes('await this.sourceDisclosure.evaluate(effectiveContext, outputText)'));
  assert.ok(readiness.includes('await this.authority.revalidate(effectiveContext, outputText)'));
  assert.ok(readiness.includes("if (revalidation.effectiveContextRef !== gate.effectiveContextRef) return OPERATION_BINDING_MISMATCH;"));
  assert.ok(readiness.includes("if (revalidation.outputDigest !== gate.outputDigest) return OPERATION_BINDING_MISMATCH;"));
});

test('nothing in the I-03 chain says an output may be delivered: CURRENT, CLEAR and READY are all preconditions', () => {
  // What each terminal result structurally states.
  assert.match(code[LAYERS.F_TYPES], /readonly authorityStatus: 'CURRENT';/u);
  assert.match(code[LAYERS.F_TYPES], /readonly sourceDisclosureAuthority: 'NOT_EVALUATED';/u);
  assert.match(code[LAYERS.F_TYPES], /readonly systemSafetyAuthority: 'NOT_EVALUATED';/u);
  assert.match(code[LAYERS.F_TYPES], /readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';/u);
  assert.match(code[LAYERS.G_TYPES], /readonly sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED';/u);
  assert.match(code[LAYERS.G_TYPES], /readonly systemSafetyStatus: 'NOT_EVALUATED';/u);
  assert.match(code[LAYERS.G_TYPES], /readonly launchGateStatus: 'NOT_EVALUATED';/u);
  assert.match(code[LAYERS.G_TYPES], /readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';/u);
  assert.match(code[LAYERS.G_TYPES], /state: 'READY_FOR_LATER_DELIVERY_GATES'/u);
  // The three frozen no-disclosure positions are restated unchanged at every
  // layer that carries them, and widened at none (CW2-02 §19, §24, §25, B15-B18).
  for (const name of [LAYERS.A_TYPES, LAYERS.F_TYPES, LAYERS.G_TYPES]) {
    assert.match(code[name], /readonly directPrivateDisclosureAuthority: 'NOT_GRANTED';/u, `${name} keeps direct private disclosure NOT_GRANTED`);
    assert.match(code[name], /readonly materialDisclosureAuthority: 'NOT_GRANTED';/u, `${name} keeps material disclosure NOT_GRANTED`);
    assert.match(code[name], /readonly provenanceDisclosure: 'SEALED';/u, `${name} keeps provenance SEALED`);
  }
  // And no layer of the chain can represent a delivery, publication or explicit
  // disclosure permission at all.
  for (const name of CHAIN) {
    assert.doesNotMatch(code[name], DELIVERY_PERMISSION, `${name} grants no delivery or publication permission`);
    assert.doesNotMatch(code[name], /'DISCLOSE_PRIVATE_FACT'|'EXPLICIT_DISCLOSURE'|'QUOTE_PERMISSION'|'MATERIAL_TRANSFER'|'PUBLICATION'|'REPLAY_DISTRIBUTION'|'HISTORY_ACCESS'/u,
      `${name} invents no explicit-disclosure lane`);
    assert.doesNotMatch(code[name], PERMISSION_ENGINE, `${name} is not a generic World permission engine`);
  }
});

test('the direct-source disclosure detector is a contract, and I-03G implements none of it', () => {
  // CW2-02 §58 defers the mechanism. I-03G names the four frozen categories and
  // the seam, and chooses no algorithm.
  for (const category of ['PRIVATE_QUOTE', 'DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION', 'SEALED_PROVENANCE_DISCLOSURE']) {
    assert.ok(code[LAYERS.G_DETECTOR].includes(`'${category}'`), `${category} is one of the four frozen classes`);
  }
  assert.match(code[LAYERS.G_DETECTOR], /export interface SharedSourceDisclosureDetector \{\s*assess\(request: SharedSourceDisclosureDetectionRequest\): Promise<SharedSourceDisclosureDetectorAssessment>;\s*\}/u);
  assert.match(code[LAYERS.G_DETECTOR], /export const SHARED_SOURCE_DISCLOSURE_DETECTOR = 'SHARED_SOURCE_DISCLOSURE_DETECTOR' as const;/u);
  // Scoped to the four files I-03G introduced, and to nothing else: a later
  // reviewed slice is expected to write a real implementation, which will
  // legitimately match most of these patterns.
  for (const name of G_PRODUCTION) {
    for (const pattern of [
      /outputText\.(?:includes|indexOf|match|search|slice|split|substring|replace|toLowerCase|toUpperCase|normalize|startsWith|endsWith)/u,
      /\bquote\b|quoting|verbatim|excerpt|snippet|paraphras/iu,
      /redact|scrub|sanitizeOutput|rewriteOutput|summari[sz]e|rerank/iu,
      /similar|threshold|embedding|cosine|jaccard|levenshtein|ngram|n-gram|tokeniz|vector/iu,
      /sourceDisclosureSafe|disclosureSafe|declaredSafe|providerAsserts|selfDeclar|clientAsserts/iu,
      /model-router|ModelRouter|openai|anthropic|\bprompt\b|completion/iu,
      /'SAFE'|'UNSAFE'|isSafe|markSafe/u,
      /\bimplements SharedSourceDisclosureDetector\b/u,
    ]) {
      assert.doesNotMatch(code[name], pattern, `${name} chooses no detection mechanism`);
    }
  }
  // The gate's ONE detector call site, and the output used for nothing else.
  assert.equal((code[LAYERS.G_GATE].match(/this\.detector\.assess\(/gu) ?? []).length, 1);
  assert.equal((code[LAYERS.G_GATE].match(/\boutputText\b/gu) ?? []).length, 4, 'the output is typed, digested and handed over - and never inspected');
  // A detection is never triaged by category, and the blocked result hides them.
  assert.match(code[LAYERS.G_GATE], /if \(detected\) return Object\.freeze\(\{ kind: 'DETECTED' \} as const\);/u);
  assert.match(code[LAYERS.G_TYPES], /SHARED_SOURCE_DISCLOSURE_BLOCK_REASON = 'PROTECTED_SOURCE_DISCLOSURE_DETECTED' as const;/u);
  // Private context existing is never itself a block: the only BLOCKED path runs
  // through a validated, exactly bound assessment.
  assert.equal((code[LAYERS.G_GATE].match(/return blocked\(\);/gu) ?? []).length, 1);
});

test('no Shared output, material or provenance persistence was smuggled into I-03, and no provider was called', () => {
  for (const name of CHAIN) {
    for (const pattern of [
      /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE)\s+(?:INTO|TABLE|FUNCTION|POLICY|ROLE|INDEX|FROM|SET)\b/u,
      /persist|outbox|writeAudit|auditEvent|\.save\(|\brepository\b|entityManager|knex|prisma/iu,
      /QANDEEL_OUTPUT|QANDEEL_ANALYSIS|MATERIAL_DEPENDENCY|REASONING_DEPENDENCY|SEALED_PROVENANCE_DEPENDENCY|ProvenanceRecord|ReplayArtifact|HistoryAccessGrant/u,
      /model-router|ModelRouter|intelligence-runtime|conversation\/|ContextBudget|invokeProvider/u,
    ]) {
      assert.doesNotMatch(code[name], pattern, `${name} persists nothing and invokes no provider`);
    }
  }
  // The two resolvers that DO reach PostgreSQL read exactly one RPC each and
  // mutate nothing; that is their own merged contract's proof, and the only
  // thing asserted here is that no OTHER layer of the chain learned to write.
  for (const name of [LAYERS.E_ADMISSION, LAYERS.F_REVALIDATOR, ...G_PRODUCTION]) {
    assert.doesNotMatch(code[name], /\bfetch\(|globalThis\.fetch|new Pool\(|require\('pg'\)|SUPABASE|SERVICE_ROLE|\/rest\/v1\//u,
      `${name} opens no transport of its own`);
  }
  // Deterministic by construction: no clock, no random identity, no secret
  // anywhere in the composition layers.
  for (const name of [LAYERS.A_LAW, LAYERS.E_ADMISSION, LAYERS.F_REVALIDATOR, ...G_PRODUCTION]) {
    assert.doesNotMatch(code[name], /randomUUID|Math\.random|Date\.now|new Date\(|performance\.now/u, `${name} uses no clock or random identity`);
  }
});

test('the I-03 authority stack stays server-side, inside Connected Worlds, and never reaches the Personal runtime or a client', () => {
  // A boundary rule, not a temporary absence: the merged 0079, 0080 and I-03F
  // contracts already make exactly this claim for their own boundaries. It
  // deliberately does NOT say "only this namespace may consume I-03G" - I-04 is
  // the expected first consumer, and the probe below proves that is allowed.
  const NAMES = /SharedSourceDisclosure|SharedPrivacyAuthorityDeliveryReadiness|SharedDeliveryAuthority|SharedEffectiveContext|StandingContextAuthority|connected-worlds\/source-disclosure/u;
  const outside = apiFiles.filter((name) => !name.startsWith('connected-worlds') && NAMES.test(readFileSync(new URL(name, apiSrc), 'utf8')));
  assert.deepEqual(outside, [], 'no API file outside Connected Worlds names an I-03 authority boundary: no conversation, model-router, intelligence-runtime, memory or controller wiring');

  const mobileSrc = new URL('../apps/mobile/src/', import.meta.url);
  if (existsSync(mobileSrc)) {
    const mobile = readdirSync(mobileSrc, { recursive: true }).map(String)
      .filter((name) => /\.(?:ts|tsx)$/u.test(name) && NAMES.test(readFileSync(new URL(name, mobileSrc), 'utf8')));
    assert.deepEqual(mobile, [], 'a server-side privacy/authority boundary never reaches a client');
  }
  // No layer of the chain exposes an HTTP, route, gateway or DTO surface of its own.
  for (const name of G_PRODUCTION) {
    assert.doesNotMatch(code[name], /@Controller|@Get\(|@Post\(|@Put\(|@Patch\(|@Delete\(|@Module|@WebSocketGateway|@SubscribeMessage|\bexpress\b|RouterModule|NestFactory|createParamDecorator|\.dto\b/u,
      `${name} opens no route and registers no module`);
  }
  // Exactly two injectable services and one injected contract across everything
  // I-03G introduced. Nothing here registers either of them anywhere.
  assert.equal(G_PRODUCTION.reduce((total, name) => total + (code[name].match(/@Injectable\(\)/gu) ?? []).length, 0), 2);
  assert.equal(G_PRODUCTION.reduce((total, name) => total + (code[name].match(/@Inject\(/gu) ?? []).length, 0), 1);
  for (const name of [LAYERS.G_TYPES, LAYERS.G_DETECTOR]) {
    assert.doesNotMatch(code[name], /@Injectable|@Inject\(|@Module/u, `${name} is vocabulary only`);
  }
});

test('every result vocabulary in the chain is a bounded internal class that leaks no per-owner consent or source fact', () => {
  const bounded = [
    // I-03F
    'WORLD_STATE_CHANGED', 'WORLD_READ_ONLY_CLOSED', 'AUDIENCE_CHANGED', 'NO_ACTIVE_HUMANS', 'PRIVATE_AUTHORITY_CHANGED', 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE',
    'MALFORMED_EFFECTIVE_CONTEXT', 'WORLD_STATE_UNRESOLVED', 'AUDIENCE_UNRESOLVED', 'PRIVATE_AUTHORITY_UNRESOLVED', 'PRIVATE_SOURCE_STATE_UNRESOLVED',
    // I-03G
    'MALFORMED_GENERATION_ARTIFACT', 'DETECTOR_UNRESOLVED', 'DETECTOR_BINDING_MISMATCH', 'PROTECTED_SOURCE_DISCLOSURE_DETECTED',
    'SOURCE_DISCLOSURE_BLOCKED', 'AUTHORITY_STALE', 'SOURCE_DISCLOSURE_UNRESOLVED', 'AUTHORITY_UNRESOLVED', 'OPERATION_BINDING_MISMATCH',
  ];
  for (const reason of bounded) {
    assert.doesNotMatch(reason, /REVOKED|DENIED|OWNER_|PARTICIPANT|GRANT_ID|COUNTERPART|HUMAN_|CONTEXT_ID/u, `${reason} names a class, not a person or a consent state`);
  }
  for (const reason of bounded.slice(11)) {
    assert.ok(`${code[LAYERS.G_TYPES]}`.includes(`'${reason}'`), `${reason} is part of the I-03G vocabulary`);
  }
  // No internal reason class from a lower layer escapes into an I-03G result.
  for (const leaked of ['GRANT_REVOKED', 'NO_STANDING_CONTEXT_GRANT', 'GRANTOR_MISMATCH', 'AUDIENCE_EXCEEDS_GRANT_CEILING', 'GRANT_STATE_UNRESOLVED', 'MALFORMED_GRANT_SNAPSHOT',
    'WORLD_STATE_CHANGED', 'AUDIENCE_CHANGED', 'PRIVATE_AUTHORITY_CHANGED', 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE']) {
    for (const name of G_PRODUCTION) {
      assert.doesNotMatch(code[name], new RegExp(`'${leaked}'`, 'u'), `${name} does not re-export a lower layer's internal reason`);
    }
  }
  // The readiness boundary borrows the frozen I-03F vocabularies instead of
  // re-spelling them, so the two can never drift apart.
  assert.ok(code[LAYERS.G_READINESS].includes('SHARED_DELIVERY_AUTHORITY_STALE_REASONS'));
  assert.ok(code[LAYERS.G_READINESS].includes('SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS'));
});

test('every merged predecessor source and Connected Worlds migration I-03G was required not to modify is byte-unchanged', () => {
  // Content pins on files that already existed. They prove immutability of the
  // merged I-03A - I-03F baseline and of migrations 0075-0080; they say nothing
  // at all about files that do not exist yet, so a later migration, detector
  // implementation, module or consumer is free to appear without touching this.
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
    ['../apps/api/src/connected-worlds/delivery-authority/shared-delivery-authority.types.ts', 'baeeef0250cdca250a0791161188c5838b52e9f0'],
    ['../apps/api/src/connected-worlds/delivery-authority/shared-private-source-state-resolver.types.ts', '5bcb3696c178370af2172a961efa043a7a0995ea'],
    ['../apps/api/src/connected-worlds/delivery-authority/shared-delivery-authority-revalidator.service.ts', 'e1a0bf22f53f1d51347cb125fb593c53c96c8114'],
    ['../database/migrations/0075_connected_worlds_shared_persistence_foundation_v1.sql', '3119d34a4edd4c934067393eb278077fd294852b'],
    ['../database/migrations/0076_shared_world_standing_context_grant_persistence_v1.sql', '3b2e1f35f1a7441ac09c482877294df5d42b9693'],
    ['../database/migrations/0077_shared_standing_context_grant_resolution_boundary_v1.sql', '2d14702f11fda7379d911e275c4e4c6ce1f6732d'],
    ['../database/migrations/0078_shared_standing_context_consent_commands_v1.sql', '9f5d169627b1b888ba1ddb1ab1151d1895eb07da'],
    ['../database/migrations/0079_shared_human_audience_snapshot_resolution_v1.sql', 'e3b3f6397d02a82e4f472da26795913b0b67ae7b'],
    ['../database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql', '1f66a6b0b0108ca79e9f44edc17ede9c87db8ef0'],
  ]) {
    assert.equal(gitBlobId(read(path)), blob, `${path} is byte-identical to its merged blob`);
  }
});

test('I-03G added no database boundary: its own files carry no SQL or transport, and its own registration is a Node-only static gate', () => {
  // A positive statement about the ONE script and the ONE workflow step this
  // slice registered. It neither counts the scripts in the manifest nor forbids
  // a later slice from registering a database verifier of its own.
  assert.match(packageJson, new RegExp(`"${OWN_SCRIPT}": "node --test tests/${SELF.replace(/\./gu, '\\.')}"`, 'u'),
    'the I-03G script is a Node-only static contract, not a database verifier');
  assert.equal((workflow.match(new RegExp(OWN_SCRIPT, 'gu')) ?? []).length, 1, 'the I-03G gate is registered exactly once in API CI');
  assert.ok(workflow.includes(`{name: ${OWN_STEP}, run: npm run ${OWN_SCRIPT}}`), 'the I-03G CI step runs exactly that gate');
  assert.doesNotMatch(workflow.slice(workflow.indexOf(OWN_STEP), workflow.indexOf(OWN_STEP) + 200), /--env-file|database\/verify-migration/u,
    'the I-03G step needs no database');
  // The six I-03G specs and production files prove behaviour against fakes: no
  // transport, no RPC name, no real detector.
  for (const name of G_SPECS) {
    const spec = stripTsComments(read(`${CW}${name}`));
    assert.doesNotMatch(spec, /\bfetch\(|globalThis\.fetch|new Pool\(|require\('pg'\)|resolve_shared_world_\w+/u, `${name} opens no transport and names no RPC`);
  }
  assert.match(stripTsComments(read(`${CW}${G_SPECS[0]}`)), /const detector: SharedSourceDisclosureDetector = \{/u,
    'the detector dependency is faked in tests, not implemented');
});

test('the contract is not vacuous: the files it asserts over are real, substantial and really comment-stripped', () => {
  for (const name of CHAIN) {
    assert.ok(code[name].length > 400, `${name} has substantial executable source`);
    assert.ok(source[name].length > code[name].length, `${name} really was comment-stripped`);
  }
  for (const name of G_SPECS) {
    assert.ok(read(`${CW}${name}`).length > 15000, `${name} is a substantial behavioural spec`);
  }
  // The seven layers are seven distinct namespaces, not one file wearing seven names.
  assert.equal(new Set(CHAIN.map((name) => name.split('/')[0])).size, 6, 'six Connected Worlds namespaces carry the chain (I-03C is a database boundary)');
  // And the comment-only phrasing really was stripped, so the bans above were
  // answered by executable code rather than by prose.
  assert.ok(!code[LAYERS.G_GATE].includes('LLM-as-judge'));
  assert.ok(source[LAYERS.G_GATE].includes('LLM-as-judge'));
});

// ---------------------------------------------------------------------------------------------
// Forward safety, proven rather than asserted.
//
// I-03 closing does not close Connected Worlds. The only honest way to show that this contract is
// a record of what I-03 DID, rather than a ceiling on what may follow, is to build the repository
// several authorized steps into its future and require this contract to still pass - and then to
// plant the regressions it must still refuse, so the forward safety is not bought by asserting
// nothing.
// ---------------------------------------------------------------------------------------------

/** Only the paths this contract actually reads. Copying the whole tree would cost seconds for nothing. */
const MIRRORED = ['apps/api/src', 'apps/mobile/src', 'database/migrations', '.github/workflows/api-ci.yml', 'package.json',
  `tests/${SELF}`, 'tests/harness-temp-dir.mjs'];
const SKIP = /(?:^|[\\/])(?:node_modules|\.git|\.expo|\.turbo|coverage)(?:[\\/]|$)/u;

function buildMirror() {
  const mirror = createHarnessMirror('qandeel-i03-closure-');
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
  // The child never stands in the mirror: that is the handle that used to block its removal.
  const result = spawnSync(process.execPath, ['--test', join(mirror, 'tests', SELF)],
    { cwd: mirror, encoding: 'utf8', env });
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

const API = 'apps/api/src';
const CWD = `${API}/connected-worlds`;
const SD = `${CWD}/source-disclosure`;
/** Paths every scenario below may touch, restored after each one. */
const SCENARIO_PATHS = [
  `${SD}/shared-source-disclosure-detector.adapter.ts`,
  `${SD}/shared-source-disclosure.helpers.ts`,
  `${CWD}/shared-runtime/connected-worlds-shared.module.ts`,
  `${CWD}/shared-runtime/shared-delivery.service.ts`,
  `${CWD}/shared-runtime/shared-output-persistence.service.ts`,
  `${CWD}/system-safety/shared-system-safety-gate.service.ts`,
  `${CWD}/launch/shared-launch-gate.service.ts`,
  'database/migrations/0081_shared_source_disclosure_assessments_v1.sql',
  'package.json',
  '.github/workflows/api-ci.yml',
  `${SD}/shared-source-disclosure-gate.service.ts`,
  `${SD}/shared-source-disclosure.types.ts`,
  `${SD}/shared-privacy-authority-delivery-readiness.service.ts`,
  `${CWD}/authority/standing-context-authority.ts`,
  'database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql',
  `${API}/conversation/i03-closure-forward-safety-probe.ts`,
];

test('every authorized continuation of I-03 leaves this contract passing, and a real regression still breaks it', { skip: process.env[PROBE_CHILD] === '1' ? 'inner probe run' : false }, (t) => {
  const mirror = buildMirror();
  // Registered the moment the mirror exists, so no path out of this test - including a failed
  // assertion in the refusals below - can leave the tree behind.
  t.after(() => removeHarnessMirror(mirror));
  try {
    // The baseline. Every claim below is worthless if the untouched mirror does not already pass.
    assert.ok(runInMirror(mirror).ok, 'the untouched mirror must reproduce this contract exactly');

    // ---- authorized future work, applied together -------------------------------------------
    //
    // A REAL detector implementation: it does exactly the string matching, thresholding and
    // transport this slice was forbidden to choose, because choosing it was deferred to a slice
    // that is reviewed for it - not forbidden forever (CW2-02 §58; task §56).
    write(mirror, `${SD}/shared-source-disclosure-detector.adapter.ts`,
      "import { Injectable } from '@nestjs/common';\n"
      + "import type { SharedSourceDisclosureDetectionRequest, SharedSourceDisclosureDetector } from './shared-source-disclosure-detector.types';\n\n"
      + '@Injectable()\n'
      + 'export class SharedSourceDisclosureDetectorAdapter implements SharedSourceDisclosureDetector {\n'
      + '  async assess(request: SharedSourceDisclosureDetectionRequest) {\n'
      + '    const threshold = 0.82;\n'
      + '    const quoted = request.protectedSources.some((entry) => request.outputText.includes(entry.reasoningContent.slice(0, 40)));\n'
      + "    await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/score_source_disclosure_similarity_v1`);\n"
      + "    return quoted && threshold > 0 ? { state: 'DETECTED' as const, assessmentRef: 'a', detectorPolicyRef: 'p', binding: { effectiveContextRef: request.effectiveContextRef, outputDigest: request.outputDigest, protectedSourceSetRef: request.protectedSourceSetRef }, findings: ['PRIVATE_QUOTE' as const] }\n"
      + "      : { state: 'CLEAR' as const, assessmentRef: 'a', detectorPolicyRef: 'p', binding: { effectiveContextRef: request.effectiveContextRef, outputDigest: request.outputDigest, protectedSourceSetRef: request.protectedSourceSetRef } };\n"
      + '  }\n'
      + '}\n');
    write(mirror, `${SD}/shared-source-disclosure.helpers.ts`, 'export const ordinalOf = (index: number): string => `#${index}`;\n');
    // I-04: a Connected Worlds Shared runtime module and a service that CONSUMES the readiness
    // boundary, plus the Shared output persistence I-03 deliberately did not write.
    write(mirror, `${CWD}/shared-runtime/shared-delivery.service.ts`,
      "import { Injectable } from '@nestjs/common';\n"
      + "import { SharedPrivacyAuthorityDeliveryReadinessService } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';\n\n"
      + '@Injectable()\n'
      + 'export class SharedDeliveryService {\n'
      + '  constructor(private readonly readiness: SharedPrivacyAuthorityDeliveryReadinessService) {}\n'
      + '}\n');
    write(mirror, `${CWD}/shared-runtime/shared-output-persistence.service.ts`,
      "import { Injectable } from '@nestjs/common';\n\n"
      + '@Injectable()\n'
      + 'export class SharedOutputPersistenceService {\n'
      + '  async commit(outputText: string) {\n'
      + "    await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/commit_shared_output_v1`, { body: outputText });\n"
      + '  }\n'
      + '}\n');
    write(mirror, `${CWD}/shared-runtime/connected-worlds-shared.module.ts`,
      "import { Module } from '@nestjs/common';\n"
      + "import { SharedDeliveryService } from './shared-delivery.service';\n\n"
      + '@Module({ providers: [SharedDeliveryService] })\n'
      + 'export class ConnectedWorldsSharedModule {}\n');
    // CW2-08: the System / Safety and Launch gates that come AFTER I-03's two.
    write(mirror, `${CWD}/system-safety/shared-system-safety-gate.service.ts`,
      "import { Injectable } from '@nestjs/common';\n\n"
      + '@Injectable()\n'
      + 'export class SharedSystemSafetyGateService {\n'
      + "  evaluatePolicy(): 'ALLOW' | 'DENY' { return 'ALLOW'; }\n"
      + '}\n');
    write(mirror, `${CWD}/launch/shared-launch-gate.service.ts`,
      "import { Injectable } from '@nestjs/common';\n\n"
      + '@Injectable()\n'
      + 'export class SharedLaunchGateService {\n'
      + '  canDeliver(): boolean { return true; }\n'
      + '}\n');
    write(mirror, 'database/migrations/0081_shared_source_disclosure_assessments_v1.sql',
      '-- A hypothetical later migration owning its own object.\n'
      + 'CREATE TABLE public.shared_source_disclosure_assessments_v1 (id uuid PRIMARY KEY);\n');
    patch(mirror, 'package.json',
      (text) => text.replace(`    "${OWN_SCRIPT}":`,
        '    "verify:shared-source-disclosure-assessments:integration": "node --env-file-if-exists=.env database/verify-migration-0081.mjs",\n'
        + `    "${OWN_SCRIPT}":`),
      'verify:shared-source-disclosure-assessments:integration');
    patch(mirror, '.github/workflows/api-ci.yml',
      (text) => text.replace(`      - {name: ${OWN_STEP}, run: npm run ${OWN_SCRIPT}}`,
        `      - {name: ${OWN_STEP}, run: npm run ${OWN_SCRIPT}}\n`
        + '      - {name: Verify Shared source-disclosure assessment persistence against real PostgreSQL, run: npm run verify:shared-source-disclosure-assessments:integration}'),
      'verify:shared-source-disclosure-assessments:integration');

    const grown = runInMirror(mirror);
    assert.ok(grown.ok,
      'a real detector implementation, a Connected Worlds module and consumer, Shared output persistence, a System/Safety gate, '
      + `a Launch Gate and a later migration with its verifier and CI step are all authorized work, and none of them is this contract's business\n\n${grown.output}`);
  } finally {
    restore(mirror, ...SCENARIO_PATHS);
  }

  // ---- the other half: what must still be refused ------------------------------------------
  const refusals = [
    ['a client-declared clearance trusted by the gate', () => patch(mirror, `${SD}/shared-source-disclosure-gate.service.ts`,
      (text) => text.replace('    const outputDigest = digestProviderOutput(outputText);',
        '    const claimed = (effectiveContext as unknown as { sourceDisclosureSafe?: boolean }).sourceDisclosureSafe;\n'
        + '    const outputDigest = digestProviderOutput(outputText);'),
      'sourceDisclosureSafe')],
    ['a detection mechanism chosen inside I-03G', () => patch(mirror, `${SD}/shared-source-disclosure-gate.service.ts`,
      (text) => text.replace('    const outputDigest = digestProviderOutput(outputText);',
        "    if (artifact.items.some((entry) => outputText.includes(entry.reasoningContent))) return blocked();\n"
        + '    const outputDigest = digestProviderOutput(outputText);'),
      'outputText.includes(')],
    ['a delivery permission introduced into READY', () => patch(mirror, `${SD}/shared-source-disclosure.types.ts`,
      (text) => text.replace("  readonly authorityStatus: 'CURRENT';", "  readonly deliveryAllowed: true;\n  readonly authorityStatus: 'CURRENT';"),
      'deliveryAllowed')],
    ['Shared output committed inside I-03G', () => patch(mirror, `${SD}/shared-privacy-authority-delivery-readiness.service.ts`,
      (text) => text.replace("    return Object.freeze({ state: 'READY_FOR_LATER_DELIVERY_GATES', readiness } as const);",
        '    await this.repository.save(outputText);\n'
        + "    return Object.freeze({ state: 'READY_FOR_LATER_DELIVERY_GATES', readiness } as const);"),
      'this.repository.save(')],
    ['a Model Router or provider call inside I-03G', () => patch(mirror, `${SD}/shared-source-disclosure-gate.service.ts`,
      (text) => text.replace("import { createHash } from 'node:crypto';",
        "import { createHash } from 'node:crypto';\nimport { ModelRouterService } from '../../model-router/model-router.service';"),
      'ModelRouterService')],
    ['I-03F reordered before the Source Disclosure Gate', () => patch(mirror, `${SD}/shared-privacy-authority-delivery-readiness.service.ts`,
      (text) => text.replace('    let disclosure: SharedSourceDisclosureGateResult;',
        '    const early = await this.authority.revalidate(effectiveContext, outputText);\n'
        + '    let disclosure: SharedSourceDisclosureGateResult;'),
      'const early = await this.authority.revalidate(')],
    ['the two gates raced instead of ordered', () => patch(mirror, `${SD}/shared-privacy-authority-delivery-readiness.service.ts`,
      (text) => text.replace('    let disclosure: SharedSourceDisclosureGateResult;',
        '    await Promise.all([Promise.resolve()]);\n'
        + '    let disclosure: SharedSourceDisclosureGateResult;'),
      'Promise.all(')],
    ['an edit to the frozen I-03A evaluator', () => patch(mirror, `${CWD}/authority/standing-context-authority.ts`,
      (text) => text.replace("if (grant.status === 'REVOKED') return deny('GRANT_REVOKED');", "if (grant.status === 'REVOKED') return deny('GRANT_REVOKED'); // probe"),
      '// probe')],
    ['an edit to a frozen Connected Worlds migration', () => patch(mirror, 'database/migrations/0080_shared_pre_model_world_state_resolution_v1.sql',
      (text) => `${text}\n-- probe\n`, '-- probe')],
    ['the Personal conversation runtime importing an I-03 authority boundary', () => write(mirror, `${API}/conversation/i03-closure-forward-safety-probe.ts`,
      "import type { SharedPrivacyAuthorityDeliveryReadiness } from '../connected-worlds/source-disclosure/shared-source-disclosure.types';\n"
      + 'export type Probe = SharedPrivacyAuthorityDeliveryReadiness;\n')],
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
});
