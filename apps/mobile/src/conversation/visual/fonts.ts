/**
 * W1A-01 — the Estedad v8.5 faces the Conversation surface is set in.
 *
 * The files are the release's OWN static instances (see `assets/fonts/estedad/SOURCE.json`), bundled
 * with the app and loaded once through `expo-font`. Loading is deterministic: the surface renders
 * nothing of itself until the faces are registered, so there is no first frame in a fallback face.
 * If registration fails the surface still renders — the platform then substitutes its own face —
 * because refusing to show the reader's conversation over a font would be the worse failure.
 */
import { useFonts } from 'expo-font';

import { TYPEFACE } from './theme';

// Bundled font assets are Metro `require`s.
const FACES = {
  [TYPEFACE.regular]: require('../../../assets/fonts/estedad/Estedad-Regular.ttf'),
  [TYPEFACE.medium]: require('../../../assets/fonts/estedad/Estedad-Medium.ttf'),
};

/** True once the faces are registered, or once registration has definitively failed. */
export function useConversationTypeface(): boolean {
  const [loaded, error] = useFonts(FACES);
  return loaded || error !== null;
}
