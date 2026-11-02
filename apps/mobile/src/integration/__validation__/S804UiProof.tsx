/**
 * S8B-04 (CP2) — the PRODUCTION automatic voice reply on a real device, for the Product Owner's gate captures. VALIDATION
 * ONLY (reached from S804FastVoiceProofRoot).
 *
 * Mounted exactly as DepthComposition mounts them: the real ConversationSurface and conversation controller over the real
 * turn client, the Voice Note slots from `useVoiceNoteSurface` (including `replyCompanion`), the real Session runtime over
 * `createDeviceVoiceNotes()` (the S8B-03 recorder, the PCM live-note stream and the player) and the real API client. Only
 * the server is stood in: `scripts/s8b-04/fake-auto-reply-server.cjs` through `adb reverse tcp:8805 tcp:8805`. One Session
 * per language, so each capture starts from its own empty Conversation.
 */
import { useEffect, useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ConversationSurface, createConversationController } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { ConversationTurnApiClient, createAppStateForegroundSignal } from '../../runtime-entry';
import { createDeviceVoiceNotes, createVoiceNoteSessionRuntime, useVoiceNoteSurface, VoiceNoteApiClient } from '../../voice-note';
import type { VoiceNoteFetch } from '../../voice-note/voice-note-api';

const BASE = 'http://127.0.0.1:8805';
const TOKEN = 'Bearer s804-ui-proof-token';
const OWNER_UI = 'e0000000-0000-4000-8000-000000000804';
const SESSIONS: Record<ChromeLanguage, string> = { ar: 'd0000000-0000-4000-8000-000000000804', en: 'd0000000-0000-4000-8000-000000000805' };
const INSETS = { top: 36, right: 0, bottom: 24, left: 0 };

const authorized = (input: string, init?: Record<string, unknown>) =>
  fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: TOKEN } } as RequestInit);

function build(language: ChromeLanguage) {
  const sessionId = SESSIONS[language];
  const foreground = createAppStateForegroundSignal();
  const turns = new ConversationTurnApiClient({ baseUrl: BASE, fetch: authorized as never });
  const conversation = createConversationController({ sessionId, transport: turns, isCurrent: () => true, onReplyCommitted: () => undefined });
  const api = new VoiceNoteApiClient({ baseUrl: BASE, fetch: authorized as unknown as VoiceNoteFetch });
  const session = createVoiceNoteSessionRuntime({
    owner: OWNER_UI,
    sessionId,
    transport: { api, authorization: () => ({ Authorization: TOKEN }) },
    device: createDeviceVoiceNotes(),
    foreground,
    isCurrent: () => true,
    conversation,
  });
  return { conversation, session };
}

export function S804UiProof({ language, onClose }: { readonly language: ChromeLanguage; readonly onClose: () => void }) {
  const built = useMemo(() => build(language), [language]);
  useEffect(() => () => built.session.retire(), [built]);
  const slots = useVoiceNoteSurface(built.session, language, true);
  return (
    <GestureHandlerRootView style={{ flex: 1 }} testID="s804-ui">
      <ConversationSurface controller={built.conversation} language={language} insets={INSETS} onOpenAnalysis={onClose} {...slots} />
      <Pressable accessibilityRole="button" accessibilityLabel="close proof" onPress={onClose} testID="s804-ui-close" style={{ position: 'absolute', top: INSETS.top + 4, left: 4, padding: 12 }}>
        <Text style={{ fontSize: 10, color: '#888' }}>×</Text>
      </Pressable>
    </GestureHandlerRootView>
  );
}
