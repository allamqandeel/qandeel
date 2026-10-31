/**
 * S8B-03 (CP2) — the native-capability proof root for Voice Notes. VALIDATION ONLY.
 *
 * Not referenced by `package.json`, `app.config.js`, the router or any production module. It becomes an entry point only
 * when `apps/mobile/scripts/select-s803-proof-entry.mjs --apply` points `main` at `s803-proof-entry.tsx` for one proof
 * build, which the S8B-03 record names in its evidence.
 *
 * It drives the SHIPPED voice-note modules — the capture, the expo-audio recorder port, the draft store over the real
 * documents directory and kv-store, the API client — against a local fake voice server reached through `adb reverse`
 * (`http://127.0.0.1:8803`, a proof-only cleartext build). A launch link chooses each step:
 *
 *   qandeel://s803-proof/record      start a capture (permission at the moment of intent)
 *   qandeel://s803-proof/stop        the reader's stop → a SAVED draft; its container is checked on the device
 *   qandeel://s803-proof/list        the drafts of owner A (and, separately, of owner B: never A's)
 *   qandeel://s803-proof/recover     start-up recovery of owner A
 *   qandeel://s803-proof/upload      the newest SAVED draft → the fake server, which runs the CP1 duration prover on it
 *   qandeel://s803-proof/play        the uploaded note, streamed with an Authorization header (and Range)
 *   qandeel://s803-proof/pause
 *   qandeel://s803-proof/export-voices       the PRODUCTION saver (C-49): the newest note under its S8B-02 name → SAVED
 *   qandeel://s803-proof/export-voices-gone  …plus one listed file the server answers 404 → SOME_UNAVAILABLE (C-52)
 *   qandeel://s803-proof/discard    the newest draft of owner A is discarded
 *
 * Every result is printed on screen (testID `s803-log`) as one short line; no audio, path or token is logged anywhere.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { createAppStateForegroundSignal } from '../../runtime-entry';
import { saveExportVoices } from '../../settings/export-file';
import { S803UiProof } from './S803UiProof';
import { VoiceNoteApiClient, type VoiceNoteFetch } from '../../voice-note/voice-note-api';
import { createVoiceNoteCapture, type VoiceNoteCapture } from '../../voice-note/voice-note-capture';
import { createCaptureScreenHold, createExpoVoiceRecorderPort } from '../../voice-note/voice-note-recorder-port';
import { createDeviceVoiceDraftFiles, createVoiceDraftKeyValue, createVoiceDraftStore } from '../../voice-note/voice-draft-store';

const BASE = 'http://127.0.0.1:8803';
const TOKEN = 'Bearer s803-proof-token';
const OWNER_A = 'a0000000-0000-4000-8000-000000000803';
const OWNER_B = 'b0000000-0000-4000-8000-000000000803';
const SESSION = 'c0000000-0000-4000-8000-000000000803';

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (c) => {
  const r = Math.floor(Math.random() * 16);
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

const authorized: VoiceNoteFetch = (input, init) =>
  fetch(input, { ...init, headers: { ...init?.headers, Authorization: TOKEN } } as RequestInit) as unknown as ReturnType<VoiceNoteFetch>;

const store = createVoiceDraftStore(createVoiceDraftKeyValue(), createDeviceVoiceDraftFiles());
const files = createDeviceVoiceDraftFiles();
const api = new VoiceNoteApiClient({ baseUrl: BASE, fetch: authorized });

export function S803ProofRoot() {
  const [lines, setLines] = useState<string[]>(['S8B-03 proof ready']);
  const capture = useRef<VoiceNoteCapture | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const uploaded = useRef<string | null>(null);
  const say = (line: string) => setLines((previous) => [...previous.slice(-30), line]);
  const [ui, setUi] = useState<{ language: 'ar' | 'en'; settings: boolean } | null>(null);

  useEffect(() => {
    const foreground = createAppStateForegroundSignal();
    const recorder = createExpoVoiceRecorderPort();
    const made = createVoiceNoteCapture({ owner: OWNER_A, sessionId: SESSION, recorder, store, foreground, newId: uuid, screen: createCaptureScreenHold() });
    capture.current = made;
    // Each capture that really began recording gets the next number, so a step can prove a NEW capture (`RECORDING #2`)
    // instead of matching a line an earlier capture left on screen. The draft's first 8 characters tie its RECORDING,
    // LIVE and STOPPED lines together; `same=` says the stopped draft is the one this capture began.
    let captures = 0;
    let began: string | null = null;
    let live = false;
    let left: string | null = null;
    const unsubscribe = made.subscribe(() => {
      const state = made.getState();
      if (state.kind === 'RECORDING') {
        if (state.draftId !== began) {
          captures += 1;
          began = state.draftId;
          live = false;
          left = null;
          say(`RECORDING #${captures} draft=${state.draftId.slice(0, 8)}`);
        } else if (!live && state.elapsedMs >= 1000) {
          // The recorder's own clock advanced: the capture is really running, not only started.
          live = true;
          say(`LIVE #${captures} ms=${state.elapsedMs}`);
        }
        return;
      }
      if (state.kind === 'STOPPED') {
        const d = state.draft;
        say(`STOPPED #${captures} draft=${d.draftId.slice(0, 8)} same=${d.draftId === began} by=${d.stoppedBy} left=${left ?? 'none'} bytes=${d.bytes} ms=${d.durationMs} check=${files.check(OWNER_A, d.draftId)}`);
      } else say(`capture ${state.kind}`);
    });
    // The app's lifecycle as the capture sees it — the SAME foreground signal the capture subscribes to (no second
    // platform listener) — with React Native's own word for the state, tagged with the capture it happened during.
    const unsubscribeLifecycle = foreground.subscribe((next) => {
      const status = AppState.currentState;
      if (next !== 'ACTIVE' && made.getState().kind === 'RECORDING' && left === null) left = status;
      say(`APPSTATE #${captures} ${status}`);
    });

    async function run(command: string): Promise<void> {
      // The production surface (S803UiProof): its language, Settings, or back to this log.
      if (command === 'ui-ar' || command === 'ui-en') {
        setUi({ language: command === 'ui-ar' ? 'ar' : 'en', settings: false });
        return;
      }
      if (command === 'ui-settings' || command === 'ui-conversation') {
        setUi((previous) => (previous === null ? previous : { ...previous, settings: command === 'ui-settings' }));
        return;
      }
      if (command === 'ui-close') {
        setUi(null);
        return;
      }
      if (command === 'record') {
        await made.start();
        return;
      }
      if (command === 'stop') {
        await made.stop();
        return;
      }
      if (command === 'list') {
        const a = await store.list(OWNER_A);
        const b = await store.list(OWNER_B);
        say(`LIST A drafts=${a.drafts.length} [${a.drafts.map((d) => `${d.state}:${d.stoppedBy}:${d.bytes}`).join(',')}] accepted=${a.accepted.length}; B drafts=${b.drafts.length}`);
        return;
      }
      if (command === 'recover') {
        const result = await store.recover(OWNER_A);
        const a = await store.list(OWNER_A);
        say(`RECOVER unrecoverable=${result.unrecoverable} drafts=${a.drafts.length} [${a.drafts.map((d) => `${d.state}:${d.stoppedBy}:${d.bytes}`).join(',')}]`);
        return;
      }
      if (command === 'discard') {
        const a = await store.list(OWNER_A);
        const last = a.drafts[a.drafts.length - 1];
        if (last === undefined) return say('DISCARD none');
        await store.discard(OWNER_A, last.draftId);
        say(`DISCARD ok exists=${files.size(OWNER_A, last.draftId) !== null}`);
        return;
      }
      if (command === 'upload') {
        const a = await store.list(OWNER_A);
        const draft = [...a.drafts].reverse().find((d) => d.state === 'SAVED');
        if (draft === undefined) return say('UPLOAD no draft');
        const bytes = files.read(OWNER_A, draft.draftId);
        const result = await api.upload(SESSION, draft.commandId, bytes, new AbortController().signal);
        if (result.kind === 'ACCEPTED') {
          await store.accept(OWNER_A, draft.draftId, { recordingId: result.recordingId, sessionId: SESSION, durationMs: draft.durationMs, availableUntil: result.availableUntil });
          uploaded.current = result.recordingId;
        }
        say(`UPLOAD ${result.kind} bytes=${bytes.length} draftLeft=${files.size(OWNER_A, draft.draftId) !== null}`);
        return;
      }
      if (command === 'play') {
        if (uploaded.current === null) return say('PLAY nothing uploaded');
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
        player.current?.release();
        const next = createAudioPlayer({ uri: api.playbackUrl(uploaded.current), headers: { Authorization: TOKEN } });
        player.current = next;
        next.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded && status.playing === false && status.didJustFinish) say(`PLAY finished duration=${status.duration.toFixed(2)}`);
        });
        next.play();
        setTimeout(() => {
          const s = next.currentStatus;
          say(`PLAY loaded=${s.isLoaded} playing=${s.playing} duration=${s.duration.toFixed(2)} at=${s.currentTime.toFixed(2)}`);
        }, 2500);
        return;
      }
      if (command === 'pause') {
        player.current?.pause();
        say(`PAUSE at=${player.current?.currentStatus.currentTime.toFixed(2)}`);
        return;
      }
      if (command === 'export-voices' || command === 'export-voices-gone') {
        // The PRODUCTION saver (Settings C-49) over the platform half it ships with: SAF folder, streamed download with
        // the bearer in a header, length + SHA-256 in and read back, manifest last. Only the outcome word is logged.
        const read = await authorized(`${BASE}/s803/voice-manifest${command === 'export-voices-gone' ? '?gone=1' : ''}`, { method: 'GET' });
        const manifest = (await read.json()) as { format: string; files: { fileName: string; bytes: number }[] };
        const result = await saveExportVoices(
          { manifest, files: manifest.files },
          { url: (fileName) => api.exportVoiceUrl(fileName), authorization: () => ({ Authorization: TOKEN }) },
        );
        say(`VOICES ${result} files=${manifest.files.length}`);
        return;
      }
      say(`unknown ${command}`);
    }

    const handle = (url: string | null) => {
      const match = url?.match(/^qandeel:\/\/s803-proof\/([a-z-]+)/u);
      if (!match) return;
      // A launch link reaches a running activity while Android has it paused (onNewIntent): the command runs once the
      // app is in front of the reader again, as a reader's tap would be.
      const go = (left: number) => {
        if (foreground.current() === 'ACTIVE' || left === 0) {
          void run(match[1]).catch((error) => say(`ERROR ${(error as Error)?.message ?? 'unknown'}`));
        } else setTimeout(() => go(left - 1), 100);
      };
      setTimeout(() => go(30), 300);
    };
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', (event) => handle(event.url));
    return () => {
      subscription.remove();
      unsubscribe();
      unsubscribeLifecycle();
      made.retire();
      recorder.release();
      player.current?.release();
    };
  }, []);

  if (ui !== null) {
    return (
      <View style={styles.root}>
        <StatusBar style="auto" />
        <S803UiProof key={ui.language} language={ui.language} settings={ui.settings} onClose={() => setUi(null)}
          onLeave={() => setUi((previous) => (previous === null ? previous : { ...previous, settings: true }))} />
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <StatusBar style="auto" />
      <View style={styles.row}>
        {(['record', 'stop', 'cancel'] as const).map((name) => (
          <Pressable key={name} testID={`s803-${name}`} accessibilityRole="button" style={styles.button}
            onPress={() => {
              const made = capture.current;
              if (made === null) return;
              if (name === 'record') {
                // A tap that does not begin a capture says why, once — what the capture was in and what React Native
                // reported for the app — so a refused start is never mistaken for one that ran. It retries nothing.
                const before = made.getState().kind;
                void made.start().then(() => {
                  const after = made.getState().kind;
                  if (after !== 'RECORDING') say(`START ended state=${after} from=${before} app=${AppState.currentState}`);
                });
                return;
              }
              void (name === 'stop' ? made.stop() : made.cancel());
            }}>
            <Text style={styles.label}>{name.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text testID="s803-log" style={styles.log}>{lines.join('\n')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 48 },
  button: { minWidth: 96, minHeight: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dddddd', borderRadius: 8 },
  label: { fontSize: 16, color: '#111111' },
  log: { fontSize: 13, color: '#111111' },
});
