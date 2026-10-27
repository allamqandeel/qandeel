/**
 * S5-04 — the ONE Public QANDEEL model-input assembler (CW2-04 §21–§22; CW2-08 §17 / H13).
 *
 * It is NOT the Shared assembler and shares none of its semantics. Its whole input is `PublicQandeelContext`, which is
 * exactly what migration 0147's server context read served under the live work lease: the exact served version's public
 * package, its reviewed meaning and themes, its current served discussion up to the invoking post, earlier Public QANDEEL
 * responses, and the reviewed meaning of each CURRENT explicitly related Experience. There is no field for an author, a
 * Public display, an account, a Personal / Shared / memory / human-model / hypothesis / Matching / Introduction context,
 * provenance or a source World — so nothing of that kind can reach the provider through this module. The invoking human's
 * identity is used for cost accounting by the caller and never enters the request.
 *
 * The request adds the frozen Behavioral Response Policy (TEXT_V1), unchanged, and a short STRUCTURAL frame telling the
 * model the truth about where it is: a public discussion under one published Experience, where its answer is public
 * discussion material, not a private conversation. After that unchanged prefix comes the ONE QANDEEL personality in its
 * world-neutral form, and on a Safety GUIDED turn the approved humour suspension (the ACE-SP-01 controlled amendment);
 * it reads no Personal preference, person or state. Pure; no I/O.
 *
 * S8A-05 CP4 (migration 0182, Controlled Amendment A-5(c)): the production context is 0182's BRANCH — the topic as one
 * bounded labelled text, its reviewed meaning and themes, the invoking post's chain of replies to its thread root and at
 * most 8 more posts of that thread, each with its speaker role (the topic's author, the asker, another participant) and
 * the post it answers, and QANDEEL's earlier answers attached to the posts they answered. A context carrying `topic` is
 * rendered that way (`branchBlock`); the older whole-discussion shape stays for the evaluation fixtures that build it.
 * The roles are derived by the database from Public Identities and are never names; the frame above is unchanged.
 */
