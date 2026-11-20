/**
 * COSMOS-FINAL-01 E-1 — who said it, at a glance (Product Owner UI-Polish Addendum, 2026-11-20).
 *
 * Every turn in the Personal and the Shared conversation carries one small circular badge: the speaker's initials on
 * a restrained tone that stays the same for that speaker throughout the conversation.
 *
 *   - QANDEEL is always `QA`, on its own tone.
 *   - The reader is the initials of the reader's own account Name, on the reader's own tone. The reader's Name is
 *     shown only to the reader.
 *   - Another person is the initials of the Name this reader is already shown for them. Nothing is derived from
 *     anything the reader cannot already see: no identifier, no account, no other World. Their tone comes from that
 *     same visible Name, so it is stable wherever that Name is, and carries nothing the Name does not.
 *   - With no Name there are no letters: the badge is the tone alone. A Name is never invented (W1B-01).
 *
 * Initials: the first letter of the first word and, when there are more words, of the last. Latin letters are capitals
 * written together (`MA`); Arabic letters are written apart (`م ع`), so each stands as its own letter and never joins.
 */

export const QANDEEL_INITIALS = 'QA';

export type SpeakerTone = 'QANDEEL' | 'READER' | 'SAGE' | 'ROSE' | 'PLUM' | 'TEAL';

/** The tones another person may take. QANDEEL's and the reader's are their own and never assigned to anyone else. */
const OTHER_TONES: readonly SpeakerTone[] = ['SAGE', 'ROSE', 'PLUM', 'TEAL'];

/**
 * Fill and ink per tone and appearance. Low-chroma fills that sit quietly on the World; the ink is the same hue, far
 * enough apart to read (each pair is at least 7:1).
 */
export const SPEAKER_TONES: Readonly<Record<'DARK' | 'LIGHT', Readonly<Record<SpeakerTone, { readonly fill: string; readonly ink: string }>>>> = Object.freeze({
  DARK: Object.freeze({
    QANDEEL: { fill: '#3b3324', ink: '#e3cf9f' },
    READER: { fill: '#243040', ink: '#b9c9e0' },
    SAGE: { fill: '#263329', ink: '#b7d1bb' },
    ROSE: { fill: '#3a2a2a', ink: '#dcb6b0' },
    PLUM: { fill: '#31293b', ink: '#c9bad9' },
    TEAL: { fill: '#20333a', ink: '#a9cdd4' },
  }),
  LIGHT: Object.freeze({
    QANDEEL: { fill: '#e6dcc4', ink: '#4f4120' },
    READER: { fill: '#d4dce8', ink: '#2a3b58' },
    SAGE: { fill: '#d5e1d6', ink: '#2b4431' },
    ROSE: { fill: '#e8d6d2', ink: '#56312c' },
    PLUM: { fill: '#ddd4e6', ink: '#423556' },
    TEAL: { fill: '#cfe0e3', ink: '#20444b' },
  }),
});

const isArabicLetter = (code: number) =>
  (code >= 0x0620 && code <= 0x064a) || (code >= 0x066e && code <= 0x06d3) || (code >= 0x06fa && code <= 0x06ff)
  || (code >= 0x0750 && code <= 0x077f) || (code >= 0x08a0 && code <= 0x08c9);
/** A letter in a cased script (Latin, Greek, Cyrillic, …) changes under case mapping; marks, digits and signs do not. */
const isCasedLetter = (ch: string) => ch.toLowerCase() !== ch.toUpperCase();

/** A word's first letter, or null when it has none (digits and signs alone are not a letter). */
function firstLetter(word: string): string | null {
  for (const ch of Array.from(word)) {
    const code = ch.codePointAt(0) ?? 0;
    if (isArabicLetter(code) || isCasedLetter(ch)) return ch;
  }
  return null;
}

/** The initials of a visible Name, or '' when it has no letter to show. */
export function speakerInitials(name: string | null): string {
  if (name === null) return '';
  const letters = name.trim().split(/\s+/u).map(firstLetter).filter((letter): letter is string => letter !== null);
  if (letters.length === 0) return '';
  const chosen = letters.length === 1 ? [letters[0]] : [letters[0], letters[letters.length - 1]];
  const arabic = chosen.some((letter) => isArabicLetter(letter.codePointAt(0) ?? 0));
  return arabic ? chosen.join(' ') : chosen.map((letter) => letter.toUpperCase()).join('');
}

/** Another person's tone, from the Name the reader is shown for them: the same Name, the same tone, every time. */
export function otherSpeakerTone(name: string | null): SpeakerTone {
  const key = (name ?? '').trim().normalize('NFC');
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return OTHER_TONES[hash % OTHER_TONES.length];
}
