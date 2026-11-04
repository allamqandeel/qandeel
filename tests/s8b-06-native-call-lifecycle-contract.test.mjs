// S8B-06 CP2 — the native call lifecycle contract (contract v1.2 Part A → A1 → v1.1 → v1.0 §9 / §11 / §12, A6 06-CP2,
// A1 D-05-02 / D-05-06 / §5, acceptance #36). A static pin of what CP2 shipped, so a later change cannot quietly undo it:
//
//   Android  Core-Telecom 1.0.1 (stable) `CallsManager` / `CallControlScope`, an OUTGOING call, routes only through
//            `requestEndpointChange`; the ONE `phoneCall` foreground service with a CallStyle notification and a real End;
//            the engine (CP1's, not rebuilt) owns no audio mode, route or focus inside a Telecom call.
//   iOS      CallKit outgoing only (`CXStartCallAction`, `includesCallsInRecents = false`, no PushKit, no incoming call),
//            `playAndRecord` / `voiceChat` + the voice-processing I/O unit, `UIBackgroundModes = [audio]` (never voip), a
//            complete engine (capture / play, VP-AEC, libopus vendored with FEC, VAD / barge-in, PLAYOUT from the
//            presented position) that may start only inside the ACTIVE call.
//   Shared   the frozen protocol is unchanged (the CP1 contract pins it byte for byte) and the one socket stays the
//            client's; the warning's local trigger is the engine's clock; HEARD comes from the engine only; the copy rows
//            stay PROPOSED (no Copy Gate approval), no audio file, no TTS, no provider.
//   Plugin   typed mods only (no dangerous mod), the exact Android declarations and the exact iOS mode.
//
// Behaviour is proven by the tests this contract requires to exist and to be wired (Kotlin JUnit, Swift host + simulator,
// Jest); device behaviour by the CP2 record's acceptance matrix.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const read = (file) => readFileSync(join(root, file), 'utf8');
const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/gu, '$1');
const walk = (dir) => readdirSync(join(root, dir), { recursive: true }).map((f) => `${dir}/${String(f).replace(/\\/gu, '/')}`);

const MODULE = 'apps/mobile/modules/qandeel-voice-call';
const KOTLIN = `${MODULE}/android/src/main/java/expo/modules/qandeelvoicecall`;
const IOS = `${MODULE}/ios`;
const CALL = 'apps/mobile/src/voice-call';

test('the module is linked on both platforms: two iOS pods, one Swift module', () => {
  assert.deepEqual(JSON.parse(read(`${MODULE}/expo-module.config.json`)), {
    platforms: ['android', 'apple'],
    android: { modules: ['expo.modules.qandeelvoicecall.QandeelVoiceCallModule'] },
    apple: { modules: ['QandeelVoiceCallModule'], podspecPath: ['ios/QandeelOpus.podspec', 'ios/QandeelVoiceCall.podspec'], swiftModuleName: 'QandeelVoiceCall' },
  });
  const pod = read(`${IOS}/QandeelVoiceCall.podspec`);
  assert.match(pod, /s\.dependency 'QandeelOpus'/u);
  assert.match(pod, /s\.frameworks = 'AVFoundation', 'CallKit'/u);
  assert.match(pod, /s\.source_files = 'Core\/\*\*\/\*\.swift', 'Expo\/\*\*\/\*\.swift'/u, 'the app links exactly the tested Core plus the Expo module');
  const opus = read(`${IOS}/QandeelOpus.podspec`);
  assert.match(opus, /s\.version {8}= '1\.5\.2'/u);
  assert.match(opus, /s\.module_name {4}= 'COpus'/u);
  assert.match(opus, /OPUS_BUILD=1 VAR_ARRAYS=1 HAVE_LRINTF=1 HAVE_LRINT=1/u);
  const pkg = read(`${IOS}/Package.swift`);
  assert.match(pkg, /\.target\(name: "QandeelCallCore", dependencies: \["COpus"\], path: "Core"\)/u, 'the package tests the same Core the pod links');
});

