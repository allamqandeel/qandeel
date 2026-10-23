// S8A-01 - the initial model-output release guard.
//
// A provider's candidate text is not a QANDEEL reply until it passes these deterministic checks; a candidate that
// fails is withheld whole, before anything is persisted or shown, and the turn fails as an ordinary generation
// failure (no partial text, no substitute wording). The guard is provider-neutral and reads only the candidate and
// the server guidance that produced it. It logs nothing and keeps nothing.
//
// It is deliberately NOT a content classifier: harmful-content judgement is not claimed here (the input Safety Gate
// is not an output classifier, and the provider's own content filter is handled by the adapter as a refusal). What it
// enforces is structural: the reply is readable text, it does not expose QANDEEL's internal context containers or a
// reasoning trace, and it does not reproduce QANDEEL's server-authored instructions verbatim.

/** The internal data containers composeServerGuidance renders, plus a reasoning-trace tag. */
const INTERNAL_CONTAINERS = [
  'user_memory_context',
  'him_reasoning_context',
  'him_brain_context',
  'hypothesis_reasoning_context',
  'recommendation_grounding_context',
  'question_context',
  // S8A-02 CP2 (CA-S3): the Shared attribution notes container; a reply that exposes it is withheld.
  'shared_attribution_notes',
  'think',
] as const;
const INTERNAL_CONTAINER_TAG = new RegExp(`<\\s*/?\\s*(?:${INTERNAL_CONTAINERS.join('|')})\\s*>`, 'iu');
// C0 / C1 controls other than tab and line breaks, and the replacement character, mark text that is not readable.
const UNREADABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F�]/u;
/** A server-authored sentence at least this long, repeated verbatim, is an instruction leak, not a coincidence. */
export const GUIDANCE_ECHO_MIN_LENGTH = 48;

export type ModelOutputWithheldReason = 'EMPTY' | 'UNREADABLE' | 'INTERNAL_CONTAINER' | 'GUIDANCE_ECHO';

export class ModelOutputWithheldError extends Error {
  constructor(readonly reason: ModelOutputWithheldReason) {
    super('Model output withheld.');
    this.name = 'ModelOutputWithheldError';
  }
}

const collapse = (text: string): string => text.replace(/\s+/gu, ' ');

/**
 * The server-authored sentences of the guidance. Structured data containers are removed first: they carry the user's
 * own Memory and context, which a reply may legitimately say back to them.
 */
function serverAuthoredSentences(serverGuidance: string): string[] {
  // The Shared attribution notes container holds the server's fixed header and instruction ahead of its `- [` note lines
  // (S8A-02 CP2, CA-S3); those instructions stay checked for verbatim echo, only the note lines are data.
  const prose = serverGuidance
    .replace(/<shared_attribution_notes>([\s\S]*?)<\/shared_attribution_notes>/gu, (_container, body: string) =>
      `\n${body.split('\n').filter((line) => !line.startsWith('- [')).join('\n')}\n`)
    .replace(/<([a-z_]+)>[\s\S]*?<\/\1>/gu, '\n');
  return prose
    .split(/\n+|(?<=[.!?:])\s+/u)
    .map((sentence) => collapse(sentence).trim())
    .filter((sentence) => sentence.length >= GUIDANCE_ECHO_MIN_LENGTH);
}

/** Returns the releasable reply, or throws ModelOutputWithheldError. */
export function releaseModelOutput(candidate: string, serverGuidance: string): string {
  const content = candidate.trim();
  if (!content) throw new ModelOutputWithheldError('EMPTY');
  if (UNREADABLE.test(content)) throw new ModelOutputWithheldError('UNREADABLE');
  if (INTERNAL_CONTAINER_TAG.test(content)) throw new ModelOutputWithheldError('INTERNAL_CONTAINER');
  const reply = collapse(content);
  if (serverAuthoredSentences(serverGuidance).some((sentence) => reply.includes(sentence))) {
    throw new ModelOutputWithheldError('GUIDANCE_ECHO');
  }
  return content;
}
