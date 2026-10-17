// S6-06 (CP2, the last checkpoint) — the mobile sharing experience, static contract.
//
// It proves the repository shape the Product Owner authorized for CP2 (Visual Gate rev.2 and Copy Gate CLOSED,
// 2026-10-17): the 74 approved rows word for word; ONE strict client of the CP1 routes (no route of its own, no user id,
// counterpart or audience); a rendition drawn only from an in-memory `data:` URI with expo-image's cache off (no URL, no
// header, no prefetch, no cache key handed to the native image engine); the picker's copy deleted and its sub-directory
// swept, with no camera, microphone, storage or media permission; V-1 kept (the one sharing action beside END); SUCCESS
// drawn only with a real transition; nothing persisted and nothing reaching QANDEEL's reply, Living Analysis, Activity or
// Push. Live behaviour is proven by the jest-expo suites under apps/mobile/src/introductions/__tests__ and
// apps/mobile/src/runtime-entry/__tests__/introduction-sharing-api.test.ts; the native build by the photo-permission gate.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
const MOBILE = 'apps/mobile/src';
const INTRO = `${MOBILE}/introductions`;
const SHARING_CLIENT = `${MOBILE}/runtime-entry/introduction-sharing-api.ts`;
const CONTINUATION_CLIENT = `${MOBILE}/runtime-entry/introduction-continuation-api.ts`;
const CP2_FILES = [
  SHARING_CLIENT, CONTINUATION_CLIENT, `${INTRO}/introduction-sharing-controller.ts`, `${INTRO}/introduction-sharing-copy.ts`, `${INTRO}/IntroductionSharingPanel.tsx`,
  `${INTRO}/IntroductionSuccessCard.tsx`, `${INTRO}/IntroductionsStatusLine.tsx`, `${INTRO}/participation-controller.ts`, `${INTRO}/photo-source.ts`, `${INTRO}/rendition-release.ts`,
  `${MOBILE}/settings/IntroductionSharesSection.tsx`, `${MOBILE}/settings/introduction-shares-controller.ts`,
];
const GATE = read('docs/e2e/QANDEEL_S6_06_VISUAL_COPY_GATE_v1.md');

