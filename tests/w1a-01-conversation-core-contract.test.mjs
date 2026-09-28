import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// W1A-01 — Authenticated Personal Conversation Core (E2E-B-03, E2E-B-04, E2E-B-07). Static contract.
//
// The Jest suites prove the BEHAVIOUR: the send / retry / history rules, the speaker sides and
// paragraph direction, the accessible names, the depth switch and its motion, and the API's
// owner-scoped read. This gate guards what a passing unit test cannot: that the Product Owner's
// decisions are true BY CONSTRUCTION of the files W1A-01 owns.
//
// Forward safety: every claim is about a file W1A-01 created or a seam it added. There is no
// whole-manifest pin, no dependency version pin, no repository-wide census and no ceiling on later work.

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8').replace(/\r\n/gu, '\n');
const readJson = (path) => JSON.parse(read(path));
/** Code only: a comment may name a forbidden thing in order to forbid it. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`])\/\/[^\n]*/gu, '$1');

const LAYER = 'apps/mobile/src/conversation';
function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(rootPath, dir))) {
    const full = `${dir}/${entry}`;
    if (statSync(join(rootPath, full)).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}
const LAYER_PRODUCTION = listFiles(LAYER).filter((file) => /\.tsx?$/u.test(file) && !/__tests__|__fixtures__/u.test(file));

// ---------------------------------------------------------------------------------------------
// §2 — Product copy: exactly the approved strings, in one place, and nothing invented
// ---------------------------------------------------------------------------------------------

const APPROVED = {
  ar: ['المحادثة', 'تحليل المحادثة', 'إعادة المحاولة', 'قنديل', 'كلامك هنا', 'رسالتك لقنديل', 'إرسال', 'كلامك: ${text}', 'قنديل: ${text}',
    'في انتظار رد قنديل', 'تعذّر التأكد من إرسال الرسالة.', 'تعذّر إرسال الرسالة.', 'تعذّر إكمال رد قنديل.', 'تعذّر تحميل المحادثة.'],
  en: ['Conversation', 'Analysis', 'Analysis of this conversation', 'Try again', 'QANDEEL', 'Write here', 'Your message to QANDEEL', 'Send',
    'You: ${text}', 'QANDEEL: ${text}', "Waiting for QANDEEL's reply", "It couldn't be confirmed that the message was sent.", "The message wasn't sent.",
    "QANDEEL's reply couldn't be completed.", "The conversation didn't load."],
};

test('§2 — every approved string is in the one copy module, verbatim', () => {
  const copy = read(`${LAYER}/copy.ts`);
  for (const text of [...APPROVED.ar, ...APPROVED.en]) {
    assert.ok(copy.includes(text), `the approved string is missing or altered: ${text}`);
  }
});

test('§2 — the copy module contains no string the Product Owner did not approve', () => {
  const copy = code(read(`${LAYER}/copy.ts`));
  const approved = new Set([...APPROVED.ar, ...APPROVED.en]);
  for (const match of copy.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/gu)) {
    const literal = match[2];
    if (literal === 'ar' || literal.startsWith('../')) continue;
    assert.ok(approved.has(literal), `an unapproved string is in the copy module: ${literal}`);
  }
  // The superseded ambiguous-send wording, and the forbidden registers, are absent.
  for (const refused of ['لم نتأكد', "We couldn't confirm", 'بيفكّر', 'Thinking', 'offline', 'connection', 'اهلا يا']) {
    assert.equal(copy.includes(refused), false, `refused wording is present: ${refused}`);
  }
});

