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
 * discussion material, not a private conversation. Pure; no I/O.
 */
import { TEXT_V1_BEHAVIORAL_GUIDANCE } from '../conversation/behavioral-response-policy.service';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { HISTORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import type { ModelRouterRequest } from '../model-router/model-router.types';

export interface PublicQandeelPost { readonly id: string; readonly ordinal: number; readonly invoking: boolean; readonly text: string }
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

export function assemblePublicQandeelRequest(context: PublicQandeelContext, safetyGuidance?: string): ModelRouterRequest | null {
  const discussion = boundedPublicDiscussion(context.posts);
  const invoking = context.posts.find((post) => post.invoking);
  if (discussion === null || invoking === undefined) return null;
  const path = decideFastDeepRoute(invoking.text).path;
  return {
    task: 'CONVERSATIONAL_RESPONSE',
    path,
    complexity: path === 'DEEP' ? 'HIGH' : 'LOW',
    behavioralGuidance: `${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${PUBLIC_QANDEEL_FRAME}`,
    ...(safetyGuidance === undefined ? {} : { safetyGuidance }),
    context: [{ role: 'USER', content: `${experienceBlock(context)}\n\n${discussion}` }],
    locale: 'und',
    modality: 'TEXT',
    latencyBudgetMs: path === 'DEEP' ? 10000 : 3000,
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
