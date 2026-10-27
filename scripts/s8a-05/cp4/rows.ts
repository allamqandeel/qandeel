// S8A-05 CP4 — Tier Q: the preregistered case shape, and the case → 0182's context rows (shared by tier-q-eval.ts and
// budget.ts; no side effects). Operator-only: never a CI step, never imported by production code.
import { createHash } from 'node:crypto';
import type { PublicQandeelContextRow } from '../../../apps/api/src/public-world/public-discussion.repository';
import { TOPIC_HEADER, THREAD_HEADER, assemblePublicQandeelRequest } from '../../../apps/api/src/public-world/public-qandeel-model-input';
import { publicQandeelContextOf } from '../../../apps/api/src/public-world/public-qandeel-reply.service';

export interface CasePost { readonly ref: string; readonly speaker: 'OP' | 'ASKER' | 'PARTICIPANT'; readonly replyTo: string | null; readonly text: string; readonly invoking?: boolean }
export interface Case {
  readonly id: string; readonly language: string; readonly kind: string; readonly traps: string[];
  readonly topic: { readonly text: string; readonly meaning: string; readonly themes: string[] };
  readonly posts: CasePost[]; readonly earlierAnswers: { readonly answers: string; readonly text: string }[];
  readonly expect: { readonly opView: string; readonly notOpView: string[]; readonly question: string; readonly replyLanguage: 'ar' | 'en' };
  readonly gloss: string;
}
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

/** The case → 0182's context rows, in the read's own shape and order (version, topic, meaning, themes, posts, answers). */
export function rowsOf(c: Case, index: number): PublicQandeelContextRow[] {
  const ids = new Map(c.posts.map((post, i) => [post.ref, uuid(index * 100 + i + 1)]));
  const row = (kind: string, role: string | null, ordinal: number, ref: string | null, text: string | null, speaker: string | null = null, answers: string | null = null) =>
    ({ context_kind: kind, context_role: role, context_ordinal: ordinal, context_ref: ref, context_text: text, speaker, answers_ref: answers }) as unknown as PublicQandeelContextRow;
  return [
    row('VERSION', null, 0, uuid(9_000_000 + index), null),
    row('TOPIC', null, 0, null, c.topic.text),
    row('MEANING', null, 0, null, c.topic.meaning),
    ...c.topic.themes.map((theme, i) => row('THEME', 'PRIMARY', i + 1, null, theme)),
    ...c.posts.map((post, i) => row('POST', post.invoking ? 'INVOKING' : 'THREAD', i + 1, ids.get(post.ref)!, post.text, post.speaker,
      post.replyTo === null ? null : ids.get(post.replyTo)!)),
    ...c.earlierAnswers.map((answer, i) => row('QANDEEL', null, i + 1, null, answer.text, null, ids.get(answer.answers)!)),
  ];
}

/**
 * The words the model is instructed with, as one fingerprint (PREREGISTRATION.md): the whole behavioural guidance of an
 * unguided Public request (the personality core, the Text v1 guidance and the Public frame — none depends on the case) and
 * the two A-5(c) headers.
 */
export function instructionsSha256(c: Case): string {
  const context = publicQandeelContextOf(rowsOf(c, 0));
  const request = context === null ? null : assemblePublicQandeelRequest(context);
  if (request === null) throw new Error('NOT RUN: the first case builds no request');
  return createHash('sha256').update([request.behavioralGuidance, TOPIC_HEADER, THREAD_HEADER].join('\n'), 'utf8').digest('hex');
}
