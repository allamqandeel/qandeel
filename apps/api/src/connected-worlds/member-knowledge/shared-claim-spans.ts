// S8A-04 CP3-D V2 — Trusted Claim Spans: the deterministic half of the reply's personal-knowledge path (Controlled Amendment
// R4, §11; the Product Owner's Final Implementation Contract of 2026-10-26). Pure: no provider, no database, no clock.
//
//   prepare   the request's claim table, from the items I-03E admitted and the Disclosure Authorization (DA). The table is
//             the only authority: a ref exists only for an item whose disclosure grant the DA lists for this exact operation
//             and audience, whose owner has a Name every member of this audience is shown, and that no other member of this
//             audience shares. The nonce keeps one request's refs from being valid in another; it authorizes nothing.
//   parse     the generator's text: every `⟦ref: predicate⟧` / `⟦ref@: predicate⟧` checked against that table — unknown,
//             foreign, duplicate, malformed or nested spans, a member's Name inside a span and any residue are refused
//   render    the owner's Name written by the server from the table, never by the model
//   view      what the checker sees: the spans under checker ids, the items, and no Name, ref or identity
//   decide    the checker's answer validated key by key, then mapped: it can only block; a failure withholds and cools nothing
//
// Nothing here decides meaning. Whether a predicate says only what its item says, and whether free text states an item about
// anyone, is the checker's question, and its silence is not proof (R4-4).

import { randomBytes } from 'node:crypto';
import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';

export interface SharedClaimItem {
  readonly ownerUserId: string;
  readonly memoryId: string;
  readonly contentDigest: string;
  readonly content: string;
}
/** One member of the request's exact audience and the Name every other member of it is shown (0178), or null. */
export interface SharedClaimAudienceMember { readonly userId: string; readonly name: string | null }
/** The operation the table belongs to. */
export interface SharedClaimBinding {
  readonly effectiveContextRef: string;
  readonly audienceSnapshotRef: string;
  readonly disclosureAuthorizationRef: string;
}

export interface SharedClaimEntry {
  readonly ref: string;
  readonly checkerId: string;
  readonly ownerUserId: string;
  readonly ownerName: string;
  readonly memoryId: string;
  readonly contentDigest: string;
}

