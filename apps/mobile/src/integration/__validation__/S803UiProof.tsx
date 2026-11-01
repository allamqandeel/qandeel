/**
 * S8B-03 (CP2) — the PRODUCTION Voice Note surface on a real device. VALIDATION ONLY (reached from S803ProofRoot).
 *
 * Mounted exactly as DepthComposition mounts them: the real ConversationSurface and conversation controller over the
 * real turn client, the four neutral slots from `useVoiceNoteSurface`, the real Session runtime
 * (`createVoiceNoteSessionRuntime` over `createDeviceVoiceNotes()`: expo-audio recorder + player, the documents-directory
 * drafts and kv-store), the real Settings section and the real API client. Only the server is stood in: the local fake
 * voice API (Fake Speechmatics, faults by toggle file) through `adb reverse`. Its own owner and Session, so no draft of
 * the capability proof is ever shown here.
 */
import { useEffect, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ConversationSurface, createConversationController } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { ConversationTurnApiClient, createAppStateForegroundSignal } from '../../runtime-entry';
import { createDeviceVoiceNotes, createVoiceNoteSessionRuntime, useVoiceNoteSurface, VoiceNoteApiClient, VoiceNoteSettingsSection } from '../../voice-note';
import type { VoiceNoteFetch } from '../../voice-note/voice-note-api';

const BASE = 'http://127.0.0.1:8803';
const TOKEN = 'Bearer s803-proof-token';
const OWNER_UI = 'e0000000-0000-4000-8000-000000000803';
const SESSION_UI = 'd0000000-0000-4000-8000-000000000803';
const INSETS = { top: 36, right: 0, bottom: 24, left: 0 };

const authorized = (input: string, init?: Record<string, unknown>) =>
  fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: TOKEN } } as RequestInit);

function build() {
  const foreground = createAppStateForegroundSignal();
  const turns = new ConversationTurnApiClient({ baseUrl: BASE, fetch: authorized as never });
  const conversation = createConversationController({ sessionId: SESSION_UI, transport: turns, isCurrent: () => true, onReplyCommitted: () => undefined });
  const api = new VoiceNoteApiClient({ baseUrl: BASE, fetch: authorized as unknown as VoiceNoteFetch });
  const session = createVoiceNoteSessionRuntime({
    owner: OWNER_UI,
    sessionId: SESSION_UI,
    transport: { api, authorization: () => ({ Authorization: TOKEN }) },
    device: createDeviceVoiceNotes(),
    foreground,
    isCurrent: () => true,
    conversation,
  });
  return { conversation, session };
}

export function S803UiProof({ language, settings, onClose, onLeave }: {
  readonly language: ChromeLanguage;
  readonly settings: boolean;
  readonly onClose: () => void;
  /** The in-app way out of the Conversation (its analysis entry, as Depth is in the product): no Android lifecycle. */
  readonly onLeave: () => void;
}) {
  const built = useMemo(() => build(), []);
  useEffect(() => () => built.session.retire(), [built]);
  // The Conversation is in front unless the Settings section is shown.
  const slots = useVoiceNoteSurface(built.session, language, !settings);
  return (
    // As ProductRoot does: the voice message's line takes its touches through the gesture handler.
    <GestureHandlerRootView style={{ flex: 1 }} testID="s803-ui">
      {settings ? (
        <View style={{ flex: 1, paddingTop: INSETS.top }} testID="s803-ui-settings">
          <VoiceNoteSettingsSection session={built.session} language={language} />
        </View>
      ) : (
        <ConversationSurface controller={built.conversation} language={language} insets={INSETS} onOpenAnalysis={onLeave} {...slots} />
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="close proof" onPress={onClose} testID="s803-ui-close" style={{ position: 'absolute', top: INSETS.top + 4, left: 4, padding: 12 }}>
        <Text style={{ fontSize: 10, color: '#888' }}>×</Text>
      </Pressable>
    </GestureHandlerRootView>
  );
}