test('1 — the copy is the Copy Gate record\'s 74 APPROVED rows word for word; both gates are closed', () => {
  const approved = new Map();
  for (const line of GATE.split(/\r?\n/u)) {
    if (!line.startsWith('| PD-')) continue;
    const cells = line.split(' | ');
    const status = cells.slice(4).join(' | ');
    if (cells.length >= 5 && status.startsWith('APPROVED')) approved.set(cells[0].slice(2), { ar: cells[2], en: cells[3] });
  }
  assert.equal(approved.size, 74);
  const copy = read(`${INTRO}/introduction-sharing-copy.ts`);
  const rows = [...copy.matchAll(/^ {2}(\w+): \{ id: '([^']+)', ar: ("(?:[^"\\]|\\.)*"), en: ("(?:[^"\\]|\\.)*") \}, \/\/ APPROVED — S6-06 Copy Gate/gmu)];
  assert.equal(rows.length, 74, 'seventy-four rows, each marked APPROVED');
  for (const [, , id, ar, en] of rows) {
    assert.equal(JSON.parse(ar), approved.get(id)?.ar, `${id} Arabic`);
    assert.equal(JSON.parse(en), approved.get(id)?.en, `${id} English`);
  }
  assert.match(GATE, /\*\*Status:\*\* \*\*VISUAL GATE CLOSED — COPY GATE CLOSED/u, 'both gates are closed in the record');
});

test('2 — one strict client of the CP1 routes; no identity, counterpart or audience; a rendition is a data: URI asked for no-store', () => {
  const sharing = code(SHARING_CLIENT);
  const routes = [...sharing.matchAll(/`\$\{this\.world\(worldId\)\}(\/[^`]+)`|'(\/introductions\/shares)'/gu)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(routes.sort(), ['/disclosures', '/disclosures/text', '/display-name/grant', '/display-name/revoke', '/image-removal', '/image-stages', '/introductions/shares'].sort());
  assert.match(sharing, /\/image\/\$\{encodeURIComponent\(commandId\)\}/u, 'the photo upload carries only its command id');
  assert.match(sharing, /\/media\/\$\{encodeURIComponent\(handle\)\}`, \{\n\s+method: 'GET', headers: \{ Accept: 'image\/jpeg' \}, cache: 'no-store',/u);
  assert.match(sharing, /\{ commandId, resourceType: textType, fieldKey, text \}/u);
  assert.match(sharing, /\{ commandId, seriesId, stage \}/u);
  assert.match(sharing, /`data:image\/jpeg;base64,\$\{base64\}`/u, 'a rendition is handed back only as an in-memory data: URI');
  // The other person's series is never accepted, and a type must fit its stage.
  assert.match(sharing, /if \(mine \? !isUuid\(seriesId\) : seriesId !== null\) return null;/u);
  assert.match(sharing, /type === \(stage === 3 \? 'FULL_IMAGE' : 'PARTIAL_IMAGE'\)/u);
  const continuation = code(CONTINUATION_CLIENT);
  assert.deepEqual([...continuation.matchAll(/`\$\{this\.world\(worldId\)\}(\/[^`]+)`|'(\/introductions\/participation[^']*)'/gu)].map((m) => m[1] ?? m[2]).sort(),
    ['/introductions/participation', '/introductions/participation/resume', '/success', '/success/approval', '/success/withdrawal'].sort());
  assert.doesNotMatch(continuation, /prepare/u, 'no route prepares a transition (Stage 8A)');
  for (const file of [SHARING_CLIENT, CONTINUATION_CLIENT]) {
    assert.doesNotMatch(code(file), /userId|user_id|counterpart|audience|ownerUserId|setTimeout|AsyncStorage|SecureStore|expo-sqlite|expo-file-system/u, `${file} carries no identity, retry or persistence`);
  }
  const entry = code(`${MOBILE}/runtime-entry/mobile-runtime-entry.ts`);
  assert.match(entry, /new IntroductionSharingApiClient\(\{ baseUrl: config\.apiBaseUrl, fetch: authorizedFetchFor\(bundle\.authGeneration\) as unknown as IntroductionSharingFetch \}\)/u, 'on the AC-01 seam');
  assert.match(entry, /new IntroductionContinuationApiClient\(\{ baseUrl: config\.apiBaseUrl, fetch: authorizedFetchFor\(bundle\.authGeneration\) \}\)/u);
});

test('3 — renditions from memory only: expo-image with its cache off, never a URL, header, prefetch or cache key; dropped on close', () => {
  const users = readdirSync(new URL(`${MOBILE}/`, root), { recursive: true }).map(String).filter((f) => /\.(ts|tsx)$/u.test(f) && !/__tests__/u.test(f))
    .filter((f) => /from 'expo-image'/u.test(read(`${MOBILE}/${f.replace(/\\/gu, '/')}`))).map((f) => f.replace(/\\/gu, '/')).sort();
  assert.deepEqual(users, ['introductions/IntroductionSharingPanel.tsx', 'introductions/rendition-release.ts'], 'expo-image is used only to draw a rendition and to drop its memory');
  const panel = code(`${INTRO}/IntroductionSharingPanel.tsx`);
  const images = [...panel.matchAll(/<Image\b[^>]*\/>/gu)].map((m) => m[0]);
  assert.equal(images.length, 1);
  assert.match(images[0], /source=\{\{ uri: media\.dataUri \}\} cachePolicy="none"/u);
  assert.doesNotMatch(panel, /prefetch|cacheKey|headers=|recyclingKey|placeholder=/u);
  const controller = code(`${INTRO}/introduction-sharing-controller.ts`);
  assert.match(controller, /if \(Object\.keys\(media\)\.length !== Object\.keys\(now\.media\)\.length\) clearImageMemory\?\.\(\);/u, 'a rendition leaving the read leaves memory');
  assert.match(controller, /publish\(\{ open: null \}\);\n\s+if \(held\) clearImageMemory\?\.\(\);/u, 'closing the World drops everything');
  assert.match(code(`${INTRO}/rendition-release.ts`), /Image\.clearMemoryCache\(\)/u);
});

test('4 — the picker: one photo, no camera, editing, EXIF or base64; the copy deleted exactly; only its sub-directory swept; nothing written', () => {
  const source = code(`${INTRO}/photo-source.ts`);
  assert.match(source, /mediaTypes: \['images'\],\n\s+allowsEditing: false,\n\s+allowsMultipleSelection: false,\n\s+exif: false,\n\s+base64: false,/u);
  assert.doesNotMatch(source, /launchCameraAsync|requestMediaLibraryPermissionsAsync|requestCameraPermissionsAsync|deleteAsync|legacy|\.write\(|\.copy\(|\.move\(|create\(/u);
  assert.match(source, /const file = new File\(uri\);\n\s+if \(file\.exists\) file\.delete\(\);/u);
  assert.match(source, /new Directory\(Paths\.cache, PICKER_DIRECTORY\)/u);
  assert.match(source, /const PICKER_DIRECTORY = 'ImagePicker';/u);
  assert.match(source, /getPendingResultAsync\(\)/u);
  const controller = code(`${INTRO}/introduction-sharing-controller.ts`);
  assert.match(controller, /photos\.discard\(choice\.uri\);\n\s+if \(current\(token, worldId\) === null\) return 'FAILED';\n\s+return upload\(/u, 'the copy goes before the upload is answered');
  const runtime = code(`${MOBILE}/integration/runtime/integration-runtime.ts`);
  assert.match(runtime, /const photos = createDevicePhotoSource\(\);\n\s+void photos\.sweep\(\);/u, 'swept at start');
});

test('5 — the native build: no camera, microphone, storage or media permission; iOS keeps its own PD-83 in both languages', () => {
  const app = JSON.parse(read('apps/mobile/app.json')).expo;
  const picker = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker');
  const copy = read(`${INTRO}/introduction-sharing-copy.ts`);
  const purpose = /photosPurpose: \{ id: 'PD-83', ar: ("[^"]*"), en: ("[^"]*") \}/u.exec(copy);
  assert.deepEqual(picker[1], { photosPermission: JSON.parse(purpose[2]), cameraPermission: false, microphonePermission: false });
  assert.deepEqual(app.android.blockedPermissions, ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']);
  assert.deepEqual(app.locales, { ar: './locales/ar.json', en: './locales/en.json' });
  assert.equal(JSON.parse(read('apps/mobile/locales/ar.json')).ios.NSPhotoLibraryUsageDescription, JSON.parse(purpose[1]));
  assert.equal(JSON.parse(read('apps/mobile/locales/en.json')).ios.NSPhotoLibraryUsageDescription, JSON.parse(purpose[2]));
  const gate = read('apps/mobile/scripts/verify-introduction-photo-native.mjs');
  for (const name of ['CAMERA', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'NSCameraUsageDescription', 'NSMicrophoneUsageDescription']) {
    assert.ok(gate.includes(name), `the native gate checks ${name}`);
  }
  assert.match(read('.github/workflows/mobile-ci.yml'), /run: npm run prebuild:introduction-photo:mobile\}/u, 'Mobile CI runs the native gate');
});

test('6 — V-1 kept: one sharing action beside END in the live World; SUCCESS only with a real transition; no colour literal', () => {
  const surface = code(`${INTRO}/IntroductionWorldSurface.tsx`);
  assert.match(surface, /testID="qandeel-introduction-sharing"/u);
  assert.match(surface, /\{!confirmingEnd && status === 'ACTIVE' && sharing !== undefined && !completed \? \(/u, 'the sharing action only in the live World');
  assert.match(surface, /success !== null && success\.status === 'TRANSITION' && sharing !== undefined\n\s+\? <SuccessProposal/u, 'SUCCESS only with a transition');
  assert.match(surface, /sharingView\?\.disclosures\?\.otherDisplayName \?\? firstNameOf\(state, worldId\)/u, 'the full name only as the server returns it');
  for (const file of CP2_FILES.filter((f) => f.endsWith('.tsx'))) assert.doesNotMatch(code(file), /#[0-9a-f]{3,8}\b|rgba?\(/iu, `${file} adds no colour`);
  assert.match(code(`${INTRO}/IntroductionSuccessCard.tsx`), /borderStartWidth: palette\.markerThickness, borderStartColor: palette\.selectedMarker/u);
});

test('7 — nothing persisted; nothing reaches QANDEEL\'s reply, Living Analysis, Activity or Push; acts keep their command ids', () => {
  for (const file of CP2_FILES) {
    const text = code(file);
    assert.doesNotMatch(text, /AsyncStorage|SecureStore|expo-sqlite|openDatabase|localStorage/u, `${file} persists nothing`);
    assert.doesNotMatch(text, /from '\.\.\/(?:activity|push|living-analysis|map|understanding)'|model-router|qandeelTurnName|LivingAnalysis/u, `${file} reaches no reply, analysis, Activity or Push`);
  }
  const controller = code(`${INTRO}/introduction-sharing-controller.ts`);
  assert.match(controller, /const id = lost\.get\(ledgerKey\) \?\? newCommandId\(\);\n\s+lost\.set\(ledgerKey, id\);/u, 'a lost answer keeps its id');
  assert.match(controller, /if \(!unknown && lost\.get\(ledgerKey\) === id\) lost\.delete\(ledgerKey\);/u, 'an answer forgets it');
  const runtime = code(`${MOBILE}/integration/runtime/integration-runtime.ts`);
  for (const name of ['introductionSharing', 'introductionParticipation', 'introductionShares']) assert.match(runtime, new RegExp(`session\\.${name}\\.retire\\(\\);`, 'u'), `${name} is retired with the generation`);
});

test('8 — the suites, the contract and CI', () => {
  const suite = read(`${INTRO}/__tests__/introduction-sharing.test.tsx`);
  for (const name of ['the S6-06 Copy Gate, word for word', 'P0 (%s)', 'flow 1:', 'P3b:', 'flow 4:', 'P8:', 'memory:', 'flow 6:', 'P15g:', 'NO_TRANSITION', 'P14b', 'P16c:']) {
    assert.ok(suite.includes(name), `the suite proves ${name}`);
  }
  assert.ok(read(`${INTRO}/__tests__/photo-source.test.ts`).includes('the sweep deletes every copy the ledger knows'));
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.scripts['test:s6-06-introduction-mobile-contract'], 'node --test tests/s6-06-introduction-mobile-contract.test.mjs');
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run test:s6-06-introduction-mobile-contract\}/u);
});