test('Android: Core-Telecom 1.0.1 is the one added dependency; the CP1 codec stays pinned', () => {
  const gradle = read(`${MODULE}/android/build.gradle`);
  const deps = [...gradle.matchAll(/^\s*implementation '([^']+)'/gmu)].map((m) => m[1]);
  assert.deepEqual(deps, ['io.github.jaredmdobson:concentus:1.0.2', 'androidx.core:core-telecom:1.0.1']);
  assert.doesNotMatch(gradle, /alpha|beta|-rc|\+'/u, 'a stable, exact version');
});

test('Android: an outgoing self-managed call, routes only through Telecom, the engine owns nothing inside it', () => {
  const lifecycleFiles = ['LiveCallRegistry.kt', 'CallNotification.kt', 'CallForegroundService.kt', 'QandeelVoiceCallModule.kt', 'CallLifecycleMachine.kt'];
  for (const f of walk(`${MODULE}/android/src/main/java`).filter((p) => p.endsWith('.kt'))) {
    const name = f.split('/').at(-1);
    if (!lifecycleFiles.includes(name)) {
      assert.doesNotMatch(strip(read(f)), /androidx\.core\.telecom|CallsManager|CallControlScope|startForeground|NotificationCompat/u, `${name}: no call lifecycle outside the lifecycle files`);
    }
  }
  const registry = strip(read(`${KOTLIN}/LiveCallRegistry.kt`));
  assert.match(registry, /CallsManager\(appContext\)/u);
  assert.match(registry, /registerAppWithTelecom\(CallsManager\.CAPABILITY_BASELINE\)/u);
  assert.match(registry, /direction = CallAttributesCompat\.DIRECTION_OUTGOING/u);
  assert.doesNotMatch(registry, /DIRECTION_INCOMING/u, 'no incoming call');
  assert.equal((registry.match(/requestEndpointChange\(/gu) ?? []).length, 1, 'routes change through requestEndpointChange only');
  assert.doesNotMatch(registry, /setCommunicationDevice|isSpeakerphoneOn|setSpeakerphoneOn/u);
  const engine = read(`${KOTLIN}/CallAudioEngine.kt`);
  assert.match(engine, /enum class AudioOwner \{ SELF, TELECOM \}/u);
  assert.equal((engine.match(/if \(options\.owner == AudioOwner\.TELECOM\) \{/gu) ?? []).length, 2, 'the audio session is taken and given back only in SELF');
  const module = strip(read(`${KOTLIN}/QandeelVoiceCallModule.kt`));
  assert.match(module, /parsed\.owner == CallAudioEngine\.AudioOwner\.TELECOM && !LiveCallRegistry\.attachEngine\(created\)\) throw EngineException\("NO_ACTIVE_CALL"\)/u,
    'a call engine starts only inside an ACTIVE Telecom call');
  const notification = strip(read(`${KOTLIN}/CallNotification.kt`));
  assert.match(notification, /NotificationCompat\.CallStyle\.forOngoingCall\(person, hangUp\)/u, 'a CallStyle with a real End');
  assert.match(notification, /\.setOngoing\(true\)/u);
  assert.match(notification, /PendingIntent\.FLAG_IMMUTABLE/u);
  const machine = strip(read(`${KOTLIN}/CallLifecycleMachine.kt`));
  for (const source of ['APP', 'NOTIFICATION', 'SYSTEM', 'MICROPHONE', 'ENGINE', 'SERVICE', 'TASK_REMOVED', 'APP_GONE', 'START_FAILED']) assert.match(machine, new RegExp(`\\b${source}\\b`, 'u'), source);
});

test('the config plugin: typed mods only, exactly the call declarations, Voice Notes still foreground-only', () => {
  const source = read('apps/mobile/plugins/with-qandeel-voice-call.js');
  assert.doesNotMatch(strip(source), /withDangerousMod|withMod\(|fs\.|require\('node:fs'\)|require\('fs'\)/u, 'no dangerous mod, no file written');
  const plugin = require(join(root, 'apps/mobile/plugins/with-qandeel-voice-call.js'));
  assert.equal(plugin.SERVICE_NAME, 'expo.modules.qandeelvoicecall.CallForegroundService');
  assert.deepEqual([...plugin.SERVICE_TYPES], ['phoneCall']);
  assert.deepEqual([...plugin.PERMISSIONS], ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_PHONE_CALL', 'android.permission.MANAGE_OWN_CALLS']);
  assert.deepEqual([...plugin.IOS_BACKGROUND_MODES], ['audio']);
  const app = JSON.parse(read('apps/mobile/app.json')).expo;
  const audio = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-audio')[1];
  assert.equal(audio.enableBackgroundRecording, false, 'a Voice Note never records in the background');
  assert.equal(audio.enableBackgroundPlayback, false);
  assert.equal(app.ios?.infoPlist?.UIBackgroundModes, undefined, 'the call plugin is the only author of the background mode');
  const gate = read('apps/mobile/scripts/verify-voice-note-native.mjs');
  for (const plant of ['android-call-service-microphone-type', 'android-call-service-exported', 'android-second-foreground-service', 'voice-note-keeps-recording-in-background',
    'voice-note-reaches-call-engine', 'ios-background-voip', 'ios-background-other-mode', 'ios-background-modes-twice']) {
    assert.match(gate, new RegExp(`id: '${plant}'`, 'u'), `the native gate plants ${plant}`);
  }
});

test('iOS: CallKit outgoing only, the voice-chat session, audio only after didActivate, no voip, no PushKit', () => {
  const swift = walk(IOS).filter((f) => f.endsWith('.swift') && !f.startsWith(`${IOS}/Tests/`));
  const all = swift.map((f) => strip(read(f))).join('\n');
  assert.doesNotMatch(all, /import PushKit|PKPushRegistry|reportNewIncomingCall|CXAnswerCallAction|"voip"/u, 'outgoing calls only');
  assert.doesNotMatch(all, /\bprint\(|NSLog\(|os_log\(|Logger\(|debugPrint\(/u, 'nothing is logged');
  assert.doesNotMatch(all, /URLSession|FileManager|\.write\(to:|FileHandle|UserDefaults/u, 'no network, no file, no storage');
  const kit = strip(read(`${IOS}/Core/CallKitBackend.swift`));
  assert.match(kit, /configuration\.includesCallsInRecents = false/u);
  assert.match(kit, /configuration\.maximumCallsPerCallGroup = 1/u);
  assert.match(kit, /CXStartCallAction\(call: uuid, handle: CXHandle\(type: \.generic, value: displayName\)\)/u, 'the handle is the display name, never the call id');
  assert.match(kit, /session\.setCategory\(\.playAndRecord, mode: \.voiceChat, options: \[\.allowBluetooth\]\)/u);
  assert.match(kit, /func provider\(_ provider: CXProvider, didActivate audioSession: AVAudioSession\)/u);
  assert.match(kit, /#if os\(iOS\)/u);
  const coordinator = strip(read(`${IOS}/Core/CallCoordinator.swift`));
  assert.match(coordinator, /guard let call = current, call\.machine\.state == \.ACTIVE else \{ return false \}/u, 'the engine attaches only to the ACTIVE call');
  assert.match(coordinator, /if !microphoneGranted\(\) \{[\s\S]*?MIC_PERMISSION_DENIED/u);
  assert.match(coordinator, /ALREADY_IN_CALL/u);
  const module = strip(read(`${IOS}/Expo/QandeelVoiceCallModule.swift`));
  assert.match(module, /if platformCall && !self\.coordinator\.attach\(created\) \{ throw Self\.fail\("NO_ACTIVE_CALL"\) \}/u);
  assert.match(module, /#if targetEnvironment\(simulator\)\s*let backend = AudioSessionOnlyBackend\(\)\s*#else\s*let backend = CallKitBackend/u, 'CallKit on every device; the session-only path on the simulator alone');
  const io = strip(read(`${IOS}/Core/VoiceProcessingAudioIO.swift`));
  assert.match(io, /setVoiceProcessingEnabled\(true\)/u, "Apple's voice-processing I/O: echo cancellation against the engine's own output");
});

test('iOS: the engine is complete — libopus with FEC, the onset rules, the ledger, PLAYOUT from the presented position', () => {
  const vendored = read(`${IOS}/opus/VENDORED.md`);
  assert.match(vendored, /65c1d2f78b9f2fb20082c38cbe47c951ad5839345876e46941612ee87f9a7ce1/u);
  assert.match(read(`${IOS}/opus/COPYING`), /Xiph\.Org/u);
  const sources = read(`${IOS}/opus/sources.txt`).split(/\r?\n/u).filter(Boolean);
  assert.equal(sources.length, 137);
  for (const s of sources) assert.ok(existsSync(join(root, IOS, 'opus', s)), s);
  assert.doesNotMatch(sources.join('\n'), /dnn\/|dred|osce|lpcnet|_demo|arm\/|x86\//iu, 'the float encoder and decoder only');
  const codecs = strip(read(`${IOS}/Core/OpusCodecs.swift`));
  for (const rule of [/static let rate: Int32 = 16_000/u, /static let frameSamples = 320/u, /static let bitrate: Int32 = 24_000/u, /static let complexity: Int32 = 5/u,
    /qandeel_opus_encoder_configure\(enc, UplinkOpusEncoder\.bitrate, UplinkOpusEncoder\.complexity, 1, 10, 0\)/u, /OPUS_APPLICATION_VOIP/u,
    /static let rate: Int32 = 24_000/u]) assert.match(codecs, rule);
  const detector = strip(read(`${IOS}/Core/SpeechOnsetDetector.swift`));
  for (const rule of [/var onsetFrames: Int = 10/u, /var floorMarginDb: Double = 10\.0/u, /var absoluteMinDb: Double = -50\.0/u, /var echoGuardDb: Double = -18\.0/u]) assert.match(detector, rule);
  const core = strip(read(`${IOS}/Core/CallEngineCore.swift`));
  assert.match(core, /let packet = try frame\.withUnsafeBufferPointer \{ try encoder\.encode\(\$0\.baseAddress!\) \}[\s\S]*?sink\?\.uplink\(captureMs: captureMs, packet: packet\)[\s\S]*?detector\.push\(/u,
    'the uplink is sent before the detector judges the frame');
  assert.match(core, /mark = ledger\.advance\(frame\)/u, 'PLAYOUT marks advance only from the presented frame');
  assert.match(core, /static let rampMs: Int64 = 8/u);
  assert.match(core, /if let c = heardCue \{ sink\?\.cue\(event: "HEARD"/u, "a cue's HEARD comes from the presented position");
  const io = strip(read(`${IOS}/Core/VoiceProcessingAudioIO.swift`));
  assert.match(io, /outputLatency/u, 'the presented position adds the output latency to the render timestamp');
  // The Android lessons, carried as tests that must exist on iOS too.
  const tests = walk(`${IOS}/Tests`).filter((f) => f.endsWith('.swift')).map((f) => read(f)).join('\n');
  for (const name of ['testDownlinkDecodesLibopusHybridAndSilkPacketsAtTheirLevel', 'testTheEncoderHoldsTheFrozenSettings', 'testQandeelsOwnEchoNeverCutsItsReply',
    'testSteadyRoomNoiseDuringAReplyNeverCutsIt', 'testDoubleTalkCutsTheReplyWithin200msAndRefusesTheRest', 'testThePersonsFirstWordsAreSentFromTheFirstFrame',
    'testAHoldReleasesBothDirectionsAndTheClockJumpsByTheHeldTime', 'testAScheduledCueFallsDueOnTheEngineClockAndHeardComesFromThePresentedPosition',
    'testAnEndDropsEveryWaitingCueAndNothingFiresAfterIt', 'testTheSystemMuteIsReportedForTheClientToApply',
    'testLateCallbacksAfterTheEndChangeNothingButACounter', 'testAMicrophoneThatCannotResumeEndsTheCall', 'testWithoutTheMicrophonePermissionTheEngineRefusesAndLeavesNothingOpen',
    'testTheSimulatorCallPathStartsAndEndsThroughTheRealSession']) {
    assert.match(tests, new RegExp(`func ${name}\\(`, 'u'), name);
  }
  assert.equal(read(`${IOS}/Tests/Fixtures/s806-libopus-downlink-hybrid.txt`), read(`${MODULE}/android/src/test/resources/s806-libopus-downlink-hybrid.txt`), 'the same real libopus packets on both platforms');
});

test('JS: one controller over the existing session and client; the warning is the engine’s; nothing paid or approved', () => {
  const controller = strip(read(`${CALL}/live-call-controller.ts`));
  assert.match(controller, /audioOwner: 'PLATFORM_CALL'/u);
  assert.match(controller, /new LiveCallSession\(/u, 'the existing session, not a second one');
  assert.doesNotMatch(controller, /new WebSocket|new LiveCallClient\(/u, 'no second socket');
  assert.match(controller, /scheduleCue/u, "the warning's local trigger is the engine clock (JS timers pause in the background)");
  assert.match(controller, /this\.timers = new NativePacedTimers\(/u, 'the call timers are also paced by the native engine tick (heartbeat and reconnect in the background)');
  assert.match(read(`${KOTLIN}/CallAudioEngine.kt`), /sink\.tick\(loopNs \/ 1_000_000L\)/u, 'the Android engine ticks in its playback loop, held included');
  assert.match(read(`${IOS}/Core/CallEngineCore.swift`), /self\?\.sink\?\.tick\(nowMs:/u, 'the iOS engine ticks from its clock, held included');
  const warning = strip(read(`${CALL}/call-ending-warning.ts`));
  assert.match(warning, /WARNING_LEAD_MS[^=]*= Object\.freeze\(\{ T5: 5 \* 60_000, T1: 60_000 \}\)/u, 'T-5 and T-1 before the server end');
  const copy = read(`${CALL}/live-call-copy.ts`);
  const statuses = [...copy.matchAll(/status: '([A-Z_]+)'/gu)].map((m) => m[1]);
  assert.ok(statuses.length >= 7);
  // RE-ANCHORED by the Product Owner's S8B-06 CP3 Copy Gate approval (2026-11-04; was: every row PROPOSED, CP2 approved
  // none): the approval is the Product Owner's, recorded in the CP3 record's §4, and every row carries it. A row in any
  // other state still fails; the CP3 contract pins each row to that table (tests/s8b-06-cp3-call-ui-contract.test.mjs).
  assert.ok(statuses.every((s) => s === 'APPROVED'), 'every copy row carries the Product Owner\'s CP3 Copy Gate approval, none another state');
  assert.match(read('docs/e2e/QANDEEL_S8B_06_CALL_UI_LIVE_MAP_DEVICE_CLOSURE_RECORD_v1.md'), /\*\*Gate status: CLOSED\*\* — \*\*all 36 rows APPROVED by the Product Owner\*\*/u,
    'the approval is the Product Owner\'s, in the CP3 record');
  const media = walk('apps/mobile').filter((f) => !f.includes('node_modules') && !f.startsWith('apps/mobile/android/') && !f.startsWith('apps/mobile/ios/'))
    .filter((f) => /(?:^|\/)(?:voice-call|qandeel-voice-call)\//u.test(f) && /\.(mp3|wav|m4a|aac|caf|ogg|opus)$/iu.test(f));
  assert.deepEqual(media, [], 'no audio file: the warning fallback is a generated tone, no F-01 file, no TTS');
  const js = walk(CALL).filter((f) => /\.(ts|tsx)$/u.test(f)).map((f) => strip(read(f))).join('\n');
  assert.doesNotMatch(js, /gemini|speechmatics|deepseek|elevenlabs|googleapis|generativelanguage/iu, 'no provider on the phone');
  assert.doesNotMatch(js, /console\.(log|info|warn|error|debug)\(/u, 'nothing is logged');
});

test('the contract and the native tests are wired', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['test:s8b-06-native-call-lifecycle-contract'], 'node --test tests/s8b-06-native-call-lifecycle-contract.test.mjs');
  const mobile = read('.github/workflows/mobile-ci.yml');
  assert.match(mobile, /run: npm run test:s8b-06-native-call-lifecycle-contract/u);
  assert.match(mobile, /'tests\/s8b-06-native-call-lifecycle-contract\.test\.mjs'/u);
  assert.match(read('.github/workflows/api-ci.yml'), /run: npm run test:s8b-06-native-call-lifecycle-contract/u);
  const native = read('.github/workflows/s8b-06-native-call-tests.yml');
  assert.match(native, /\.\/gradlew :qandeel-voice-call:testDebugUnitTest --no-daemon/u);
  assert.match(native, /run: swift test/u);
  assert.match(native, /xcodebuild test -scheme/u);
  assert.match(native, /runs-on: macos-26/u);
});