export interface SharedClaimTable {
  readonly binding: SharedClaimBinding;
  readonly nonce: string;
  /** Claimable items, by their request ref. */
  readonly claims: ReadonlyMap<string, SharedClaimEntry>;
  /** Every item sent to the generator, by checker id (claimable and influence-only). */
  readonly checked: ReadonlyMap<string, { readonly memoryId: string; readonly ownerUserId: string; readonly content: string }>;
  /** What the generator receives: the item, its owner's label, and a ref only when it may be stated. */
  readonly generatorItems: ReadonlyArray<{ readonly ref: string | null; readonly member: string; readonly item: string }>;
  /** Admitted items NOT sent at all: not in the DA, or no label (the 0176 pair invariant says neither happens). */
  readonly excluded: ReadonlyArray<string>;
  /** Every Name of this request's people, as tokens, for the in-span structural rule. */
  readonly names: ReadonlyArray<ReadonlyArray<string>>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Names: normalized for two STRUCTURAL rules only — an owner whose Name another member shares cannot be stated, and no
// person's Name may appear inside a span. Never evidence of who a sentence is about; never a rule outside the spans.
// ---------------------------------------------------------------------------------------------------------------------

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
export function normalizeClaimText(value: string): string {
  return value.normalize('NFKC').replace(DIACRITICS, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه')
    .replace(/[’']s\b/gu, '').toLowerCase();
}
const tokens = (value: string): string[] => normalizeClaimText(value).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
const PROCLITICS = ['و', 'ف', 'ب', 'ل', 'ك', 'وب', 'ول', 'فب', 'فل', 'وك', 'فك'];
const variants = (token: string): string[] => [token, ...PROCLITICS.filter((p) => token.startsWith(p) && token.length - p.length >= 2).map((p) => token.slice(p.length))];

/** True when the Name's tokens occur consecutively in the text (the first one may carry an Arabic proclitic). */
export function containsClaimName(text: string, nameTokens: ReadonlyArray<string>): boolean {
  if (nameTokens.length === 0) return false;
  const words = tokens(text);
  for (let i = 0; i + nameTokens.length <= words.length; i += 1) {
    if (!variants(words[i]).includes(nameTokens[0])) continue;
    if (nameTokens.slice(1).every((token, k) => words[i + 1 + k] === token)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// prepare
// ---------------------------------------------------------------------------------------------------------------------

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** Six base32 characters from the CSPRNG (256 = 8 × 32, so every character is uniform). Hygiene, not security. */
export const newClaimNonce = (): string => [...randomBytes(6)].map((byte) => BASE32[byte % 32]).join('');

export function prepareSharedClaimTable(input: {
  readonly admitted: ReadonlyArray<SharedClaimItem>;
  /** The memory ids whose disclosure grant the DA lists for this exact operation and audience. */
  readonly authorized: ReadonlySet<string>;
  /** The request's exact audience with its Names (0178), or null when that read failed or is not this audience. */
  readonly audience: ReadonlyArray<SharedClaimAudienceMember> | null;
  /** The request's label for each owner (what the generator already sees). */
  readonly labelOf: ReadonlyMap<string, string>;
  /** Further Names of this request's people (its labels), for the in-span rule only. */
  readonly otherNames?: ReadonlyArray<string>;
  readonly binding: SharedClaimBinding;
  readonly nonce?: string;
}): SharedClaimTable {
  const nonce = input.nonce ?? newClaimNonce();
  if (!/^[a-z2-7]{6}$/u.test(nonce)) throw new Error('SHARED_CLAIM_NONCE');
  const audience = input.audience ?? [];
  const normalized = audience.map((member) => (member.name === null ? null : tokens(member.name).join(' ')));
  const claims = new Map<string, SharedClaimEntry>();
  const checked = new Map<string, { memoryId: string; ownerUserId: string; content: string }>();
  const generatorItems: Array<{ ref: string | null; member: string; item: string }> = [];
  const excluded: string[] = [];
  for (const item of input.admitted) {
    // Use that consent does not cover for this audience never reaches the model at all (R4-1).
    if (!input.authorized.has(item.memoryId)) { excluded.push(item.memoryId); continue; }
    const label = input.labelOf.get(item.ownerUserId);
    if (label === undefined) { excluded.push(item.memoryId); continue; }
    const checkerId = `K${checked.size + 1}`;
    checked.set(checkerId, { memoryId: item.memoryId, ownerUserId: item.ownerUserId, content: item.content });
    const ownerIndex = audience.findIndex((member) => member.userId === item.ownerUserId);
    const ownerName = ownerIndex < 0 ? null : audience[ownerIndex].name;
    const own = ownerIndex < 0 ? null : normalized[ownerIndex];
    // A Name missing, or shared with another member, cannot be stated unambiguously: the item still informs the reply,
    // never as a claim. A restriction inside the existing consent; no new scope.
    const unique = own !== null && own.length > 0 && normalized.filter((name) => name === own).length === 1;
    if (ownerName === null || !unique) { generatorItems.push({ ref: null, member: label, item: item.content }); continue; }
    const ref = `F${claims.size + 1}·${nonce}`;
    claims.set(ref, { ref, checkerId, ownerUserId: item.ownerUserId, ownerName: ownerName.trim(), memoryId: item.memoryId, contentDigest: item.contentDigest });
    generatorItems.push({ ref, member: label, item: item.content });
  }
  const names = [...audience.flatMap((member) => (member.name === null ? [] : [member.name])), ...(input.otherNames ?? [])]
    .map(tokens).filter((name) => name.length > 0);
  return Object.freeze({
    binding: Object.freeze({ ...input.binding }), nonce, claims, checked, generatorItems: Object.freeze(generatorItems), excluded: Object.freeze(excluded),
    names: Object.freeze(names),
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// parse + render
// ---------------------------------------------------------------------------------------------------------------------

export type SharedClaimRejection = 'MALFORMED' | 'UNKNOWN_REF' | 'DUPLICATE_REF' | 'NAME_IN_SPAN' | 'RESIDUAL_MARKER';
export interface SharedClaimSpan { readonly entry: SharedClaimEntry; readonly address: boolean; readonly predicate: string; readonly start: number; readonly end: number }
export type SharedClaimParse =
  | { readonly ok: true; readonly spans: ReadonlyArray<SharedClaimSpan> }
  | { readonly ok: false; readonly reason: SharedClaimRejection };

const SPAN = /⟦(F[1-9][0-9]{0,2}·[a-z2-7]{6})(@?):([^⟦⟧]*)⟧/uy;
/** Anything that looks like a request ref or a span bracket, in any text that is about to leave the server. */
const RESIDUE = /[⟦⟧]|F[1-9][0-9]{0,2}·[a-z2-7]{6}/u;
export const SHARED_CLAIM_MAX_PREDICATE = 240;

export function parseSharedClaimSpans(text: string, table: SharedClaimTable): SharedClaimParse {
  const spans: SharedClaimSpan[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '⟧') return { ok: false, reason: 'MALFORMED' };
    if (ch !== '⟦') { i += 1; continue; }
    SPAN.lastIndex = i;
    const match = SPAN.exec(text);
    if (match === null) return { ok: false, reason: 'MALFORMED' };
    const [whole, ref, at, rawPredicate] = match;
    const entry = table.claims.get(ref);
    if (entry === undefined) return { ok: false, reason: 'UNKNOWN_REF' };
    if (seen.has(ref)) return { ok: false, reason: 'DUPLICATE_REF' };
    seen.add(ref);
    const predicate = rawPredicate.trim();
    if (predicate.length === 0 || predicate.length > SHARED_CLAIM_MAX_PREDICATE || RESIDUE.test(predicate)) return { ok: false, reason: 'MALFORMED' };
    // One subject per span, written by the server: no person's Name (the owner's included) inside it.
    if (table.names.some((name) => containsClaimName(predicate, name))) return { ok: false, reason: 'NAME_IN_SPAN' };
    spans.push({ entry, address: at === '@', predicate, start: i, end: i + whole.length });
    i += whole.length;
  }
  // A ref outside a span (copied bare from a message, or in look-alike brackets) is residue, not a claim.
  const outside = spans.reduceRight((rest, span) => rest.slice(0, span.start) + rest.slice(span.end), text);
  if (RESIDUE.test(outside)) return { ok: false, reason: 'RESIDUAL_MARKER' };
  return { ok: true, spans: Object.freeze(spans) };
}

const isArabic = (value: string): boolean => /^[^\p{L}]*[؀-ۿ]/u.test(value);

export type SharedClaimRender =
  | { readonly ok: true; readonly text: string; readonly outputDigest: string }
  | { readonly ok: false; readonly reason: SharedClaimRejection };

/** The delivered text: each span becomes "<owner's Name> <predicate>" (or "<Name>، <predicate>" when addressed). */
export function renderSharedClaims(text: string, parsed: Extract<SharedClaimParse, { ok: true }>): SharedClaimRender {
  let out = '';
  let cursor = 0;
  for (const span of parsed.spans) {
    const separator = span.address ? (isArabic(span.predicate) ? '، ' : ', ') : ' ';
    out += text.slice(cursor, span.start) + span.entry.ownerName + separator + span.predicate;
    cursor = span.end;
  }
  out += text.slice(cursor);
  if (RESIDUE.test(out) || out.trim().length === 0) return { ok: false, reason: 'RESIDUAL_MARKER' };
  return { ok: true, text: out, outputDigest: digestProviderOutput(out) };
}

// ---------------------------------------------------------------------------------------------------------------------
// the checker's view, and the decision
// ---------------------------------------------------------------------------------------------------------------------

export interface SharedClaimCheckerView {
  /** The text with each span's ref replaced by its checker id; no Name is added anywhere. */
  readonly text: string;
  readonly spanIds: ReadonlyArray<string>;
  /** [start, end) of each span in `text`. */
  readonly spanRanges: ReadonlyArray<readonly [number, number]>;
  readonly items: ReadonlyArray<{ readonly id: string; readonly item: string }>;
}

export function sharedClaimCheckerView(text: string, parsed: Extract<SharedClaimParse, { ok: true }>, table: SharedClaimTable): SharedClaimCheckerView {
  let out = '';
  let cursor = 0;
  const spanRanges: Array<readonly [number, number]> = [];
  for (const span of parsed.spans) {
    out += text.slice(cursor, span.start);
    const start = out.length;
    out += `⟦${span.entry.checkerId}${span.address ? '@' : ''}: ${span.predicate}⟧`;
    spanRanges.push([start, out.length]);
    cursor = span.end;
  }
  out += text.slice(cursor);
  return Object.freeze({
    text: out,
    spanIds: Object.freeze(parsed.spans.map((span) => span.entry.checkerId)),
    spanRanges: Object.freeze(spanRanges),
    items: Object.freeze([...table.checked].map(([id, value]) => Object.freeze({ id, item: value.content }))),
  });
}

export const SHARED_CLAIM_SPAN_VERDICTS = ['ENTAILED', 'ADDS', 'OTHER_ITEM', 'OTHER_PERSON', 'UNCLEAR'] as const;
export type SharedClaimSpanVerdict = (typeof SHARED_CLAIM_SPAN_VERDICTS)[number];
/** The checker's answer (CG-6b′). */
export interface SharedClaimCheckerAnswer {
  /** One per span: is the predicate only what its own item says, about its subject alone? */
  readonly spans: ReadonlyArray<{ readonly id: string; readonly verdict: SharedClaimSpanVerdict }>;
  /** Passages OUTSIDE every span that state or clearly imply an item as true of any person, the addressee or "someone". */
  readonly outside: ReadonlyArray<{ readonly id: string; readonly passage: string }>;
  /** A quote, or sealed provenance, anywhere. */
  readonly sealed: ReadonlyArray<{ readonly id: string; readonly passage: string }>;
}

export type SharedClaimDecision =
  | { readonly state: 'READY'; readonly disclosed: ReadonlyArray<string>; readonly influenced: ReadonlyArray<string> }
  | { readonly state: 'BLOCKED'; readonly coolDown: ReadonlyArray<string>; readonly sealed: boolean }
  | { readonly state: 'STALE' }
  | { readonly state: 'UNRESOLVED' };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: ReadonlyArray<string>) => Object.keys(value).length === keys.length && keys.every((key) => key in value);

function occursOutsideSpans(view: SharedClaimCheckerView, passage: string): boolean {
  for (let at = view.text.indexOf(passage); at >= 0; at = view.text.indexOf(passage, at + 1)) {
    const end = at + passage.length;
    if (!view.spanRanges.some(([s, e]) => at < e && end > s)) return true;
  }
  return false;
}

/**
 * The server's decision from the checker's answer. The answer is validated key by key against the view; anything else is
 * UNRESOLVED (withheld, nothing cooled). The checker can only add reasons to block: its silence lets a reply through, and
 * that is exactly the residual risk (R4-4).
 */
export function decideSharedClaims(raw: unknown, view: SharedClaimCheckerView, parsed: Extract<SharedClaimParse, { ok: true }>, table: SharedClaimTable,
  current: { readonly binding: SharedClaimBinding; readonly authorized: ReadonlySet<string> }): SharedClaimDecision {
  const unresolved: SharedClaimDecision = { state: 'UNRESOLVED' };
  if (current.binding.effectiveContextRef !== table.binding.effectiveContextRef || current.binding.audienceSnapshotRef !== table.binding.audienceSnapshotRef
    || current.binding.disclosureAuthorizationRef !== table.binding.disclosureAuthorizationRef) return unresolved;
  if (!isRecord(raw) || !exactKeys(raw, ['spans', 'outside', 'sealed'])) return unresolved;
  const { spans, outside, sealed } = raw;
  if (!Array.isArray(spans) || !Array.isArray(outside) || !Array.isArray(sealed)) return unresolved;
  if (spans.length !== view.spanIds.length) return unresolved;
  const verdicts = new Map<string, string>();
  for (const entry of spans as ReadonlyArray<unknown>) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'verdict']) || typeof entry.id !== 'string' || !view.spanIds.includes(entry.id) || verdicts.has(entry.id)) return unresolved;
    if (!(SHARED_CLAIM_SPAN_VERDICTS as ReadonlyArray<unknown>).includes(entry.verdict)) return unresolved;
    verdicts.set(entry.id, entry.verdict as string);
  }
  const unsafe = new Set<string>();
  for (const entry of outside as ReadonlyArray<unknown>) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'passage']) || typeof entry.id !== 'string' || typeof entry.passage !== 'string') return unresolved;
    const item = table.checked.get(entry.id);
    if (item === undefined || entry.passage.trim().length === 0 || !occursOutsideSpans(view, entry.passage)) return unresolved;
    unsafe.add(item.memoryId); // whoever it is said of: no attribution decision is made here
  }
  let sealedFound = false;
  for (const entry of sealed as ReadonlyArray<unknown>) {
    if (!isRecord(entry) || !exactKeys(entry, ['id', 'passage']) || typeof entry.id !== 'string' || typeof entry.passage !== 'string') return unresolved;
    const item = table.checked.get(entry.id);
    if (item === undefined || entry.passage.trim().length === 0 || !view.text.includes(entry.passage)) return unresolved;
    unsafe.add(item.memoryId);
    sealedFound = true;
  }
  for (const span of parsed.spans) if (verdicts.get(span.entry.checkerId) !== 'ENTAILED') unsafe.add(span.entry.memoryId);
  if (unsafe.size > 0) {
    const order = [...table.checked.values()].map((item) => item.memoryId);
    return { state: 'BLOCKED', coolDown: Object.freeze(order.filter((memoryId) => unsafe.has(memoryId))), sealed: sealedFound };
  }
  const disclosed = parsed.spans.map((span) => span.entry.memoryId);
  // A claim needs its disclosure grant for this operation: anything else is stale, and nothing is cooled.
  if (disclosed.some((memoryId) => !current.authorized.has(memoryId))) return { state: 'STALE' };
  const influenced = [...table.checked.values()].map((item) => item.memoryId).filter((memoryId) => !disclosed.includes(memoryId));
  return { state: 'READY', disclosed: Object.freeze(disclosed), influenced: Object.freeze(influenced) };
}
