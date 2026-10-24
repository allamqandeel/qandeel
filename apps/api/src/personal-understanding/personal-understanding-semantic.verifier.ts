// S8A-03 Open Understanding (Product Owner decision 2026-10-24, CP2 amendment §10).
//
// The unified semantic check of capture schema v3. DeepSeek understands the language; this file never tries to
// understand it again with word lists. It verifies only what can be proved from the data itself:
//   * grounding: every kept span is a verbatim part of the user's current message (so nothing is ever put in the user's
//     mouth), within bounds, without a secret;
//   * ownership: the model must say whose fact it is and where it found that. UNCLEAR or INFERRED is never stored;
//     someone else's fact is stored only as that person's (OTHER), and the person's name / relation must literally
//     appear in the evidence the model cites - the span, the message, the user's own recent turns, or a known Memory -
//     so an uncertain owner can never become a fact about the user. A SELF fact that names a known other person is
//     refused (OWNER_CONFLICT);
//   * statement: only STATED facts are kept (never a question, a supposition, a quote, a wish or a joke / exaggeration);
//   * structure: a TEMPORARY state carries its own bounded lifetime, a plan carries no slot, someone else's fact never
//     a slot; atomic facts win over an overlapping compound one; importance decides which facts fit the declared bound;
//   * living state, forget and correct: only on the user's own known Memories, by opaque handle, one action per Memory,
//     each grounded in the user's words; a correction's new fact passes the same checks and keeps the owner.
// Polarity, time and meaning are the model's reading: no closed list overrules them (the adopted direction).
import { randomUUID } from 'node:crypto';
import { normalizeArabicComparison } from '../memory/arabic-text';
import { memoryIndexTerms } from '../memory/memory-retrieval-terms';
import { containsObviousSecret, MEMORY_IMPORTANCE, normalizeMemoryContent, screenMemoryCapture } from '../memory/memory-write-evaluator.service';
import type { MemoryRecord } from '../memory/memory.types';
import {
  MAX_PERSON_LABEL_CHARS,
  MAX_UNDERSTANDING_CORRECTIONS,
  MAX_UNDERSTANDING_FACTS_V3,
  MAX_UNDERSTANDING_FORGETS,
  MAX_UNDERSTANDING_KEY_LENGTH,
  MAX_UNDERSTANDING_KEYS,
  MAX_UNDERSTANDING_LIVING_UPDATES,
  MAX_UNDERSTANDING_SPAN_CHARS,
  UNDERSTANDING_COMMAND_KINDS,
  UNDERSTANDING_CONTEXT_STATUSES_V3,
  UNDERSTANDING_FACT_TYPES,
  UNDERSTANDING_IMPORTANCES,
  UNDERSTANDING_MODALITIES_V3,
  UNDERSTANDING_OWNER_BASES,
  UNDERSTANDING_OWNERS,
  UNDERSTANDING_POLARITIES,
  UNDERSTANDING_SLOTS,
  UNDERSTANDING_TEMPORALS,
  type PersonalUnderstandingCaptureOutputV3,
  type UnderstandingFactProposalV3,
  type UnderstandingKnownItem,
  type UnderstandingRecentTurn,
  type UnderstandingRejectionV3,
  type VerifiedUnderstandingCorrection,
  type VerifiedUnderstandingItemV3,
} from './personal-understanding.types';

const KNOWN_HANDLE = /^k(?:[1-9]|[1-3][0-9]|40)$/u;
const IMPORTANCE_RANK = { CORE: 0, USEFUL: 1, MINOR: 2 } as const;