test('§2 — no other production module of the layer, and no W1A composition, writes a Product word', () => {
  const arabicLetter = /[؀-ۿ]/u;
  for (const file of [...LAYER_PRODUCTION.filter((f) => !f.endsWith('/copy.ts')), 'apps/mobile/src/integration/composition/DepthComposition.tsx']) {
    const text = code(read(file));
    assert.doesNotMatch(text, arabicLetter, `${file} writes Arabic outside the copy module`);
    // A quoted English sentence (two or more words) is Product copy by shape.
    assert.doesNotMatch(text, /(['"])[A-Z][a-z]+ [a-z]+[^'"]*\1/u, `${file} writes an English sentence outside the copy module`);
  }
});

// ---------------------------------------------------------------------------------------------
// §3 — the send / retry rules
// ---------------------------------------------------------------------------------------------

test('§3 — one key per logical submission: a key is minted only by Send, and Try again reuses it', () => {
  const controller = code(read(`${LAYER}/conversation-controller.ts`));
  assert.equal((controller.match(/newKey\(\)/gu) ?? []).length, 1, 'a submission key is minted in exactly one place');
  assert.match(controller, /send\(\) \{[\s\S]*?issue\(content, newKey\(\)\);/u, 'the key is minted by Send');
  assert.match(controller, /retrySubmission\(\) \{\n\s*if \(!live\(\) \|\| state\.submission === null \|\| state\.submission\.phase !== 'UNCONFIRMED'\) return;\n\s*const \{ content, key \} = state\.submission;\n\s*issue\(content, key\);/u,
    'Try again acts only on an UNCONFIRMED submission, and re-issues its own words under its own key');
});

test('§3 — a confirmed reply failure has no retry, and no FAILED turn is re-sent or replaced', () => {
  const controller = code(read(`${LAYER}/conversation-controller.ts`));
  for (const forbidden of [/retryReply/iu, /regenerat/iu, /replyRetry/iu]) {
    assert.doesNotMatch(controller, forbidden, `no reply-retry path exists in W1A-01: ${forbidden}`);
  }
  // The automatic requests are same-key replays of turns the server already admitted: the re-entry of
  // work reading has shown COMPLETED, and the bounded re-check of a committed PENDING turn.
  assert.match(controller, /if \(found\.replyState === 'COMPLETED'\) reenterEstablishment\(content, key\);/u);
  assert.equal((controller.match(/transport\.submitTurn\(/gu) ?? []).length, 3, 'exactly three submit sites: issue, the COMPLETED re-entry, and the PENDING re-check');
});

test('§3 — a committed PENDING turn is re-checked only through its own key, only after the lease, and a bounded number of times', () => {
  const controller = code(read(`${LAYER}/conversation-controller.ts`));
  assert.match(controller, /export const ABANDONED_REPLY_RECHECK_MS = SUBMISSION_CONFIRMATION_WINDOW_MS \+ 5_000;/u, 'the re-check waits past the frozen 120 s lease');
  assert.match(controller, /export const ABANDONED_REPLY_RECHECKS = 2;/u);
  const recheck = controller.slice(controller.indexOf('function recheck('), controller.indexOf('function stopConfirmationWindow('));
  assert.ok(recheck.length > 200, 'the re-check body was located');
  // Only a turn still reported PENDING, and only under its own admitted key and words.
  assert.match(recheck, /if \(!live\(\) \|\| exchange === undefined \|\| exchange\.replyState !== 'PENDING' \|\| key === null\) return;/u);
  assert.match(recheck, /transport\.submitTurn\(sessionId, \{ content: exchange\.userTurn\.content, idempotencyKey: key \}\)/u);
  assert.match(recheck, /await readNewest\(\);/u, 'every re-check is followed by the authoritative read');
  assert.equal(recheck.includes('newKey'), false, 'a re-check never mints a key');
  const watch = controller.slice(controller.indexOf('function watchPending('), controller.indexOf('function recheck('));
  assert.match(watch, /entry\.count >= ABANDONED_REPLY_RECHECKS/u, 'the number of re-checks is bounded');
  assert.match(watch, /setTimer\(\(\) => recheck\(exchange\.userTurn\.id\), ABANDONED_REPLY_RECHECK_MS\)/u);
});

test('§3 — a definitive refusal gives the words back with the approved line and implies no retry', () => {
  const controller = code(read(`${LAYER}/conversation-controller.ts`));
  assert.match(controller, /case 'REFUSED':\n\s*case 'NOT_ISSUED':[\s\S]*?update\(\{ submission: null, draft: content, refused: true \}\);/u);
  const surface = code(read(`${LAYER}/ConversationSurface.tsx`));
  const refusal = surface.slice(surface.indexOf('testID="qandeel-conversation-refused"'), surface.indexOf('testID="qandeel-conversation-composer"'));
  assert.match(refusal, /\{copy\.sendRefused\}/u);
  assert.equal(refusal.includes('retrySubmission'), false, 'the refusal offers no retry');
});

test('§3 — the words become an utterance only on the server’s confirmation', () => {
  const controller = code(read(`${LAYER}/conversation-controller.ts`));
  // Every state update that sets the exchanges merges SERVER-reported views into the held ones.
  const updates = [...controller.matchAll(/update\(\{[^;]*?\bexchanges: ([^\n]+)/gu)];
  assert.ok(updates.length >= 5, `the exchange updates were located, found ${updates.length}`);
  for (const match of updates) {
    assert.match(match[1], /^mergeExchanges\(state\.exchanges, /u, `exchanges are only ever server-reported: ${match[1]}`);
  }
});

// ---------------------------------------------------------------------------------------------
// §4 — the transport and the API route
// ---------------------------------------------------------------------------------------------

test('§4 — the mobile transport issues each request once, on the caller’s seam, and mints nothing', () => {
  const api = code(read('apps/mobile/src/runtime-entry/conversation/conversation-turn-api.ts'));
  assert.equal((api.match(/this\.config\.fetch\(/gu) ?? []).length, 2, 'one POST site and one GET site');
  for (const forbidden of [/randomUUID/u, /Math\.random/u, /\bwhile\b/u, /setTimeout/u, /accessToken/u]) {
    assert.doesNotMatch(api, forbidden, `the transport must not ${forbidden}`);
  }
  const entry = code(read('apps/mobile/src/runtime-entry/mobile-runtime-entry.ts'));
  assert.match(entry, /conversationTurnsFor\(bundle\) \{\n\s*return new ConversationTurnApiClient\(\{ baseUrl: config\.apiBaseUrl, fetch: authorizedFetchFor\(bundle\.authGeneration\) \}\);/u,
    'the transport is built on the AC-01 seam bound to the bundle’s own identity');
});

test('§4 — GET /conversation/sessions/:sessionId/turns is a guarded, owner-scoped, pure read', () => {
  const controller = read('apps/api/src/conversation/conversation.controller.ts');
  assert.match(controller, /@Controller\('conversation'\)\n@UseGuards\(SupabaseAuthGuard\)/u);
  assert.match(controller, /@Get\('sessions\/:sessionId\/turns'\)\n\s*listTurns\(/u);
  const service = code(read('apps/api/src/conversation/conversation.service.ts'));
  const body = service.slice(service.indexOf('async listTurns('), service.indexOf('private validateHistoryQuery('));
  assert.ok(body.length > 200, 'the listTurns body was located');
  assert.match(body, /await this\.resumeSession\(userId, accessToken, sessionId\);/u, 'ownership is the Session routes’ own check');
  for (const write of ['orchestrate', 'createTurn', 'claimTurn', 'finalizeTurn', 'failTurn', 'recoverExpiredGeneratingTurn', 'cancelTurn', 'semantic.']) {
    assert.equal(body.includes(write), false, `reading history never reaches ${write}`);
  }
  const repository = code(read('apps/api/src/conversation/conversation.repository.ts'));
  for (const method of ['findUserTurnsPage', 'findCompletedAssistantsForSources']) {
    const start = repository.indexOf(`async ${method}(`);
    const slice = repository.slice(start, repository.indexOf('\n  }\n', start));
    assert.match(slice, /this\.dataApi\.request/u, `${method} reads with the caller’s token`);
    assert.equal(slice.includes('serviceApi'), false, `${method} never uses the service-role channel`);
  }
});

// ---------------------------------------------------------------------------------------------
// §5 — the visual foundation: tokens, P2 geometry through Skia, Estedad v8.5 static faces
// ---------------------------------------------------------------------------------------------

test('§5 — the visual constants are generated from the canonical sources and are current', () => {
  const result = spawnSync(process.execPath, ['apps/mobile/scripts/generate-conversation-visual.mjs', '--check'], { cwd: rootPath, encoding: 'utf8' });
  assert.equal(result.status, 0, `the generated visual module is stale or the generator failed:\n${result.stdout}${result.stderr}`);
  const generated = read(`${LAYER}/visual/canonical-visual.generated.ts`);
  assert.match(generated, /GENERATED by apps\/mobile\/scripts\/generate-conversation-visual\.mjs/u);
  // No other module of the layer names a colour: every colour arrives through the generated module.
  for (const file of LAYER_PRODUCTION.filter((f) => !f.endsWith('.generated.ts'))) {
    assert.doesNotMatch(code(read(file)), /#[0-9a-fA-F]{3,8}\b/u, `${file} names a colour literal`);
  }
});

test('§5 — P2 glyphs are drawn by the installed Skia renderer; react-native-svg is not adopted', () => {
  const manifest = readJson('apps/mobile/package.json');
  assert.equal('react-native-svg' in { ...manifest.dependencies, ...manifest.devDependencies }, false);
  for (const file of listFiles('apps/mobile/src').filter((f) => /\.tsx?$/u.test(f))) {
    assert.doesNotMatch(read(file), /from\s+'react-native-svg'/u, `${file} imports react-native-svg`);
  }
  const glyph = code(read(`${LAYER}/visual/Glyph.tsx`));
  assert.match(glyph, /from '@shopify\/react-native-skia'/u);
  const generated = read(`${LAYER}/visual/canonical-visual.generated.ts`);
  assert.match(generated, /"d": "M12 19\.4V5\.2M6\.6 10\.4 12 5l5\.4 5\.4"/u, 'Send is P2’s own path');
});

test('§5 — the faces are the official Estedad v8.5 STATIC instances, exactly as recorded', () => {
  const dir = 'apps/mobile/assets/fonts/estedad';
  const record = readJson(`${dir}/SOURCE.json`);
  const shipped = readdirSync(join(rootPath, dir)).filter((name) => name.endsWith('.ttf')).sort();
  assert.deepEqual(shipped, record.files.map((file) => file.file).sort());
  for (const file of record.files) {
    const bytes = readFileSync(join(rootPath, dir, file.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `${file.file} is not the recorded binary`);
    // A static instance carries no variation table: nothing was synthesized from the variable font.
    const tables = new Set(Array.from({ length: bytes.readUInt16BE(4) }, (_, i) => bytes.toString('latin1', 12 + i * 16, 16 + i * 16)));
    assert.equal(tables.has('fvar'), false, `${file.file} is a variable font`);
  }
  assert.ok(existsSync(join(rootPath, dir, 'OFL.txt')), 'the OFL licence ships beside the faces');
  assert.match(record.licence.name, /SIL Open Font License, Version 1\.1/u);
  assert.ok('expo-font' in readJson('apps/mobile/package.json').dependencies, 'expo-font is a declared dependency');
  const fonts = code(read(`${LAYER}/visual/fonts.ts`));
  for (const file of record.files) assert.ok(fonts.includes(`estedad/${file.file}`), `${file.file} is loaded`);
});

test('§5 — the composer stays above the keyboard on both platforms (Android 15+ is edge-to-edge)', () => {
  // Found on the API 36 proof emulator: with no Android keyboard behaviour, the enforced edge-to-edge
  // window did not resize, and the composer and its Send stayed under the keyboard.
  const surface = code(read(`${LAYER}/ConversationSurface.tsx`));
  assert.match(surface, /<KeyboardAvoidingView[\s\S]*?behavior="padding"/u);
  assert.doesNotMatch(surface, /behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/u);
  // The same platform fact holds for the Sign-in gateway, the other keyboard surface on this route.
  const gateway = code(read('apps/mobile/src/integration/auth-gateway/ProductSignInGateway.tsx'));
  assert.match(gateway, /<KeyboardAvoidingView[\s\S]*?behavior="padding"/u);
  assert.doesNotMatch(gateway, /behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/u);
});

// ---------------------------------------------------------------------------------------------
// §6 — Conversation ↔ Analysis: one runtime generation, one Session, no persistence, no route
// ---------------------------------------------------------------------------------------------

test('§6 — the Conversation belongs to the runtime generation and is retired with it', () => {
  const runtime = code(read('apps/mobile/src/integration/runtime/integration-runtime.ts'));
  assert.match(runtime, /conversation: createConversationController\(\{\n\s*sessionId: bundle\.sessionId,\n\s*transport: entry\.conversationTurnsFor\(bundle\),\n\s*isCurrent,\n\s*onReplyCommitted: \(\) => built\.liveDriver\.requestImmediateCatchUp\(\),/u);
  assert.match(runtime, /session\.conversation\.retire\(\);/u);
});

test('§6 — the depth pair lands in the Conversation, persists nothing, dispatches nothing and routes nowhere', () => {
  const depth = code(read('apps/mobile/src/integration/composition/DepthComposition.tsx'));
  assert.match(depth, /export const LANDING_DEPTH: WorldDepth = 'CONVERSATION';/u);
  for (const forbidden of [/recovery/iu, /dispatch/u, /expo-router/u, /navigate/u, /AsyncStorage|SecureStore|expo-sqlite/u]) {
    assert.doesNotMatch(depth, forbidden, `the depth switch must not reach ${forbidden}`);
  }
  // No timer drives the switch, and none can start a fade into an Analysis that has not been drawn:
  // the fade into Analysis starts only from the world's own composition report.
  assert.doesNotMatch(depth, /setTimeout|setInterval/u, 'the depth owner has no timer');
  assert.match(depth, /onComposed=\{current \? beginFade : undefined\}/u);
  assert.match(depth, /const conversationStillMounted = to === 'CONVERSATION' && leaving === to;/u);
  const map = code(read('apps/mobile/src/integration/composition/LivingAnalysisMap.tsx'));
  assert.doesNotMatch(map, /setTimeout|setInterval/u);
  assert.match(map, /entry\.status !== 'NOT_FETCHED'/u, 'a projection still being fetched is never treated as drawn');
  // Android system Back: the return act, registered ONLY while Analysis is the depth.
  assert.match(depth, /if \(depth !== 'ANALYSIS'\) return undefined;\n\s*const subscription = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{\n\s*cross\('CONVERSATION'\);\n\s*return true;/u);
  // The frozen boundary: F2's cross-fade, and no cross-fade under Reduced Motion.
  assert.match(depth, /const duration = reduceMotion \? DEPTH_CROSSFADE_REDUCED_MOTION_MS : DEPTH_CROSSFADE_MS;/u);
  assert.match(depth, /withTiming\(1, \{ duration, easing: Easing\.linear \}/u);
  const root = code(read('apps/mobile/src/integration/composition/ProductRoot.tsx'));
  assert.equal((root.match(/<DepthComposition\b/gu) ?? []).length, 1, 'the root composes the world in exactly one place');
});

// ---------------------------------------------------------------------------------------------
// §7 — scope
// ---------------------------------------------------------------------------------------------

test('§7 — no Voice, Replay, Activity, Settings, Understanding, Global Shell, Shared or Public, and no cancel', () => {
  const layer = LAYER_PRODUCTION.map((file) => code(read(file))).join('\n').toLowerCase();
  for (const outside of ['replay', 'voice', 'microphone', 'activity', 'settings', 'understanding', 'switcher', 'shared', 'public', 'cancelturn', '/cancel']) {
    assert.equal(layer.includes(outside), false, `W1A-01 does not implement ${outside}`);
  }
  const generated = read(`${LAYER}/visual/canonical-visual.generated.ts`);
  const glyphs = generated.slice(generated.indexOf('"glyphs"'), generated.indexOf('"type"'));
  assert.deepEqual([...glyphs.matchAll(/\n {4}"(\w+)": \{/gu)].map((m) => m[1]), ['send', 'depth', 'back'], 'only the three W1A glyphs are ported');
});

// ---------------------------------------------------------------------------------------------
// Registration and record
// ---------------------------------------------------------------------------------------------

test('the gate is registered once, and the implementation record carries the approval verbatim', () => {
  const manifest = readJson('package.json');
  assert.equal(manifest.scripts['test:w1a-01-conversation-core-contract'], 'node --test tests/w1a-01-conversation-core-contract.test.mjs');
  const workflow = read('.github/workflows/mobile-ci.yml');
  assert.equal((workflow.match(/run: npm run test:w1a-01-conversation-core-contract\b/gu) ?? []).length, 1, 'exactly one gate step');
  assert.equal((workflow.match(/'tests\/w1a-01-conversation-core-contract\.test\.mjs'/gu) ?? []).length, 1, 'exactly one trigger path');
  const record = read('docs/e2e/QANDEEL_W1A01_IMPLEMENTATION_RECORD_v1.md');
  for (const text of [...APPROVED.ar, ...APPROVED.en].filter((t) => !t.includes('${text}'))) {
    assert.ok(record.includes(text), `the implementation record must carry the approved string: ${text}`);
  }
  assert.match(record, /AUTHORIZE W1A-01 PRODUCTION INTEGRATION/u);
});