import { TEXT_V1_BEHAVIORAL_GUIDANCE, withWorldNeutralPersonality } from '../conversation/behavioral-response-policy.service';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { HISTORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import type { ModelRouterRequest } from '../model-router/model-router.types';

/** S8A-05 CP4 (0182): who wrote a post, relative to the topic and to the human asking now — never a name. */
export type PublicQandeelSpeaker = 'OP' | 'ASKER' | 'PARTICIPANT';
export interface PublicQandeelPost {
  readonly id: string; readonly ordinal: number; readonly invoking: boolean; readonly text: string;
  /** 0182 only. */
  readonly speaker?: PublicQandeelSpeaker;
  /** 0182 only: the id of the post this one replies to, or null at the top of the thread. */
  readonly replyTo?: string | null;
}
/** 0182: one earlier Public QANDEEL answer, attached to the post it answered. */
export interface PublicQandeelEarlierAnswer { readonly answers: string; readonly text: string }
export interface PublicQandeelContentItem { readonly ordinal: number; readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS'; readonly text: string }

/** The assembler's ENTIRE input: public-visible truth only. */
export interface PublicQandeelContext {
  readonly versionId: string;
  readonly meaning: string;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
  readonly content: ReadonlyArray<PublicQandeelContentItem>;
  readonly posts: ReadonlyArray<PublicQandeelPost>;
  readonly earlierResponses: ReadonlyArray<string>;
  readonly related: ReadonlyArray<string>;
  /** 0182: the topic as ONE bounded labelled text (≤ 6 KB, the database's bound); its presence selects the branch layout. */
  readonly topic?: string;
  /** 0182: earlier Public QANDEEL answers in the branch, each attached to the post it answered. */
  readonly earlierAnswers?: ReadonlyArray<PublicQandeelEarlierAnswer>;
}

export const PUBLIC_QANDEEL_FRAME = [
  'This is a public discussion under one published Experience in the QANDEEL Public World. A participant explicitly asked you, QANDEEL, to respond.',
  'Your answer is public discussion material: everyone who can see this Experience can read it. It is not a private conversation.',
  'You know only the published Experience and the public discussion below. You know nothing else about any participant, and you never imply otherwise or guess who anyone is.',
].join('\n');

/** The longest public answer the discussion keeps (the 0147 bound). */
export const PUBLIC_QANDEEL_RESPONSE_MAX = 4000;

const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

/** The published Experience, as the model reads it. */
function experienceBlock(context: PublicQandeelContext): string {
  const lines = [`Published Experience — its reviewed meaning: ${context.meaning}`];
  if (context.primaryThemes.length > 0) lines.push(`Themes: ${[...context.primaryThemes, ...context.secondaryThemes].join(', ')}`);
  for (const item of context.content) lines.push(`${item.kind === 'ANALYSIS' ? 'Published analysis' : 'Published words'}: ${item.text}`);
  if (context.related.length > 0) lines.push(`Explicitly related public Experiences: ${context.related.join(' | ')}`);
  if (context.earlierResponses.length > 0) lines.push(...context.earlierResponses.map((response) => `An earlier public QANDEEL response here: ${response}`));
  return lines.join('\n');
}

/**
 * The bounded discussion: the invoking post always; the earlier posts newest-first while they fit the history budget,
 * shown in their canonical order. Every participant is "A participant" — never a name, a label or an identifier.
 */
export function boundedPublicDiscussion(posts: ReadonlyArray<PublicQandeelPost>): string | null {
  const invoking = posts.find((post) => post.invoking);
  if (invoking === undefined) return null;
  const earlier = posts.filter((post) => !post.invoking && post.ordinal < invoking.ordinal).sort((a, b) => a.ordinal - b.ordinal);
  const kept: string[] = [];
  let used = 0;
  for (let index = earlier.length - 1; index >= 0; index -= 1) {
    const line = `A participant: ${earlier[index].text}`;
    if (used + bytes(line) > HISTORY_BUDGET_BYTES) break;
    used += bytes(line);
    kept.unshift(line);
  }
  return [...(kept.length > 0 ? ['The public discussion so far:', ...kept] : []), `The participant asking you now: ${invoking.text}`].join('\n');
}

/** A-5(c): the labels the model reads. Speaker roles come from the database; posts are numbered in this message only. */
export const TOPIC_HEADER = "The published topic. Lines marked AUTHOR or AUTHOR_TEXT are its author's own words; lines marked QANDEEL or QANDEEL_UNDERSTANDING are your own words the author chose to publish.";
export const THREAD_HEADER = [
  "This thread of the public discussion, oldest first. [OP] is the topic's author. [Asker] is the person asking you now. [Participant] is anyone else; two posts marked [Participant] may or may not be the same person.",
  "[QANDEEL] is one of your own earlier public replies here: a reading, not a fact, and not the author's view. What the author says in the topic and in [OP] posts decides what the author means.",
].join('\n');
const SPEAKER_LABEL: Record<PublicQandeelSpeaker, string> = { OP: '[OP]', ASKER: '[Asker]', PARTICIPANT: '[Participant]' };

/** The published topic, as the model reads it in the branch layout (A-5(c)). */
function topicBlock(context: PublicQandeelContext): string {
  const lines: string[] = [];
  if (context.topic !== undefined && context.topic.trim().length > 0) lines.push(TOPIC_HEADER, context.topic);
  lines.push(`Its reviewed meaning: ${context.meaning}`);
  if (context.primaryThemes.length > 0) lines.push(`Themes: ${[...context.primaryThemes, ...context.secondaryThemes].join(', ')}`);
  return lines.join('\n');
}

/**
 * The branch, bounded (A-5(c)): the invoking post always; then its chain of replies up to the thread root, nearest first;
 * then the other posts, newest first — each post with the earlier QANDEEL answers attached to it — while they fit the
 * history budget; shown in their canonical order, numbered in this message only.
 */
export function branchBlock(context: PublicQandeelContext): string | null {
  const invoking = context.posts.find((post) => post.invoking);
  if (invoking === undefined || invoking.speaker === undefined) return null;
  const posts = [...context.posts].sort((a, b) => a.ordinal - b.ordinal);
  const byId = new Map(posts.map((post) => [post.id, post]));
  const answersOf = (id: string) => (context.earlierAnswers ?? []).filter((answer) => answer.answers === id).map((answer) => answer.text);
  const chain: PublicQandeelPost[] = [];
  for (let at = byId.get(invoking.replyTo ?? ''); at !== undefined && !chain.includes(at); at = byId.get(at.replyTo ?? '')) chain.push(at);
  const others = posts.filter((post) => post !== invoking && !chain.includes(post)).reverse();
  const cost = (post: PublicQandeelPost) => bytes(post.text) + answersOf(post.id).reduce((sum, text) => sum + bytes(text), 0) + 48;
  const kept = new Set<PublicQandeelPost>([invoking]);
  let used = cost(invoking);
  for (const post of [...chain, ...others]) {
    if (used + cost(post) > HISTORY_BUDGET_BYTES) continue;
    used += cost(post);
    kept.add(post);
  }
  const shown = posts.filter((post) => kept.has(post));
  const number = new Map(shown.map((post, index) => [post.id, index + 1]));
  const lines = [THREAD_HEADER];
  for (const post of shown) {
    const target = post.replyTo === null || post.replyTo === undefined ? ''
      : number.has(post.replyTo) ? ` replying to #${number.get(post.replyTo)}` : ' replying to an earlier post not shown';
    const asking = post.invoking ? ' — asking you now' : '';
    lines.push(`#${number.get(post.id)} ${SPEAKER_LABEL[post.speaker ?? 'PARTICIPANT']}${target}${asking}: ${post.text}`);
    if (!post.invoking) for (const answer of answersOf(post.id)) lines.push(`   [QANDEEL] answering #${number.get(post.id)}: ${answer}`);
  }
  return lines.join('\n');
}

export function assemblePublicQandeelRequest(context: PublicQandeelContext, safetyGuidance?: string): ModelRouterRequest | null {
  const discussion = context.topic === undefined ? boundedPublicDiscussion(context.posts) : branchBlock(context);
  const invoking = context.posts.find((post) => post.invoking);
  if (discussion === null || invoking === undefined) return null;
  const path = decideFastDeepRoute(invoking.text).path;
  return {
    task: 'CONVERSATIONAL_RESPONSE',
    path,
    complexity: path === 'DEEP' ? 'HIGH' : 'LOW',
    behavioralGuidance: withWorldNeutralPersonality(`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${PUBLIC_QANDEEL_FRAME}`, Boolean(safetyGuidance)),
    ...(safetyGuidance === undefined ? {} : { safetyGuidance }),
    context: [{ role: 'USER', content: `${context.topic === undefined ? experienceBlock(context) : topicBlock(context)}\n\n${discussion}` }],
    locale: 'und',
    modality: 'TEXT',
    // S8A-05 CP4 (QAN-BL-AI-04 for Public, A-5(d)): DEEP 25 s, the Personal DEEP measurement on the same model; FAST 3 s.
    latencyBudgetMs: path === 'DEEP' ? 25000 : 3000,
    costBudget: 'LOW',
    safetyLevel: 'STANDARD',
  };
}

/** A model's answer, bounded for the public discussion, or null when there is nothing to record. */
export function boundPublicQandeelResponse(content: unknown): string | null {
  if (typeof content !== 'string') return null;
  const text = content.trim();
  if (text.length === 0) return null;
  return text.length > PUBLIC_QANDEEL_RESPONSE_MAX ? text.slice(0, PUBLIC_QANDEEL_RESPONSE_MAX).trimEnd() : text;
}