function clean(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
function fold(value: string): string { return normalizeArabicComparison(clean(value)); }
function escape(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'); }
function trimSpan(value: string): string { return clean(value).replace(/[.!؟?،,;:]+$/gu, '').trim(); }
function enumValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/**
 * Whether `needle` appears in `haystack` as whole words (folded), allowing only a one-letter proclitic (و ف ب ل ك) or
 * the article before it. Pure string structure: no vocabulary.
 */
export function appearsIn(haystack: string, needle: string): boolean {
  const n = fold(needle);
  if (n.length === 0) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:[وفبلك]|ال|[وف]ال|[وف][بل])?${escape(n)}(?![\\p{L}\\p{N}_])`, 'u').test(fold(haystack));
}

function boundedKeys(keys: unknown): string[] | undefined {
  if (!Array.isArray(keys) || keys.length > MAX_UNDERSTANDING_KEYS) return undefined;
  if (keys.some((key) => typeof key !== 'string' || key.trim().length === 0 || [...key].length > MAX_UNDERSTANDING_KEY_LENGTH)) return undefined;
  return keys as string[];
}

function label(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const v = clean(value);
  if (v.length === 0) return null;
  return [...v].length > MAX_PERSON_LABEL_CHARS ? undefined : v;
}

/** The kept words: the span as said, one terminal full stop. */
function asSaid(span: string): string { return `${trimSpan(span).replace(/^انا(?=\s)/u, 'أنا')}.`; }

export interface SemanticContext {
  readonly message: string;
  readonly recentTurns: readonly UnderstandingRecentTurn[];
  readonly known: readonly UnderstandingKnownItem[];
  /** Live Memories for the duplicate screen. */
  readonly current: ReadonlyArray<Pick<MemoryRecord, 'type' | 'content'> & Partial<Pick<MemoryRecord, 'id' | 'subject'>>>;
  readonly now: Date;
}

type FactVerdictV3 = { readonly kept: VerifiedUnderstandingItemV3; readonly rank: number; readonly span: string } | { readonly rejected: UnderstandingRejectionV3 };

/** The names of the people this user's Memories (and this answer) already ground: a SELF span must not name them. */
function knownNames(context: SemanticContext, proposals: readonly UnderstandingFactProposalV3[]): string[] {
  const names = new Set<string>();
  for (const item of context.known) if (item.subject === 'OTHER' && item.personName) names.add(item.personName);
  for (const p of proposals) if (p?.owner === 'OTHER' && typeof p.personName === 'string' && p.personName.trim()) names.add(clean(p.personName));
  return [...names];
}

/** Verifies ONE v3 fact proposal. */
export function verifyFactV3(proposal: UnderstandingFactProposalV3, context: SemanticContext, names: readonly string[]): FactVerdictV3 {
  const p = proposal as Partial<Record<keyof UnderstandingFactProposalV3, unknown>>;
  const keys = boundedKeys(p.keys);
  const personName = label(p.personName);
  const personRelation = label(p.personRelation);
  if (typeof p.span !== 'string' || !enumValue(p.owner, UNDERSTANDING_OWNERS) || !enumValue(p.ownerBasis, UNDERSTANDING_OWNER_BASES) ||
      !(p.evidence === null || typeof p.evidence === 'string') || personName === undefined || personRelation === undefined ||
      !enumValue(p.polarity, UNDERSTANDING_POLARITIES) || !enumValue(p.modality, UNDERSTANDING_MODALITIES_V3) ||
      !enumValue(p.temporal, UNDERSTANDING_TEMPORALS) || !enumValue(p.type, UNDERSTANDING_FACT_TYPES) ||
      !(p.slot === null || enumValue(p.slot, UNDERSTANDING_SLOTS)) || !enumValue(p.importance, UNDERSTANDING_IMPORTANCES) ||
      !(p.days === null || (typeof p.days === 'number' && Number.isInteger(p.days))) || !keys) {
    return { rejected: 'MALFORMED' };
  }
  if (p.modality !== 'STATED') return { rejected: 'NOT_A_STATEMENT' };
  if (p.owner === 'UNCLEAR') return { rejected: 'UNCERTAIN_OWNER' };
  if (p.ownerBasis === 'INFERRED') return { rejected: 'OWNER_INFERRED' };

  // Grounding: verbatim, bounded, no secret.
  const message = clean(context.message);
  const span = trimSpan(p.span);
  if (span.split(' ').filter(Boolean).length < 2 || [...span].length > MAX_UNDERSTANDING_SPAN_CHARS) return { rejected: 'TOO_SHORT_OR_LONG' };
  if (!message.includes(span)) return { rejected: 'NOT_VERBATIM' };
  if (containsObviousSecret(span)) return { rejected: 'SENSITIVE_DATA' };

  // Ownership.
  if (p.owner === 'SELF') {
    if (personName !== null || personRelation !== null) return { rejected: 'OWNER_CONFLICT' };
    if (names.some((name) => appearsIn(span, name))) return { rejected: 'OWNER_CONFLICT' };
  } else {
    if (personName === null && personRelation === null) return { rejected: 'PERSON_NOT_GROUNDED' };
    const evidence = groundingText(p.ownerBasis, p.evidence as string | null, span, context);
    if (evidence === undefined) return { rejected: 'PERSON_NOT_GROUNDED' };
    if ((personName !== null && !appearsIn(evidence, personName)) || (personRelation !== null && !appearsIn(evidence, personRelation))) {
      return { rejected: 'PERSON_NOT_GROUNDED' };
    }
    // Someone else's fact is never slotted and never a temporary state (0173).
    if (p.temporal === 'TEMPORARY' || p.type === 'TEMPORARY_STATE' || p.slot !== null) return { rejected: 'TEMPORAL_MISMATCH' };
  }

  // Time structure.
  const temporary = p.temporal === 'TEMPORARY';
  if (temporary !== (p.type === 'TEMPORARY_STATE')) return { rejected: 'TEMPORAL_MISMATCH' };
  if (temporary !== (p.days !== null)) return { rejected: 'TEMPORAL_MISMATCH' };
  if (temporary && ((p.days as number) < 1 || (p.days as number) > 14)) return { rejected: 'TEMPORAL_MISMATCH' };

  const content = asSaid(span);
  return {
    span,
    rank: IMPORTANCE_RANK[p.importance],
    kept: {
      memoryId: randomUUID(),
      type: p.type,
      content,
      importance: MEMORY_IMPORTANCE[p.type],
      expiresAt: temporary ? new Date(context.now.getTime() + (p.days as number) * 86_400_000).toISOString() : null,
      slot: p.owner === 'SELF' && p.temporal !== 'PLANNED' && !temporary ? p.slot : null,
      temporal: p.temporal,
      subject: p.owner,
      personName: p.owner === 'OTHER' ? personName : null,
      personRelation: p.owner === 'OTHER' ? personRelation : null,
      terms: memoryIndexTerms(content, keys),
    },
  };
}

/** The text a person label must literally appear in, by the basis the model cited; undefined when it cites nothing valid. */
function groundingText(basis: string, evidence: string | null, span: string, context: SemanticContext): string | undefined {
  if (basis === 'IN_SPAN') return span;
  if (basis === 'IN_MESSAGE') return clean(context.message);
  // Only the USER's own recent words ground a person; QANDEEL's replies never do.
  if (basis === 'CONVERSATION') return context.recentTurns.filter((t) => t.role === 'USER').map((t) => t.content).join('\n') + '\n' + clean(context.message);
  if (basis === 'KNOWN_MEMORY') {
    const item = typeof evidence === 'string' ? context.known.find((k) => k.handle === evidence) : undefined;
    if (!item || item.subject === 'UNATTRIBUTED') return undefined;
    return [item.content, item.personName ?? '', item.personRelation ?? ''].join('\n');
  }
  return undefined;
}

export interface SemanticCaptureResult {
  readonly items: readonly VerifiedUnderstandingItemV3[];
  readonly restated: readonly string[];
  readonly reaffirmed: readonly string[];
  readonly ended: readonly string[];
  readonly forget: readonly string[];
  readonly corrections: readonly VerifiedUnderstandingCorrection[];
  readonly audit: ReadonlyArray<{ readonly part: 'fact' | 'context' | 'command'; readonly index: number; readonly verdict: string }>;
}

/** The whole v3 answer: commands first (they claim their Memories), then facts, then living state. */
export function verifySemanticCapture(output: PersonalUnderstandingCaptureOutputV3, context: SemanticContext): SemanticCaptureResult {
  const audit: Array<{ part: 'fact' | 'context' | 'command'; index: number; verdict: string }> = [];
  const byHandle = new Map(context.known.map((item) => [item.handle, item]));
  const claimed = new Set<string>();
  const message = clean(context.message);
  const facts = Array.isArray(output.facts) ? output.facts : [];
  const names = knownNames(context, facts);

  // Commands.
  const forget: string[] = [];
  const corrections: VerifiedUnderstandingCorrection[] = [];
  const correctionSpans: string[] = [];
  (Array.isArray(output.commands) ? output.commands : []).forEach((command, index) => {
    const c = command as Partial<Record<string, unknown>>;
    const item = typeof c.handle === 'string' && KNOWN_HANDLE.test(c.handle) ? byHandle.get(c.handle) : undefined;
    if (!enumValue(c.kind, UNDERSTANDING_COMMAND_KINDS) || typeof c.span !== 'string') { audit.push({ part: 'command', index, verdict: 'MALFORMED' }); return; }
    if (!item) { audit.push({ part: 'command', index, verdict: 'UNKNOWN_HANDLE' }); return; }
    if (claimed.has(item.memoryId)) { audit.push({ part: 'command', index, verdict: 'HANDLE_REUSED' }); return; }
    const request = trimSpan(c.span);
    if (request.length === 0 || !message.includes(request)) { audit.push({ part: 'command', index, verdict: 'NOT_VERBATIM' }); return; }
    if (c.kind === 'FORGET') {
      if (forget.length >= MAX_UNDERSTANDING_FORGETS) { audit.push({ part: 'command', index, verdict: 'OVER_BOUND' }); return; }
      claimed.add(item.memoryId); forget.push(item.memoryId); audit.push({ part: 'command', index, verdict: 'FORGET' });
      return;
    }
    if (corrections.length >= MAX_UNDERSTANDING_CORRECTIONS || item.subject === 'UNATTRIBUTED') { audit.push({ part: 'command', index, verdict: 'OVER_BOUND' }); return; }
    const replacement = c.replacement as UnderstandingFactProposalV3 | null;
    if (!replacement || typeof replacement !== 'object') { audit.push({ part: 'command', index, verdict: 'REPLACEMENT_REJECTED' }); return; }
    // The corrected fact keeps its owner: a correction never moves a fact between the user and someone else.
    const inherited: UnderstandingFactProposalV3 = item.subject === 'OTHER' && replacement.owner === 'OTHER' && replacement.personName == null && replacement.personRelation == null
      ? { ...replacement, personName: item.personName, personRelation: item.personRelation, ownerBasis: 'KNOWN_MEMORY', evidence: item.handle }
      : replacement;
    const verdict = verifyFactV3(inherited, context, item.subject === 'SELF' ? names : []);
    if ('rejected' in verdict || verdict.kept.subject !== item.subject || verdict.kept.type === 'TEMPORARY_STATE') {
      audit.push({ part: 'command', index, verdict: `REPLACEMENT_REJECTED:${'rejected' in verdict ? verdict.rejected : 'OWNER_OR_TYPE'}` });
      return;
    }
    if (normalizeMemoryContent(verdict.kept.content) === normalizeMemoryContent(item.content)) { audit.push({ part: 'command', index, verdict: 'NO_CHANGE' }); return; }
    claimed.add(item.memoryId);
    correctionSpans.push(verdict.span);
    corrections.push({ targetMemoryId: item.memoryId, memoryId: verdict.kept.memoryId, type: verdict.kept.type, content: verdict.kept.content,
      importance: verdict.kept.importance, slot: verdict.kept.slot, temporal: verdict.kept.temporal, terms: verdict.kept.terms });
    audit.push({ part: 'command', index, verdict: 'CORRECT' });
  });

  // Facts.
  const accepted: Array<{ kept: VerifiedUnderstandingItemV3; rank: number; span: string; index: number }> = [];
  const restated: string[] = [];
  const seen = new Set<string>();
  facts.forEach((fact, index) => {
    const verdict = verifyFactV3(fact, context, names);
    if ('rejected' in verdict) { audit.push({ part: 'fact', index, verdict: verdict.rejected }); return; }
    const key = normalizeMemoryContent(verdict.kept.content);
    if (seen.has(key) || correctionSpans.some((s) => normalizeMemoryContent(asSaid(s)) === key)) { audit.push({ part: 'fact', index, verdict: 'DUPLICATE' }); return; }
    if (screenMemoryCapture(verdict.kept, context.current) === 'EXACT_NORMALIZED_DUPLICATE') {
      const same = context.current.find((m) => typeof m.id === 'string' && m.subject === verdict.kept.subject &&
        screenMemoryCapture(verdict.kept, [m]) === 'EXACT_NORMALIZED_DUPLICATE');
      if (same?.id && !claimed.has(same.id) && !restated.includes(same.id)) restated.push(same.id);
      audit.push({ part: 'fact', index, verdict: 'DUPLICATE' });
      return;
    }
    seen.add(key);
    accepted.push({ ...verdict, index });
  });
  // Atomic facts win over a compound one that contains them.
  const atomic = accepted.filter((a) => {
    const compound = accepted.some((b) => b !== a && b.span.length < a.span.length && a.span.includes(b.span));
    if (compound) audit.push({ part: 'fact', index: a.index, verdict: 'OVERLAPPING' });
    return !compound;
  });
  // Importance decides what fits the declared bound (stable within a rank).
  const ordered = [...atomic].sort((x, y) => x.rank - y.rank || x.index - y.index);
  const items: VerifiedUnderstandingItemV3[] = [];
  for (const a of ordered) {
    if (items.length >= MAX_UNDERSTANDING_FACTS_V3) { audit.push({ part: 'fact', index: a.index, verdict: 'OVER_BOUND' }); continue; }
    items.push(a.kept);
    audit.push({ part: 'fact', index: a.index, verdict: 'KEPT' });
  }

  // Living state.
  const reaffirmed: string[] = [];
  const ended: string[] = [];
  const contextProposals = Array.isArray(output.context) ? output.context : [];
  const counts = new Map<string, number>();
  for (const c of contextProposals) { const h = (c as { handle?: unknown })?.handle; if (typeof h === 'string') counts.set(h, (counts.get(h) ?? 0) + 1); }
  contextProposals.forEach((proposal, index) => {
    const c = proposal as Partial<Record<string, unknown>>;
    const item = typeof c.handle === 'string' && KNOWN_HANDLE.test(c.handle) ? byHandle.get(c.handle) : undefined;
    if (!enumValue(c.status, UNDERSTANDING_CONTEXT_STATUSES_V3) || typeof c.span !== 'string') { audit.push({ part: 'context', index, verdict: 'MALFORMED' }); return; }
    if (!item) { audit.push({ part: 'context', index, verdict: 'UNKNOWN_HANDLE' }); return; }
    if (counts.get(c.handle as string) !== 1 || claimed.has(item.memoryId)) { audit.push({ part: 'context', index, verdict: 'HANDLE_REUSED' }); return; }
    const span = trimSpan(c.span);
    if (span.length === 0 || !message.includes(span)) { audit.push({ part: 'context', index, verdict: 'NOT_VERBATIM' }); return; }
    if (item.subject === 'UNATTRIBUTED') { audit.push({ part: 'context', index, verdict: 'UNCERTAIN_OWNER' }); return; }
    if (c.status === 'PAUSED' || c.status === 'ENDING_PLANNED') { audit.push({ part: 'context', index, verdict: `NO_CHANGE:${c.status}` }); return; }
    if (c.status === 'ENDED' && item.ended) { audit.push({ part: 'context', index, verdict: 'NO_CHANGE:ALREADY_ENDED' }); return; }
    if (reaffirmed.length + ended.length >= MAX_UNDERSTANDING_LIVING_UPDATES) { audit.push({ part: 'context', index, verdict: 'OVER_BOUND' }); return; }
    claimed.add(item.memoryId);
    (c.status === 'ENDED' ? ended : reaffirmed).push(item.memoryId);
    audit.push({ part: 'context', index, verdict: c.status as string });
  });

  // Stay inside the DB bound for living updates together with restatements.
  const room = MAX_UNDERSTANDING_LIVING_UPDATES - ended.length;
  const reaffirmedAll = [...new Set([...reaffirmed, ...restated.filter((id) => !claimed.has(id))])].slice(0, room);
  return { items, restated, reaffirmed: reaffirmedAll, ended, forget, corrections, audit };
}
