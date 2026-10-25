// SHARED-VIS-01 — the provider-neutral Shared Semantic Interpreter: QANDEEL's structured reading of what the humans of ONE
// exact Shared World said, as the meaningful units («places») of that World's Living Analysis geography.
//
// It is the Shared counterpart of the S5-03A Public interpreter and is shaped like it — a port, a deterministic test
// implementation and a decoder — with the SAME shape rules (`../public-world/public-semantic-interpreter`: one trimmed line,
// bounded themes, a lens key, no identifier). What differs is only what the Shared World is: there is no publisher who
// closed a package, so QANDEEL also says WHICH of the given contributions each meaning is read from. That provenance is
// exact — a subset of the contributions it was given — and becomes the place's MATERIAL_DEPENDENCY sources.
//
// It is NOT the conversational Model Router: a reading is not a turn and carries no reply text. The port names no
// provider. Stage 8A binds one: S8A-04 CP1 composes DeepSeek Flash in `shared-semantic-interpreter-provider.ts`.
//
// The port receives only `SharedSemanticInput`: the human contributions every current member may see, each addressed by an
// opaque ordinal, and the meanings the World already holds with the ordinals they were read from. SHARED-VIS-01 gave it the
// words only. The S8A-04 CP1 Shared Social Understanding Controlled Amendment (Product Owner D1, 2026-10-24) adds WHO wrote
// each contribution, the way the S8A-02 reply already tells the model: a speaker token (`S1`, `S2`, …) that the server
// derives from the author identity the frozen 0089 resolver holds for that exact material, and the visible Name shown for
// each token. Never an account, material or World identity, and never derived from a Name or the words. A token lives for
// ONE reading and is never a durable identity: the stable identity stays with the server, reachable through each place's
// MATERIAL_DEPENDENCY sources. The answer is unchanged: it returns `unknown`, decoded strictly HERE, so no adapter can
// widen the shape, invent a source, smuggle a coordinate in or carry a speaker token out.
//
// S8A-04 CP2 (Shared Social Memory Controlled Amendment §2, M1; contract SHARED_SEMANTIC_INTERPRETATION_V2): each place also
// says WHOSE it is — a view or a claim, its holders (speaker tokens) or an absent holder's label, who relayed it, whom it is
// about, whether it was left uncertain — and which existing meaning (E1, E2, …) it revises. The decoder refuses the WHOLE
// reading when any attribution rule is broken: it never repairs, drops or substitutes an attribution. The place pass maps
// tokens to the server's identities, and the 0175 write re-checks every rule. Nothing here logs anything.

import { createHash } from 'node:crypto';
import { normalizeArabicComparison } from '../memory/arabic-text';
import {
  SEMANTIC_MEANING_MAX, SEMANTIC_PRIMARY_THEMES, SEMANTIC_SECONDARY_THEMES, areDisjointThemes, isSemanticText, isSemanticThemeSet,
} from '../public-world/public-semantic-interpreter';

export const SHARED_SEMANTIC_INTERPRETATION_CONTRACT = 'SHARED_SEMANTIC_INTERPRETATION_V2' as const;

/** At most this many places from one reading, and this many contributions per place (the database's own bounds). */
export const SHARED_SEMANTIC_PLACES_PER_READING = 3;
export const SHARED_SEMANTIC_SOURCES_PER_PLACE = 24;
/** The newest contributions one reading is given, and the World's existing meanings shown with them. */
export const SHARED_SEMANTIC_CONTRIBUTIONS_MAX = 40;
/** S8A-04 CP2: at most this many existing meanings, and this many UTF-8 bytes of them, are shown to one reading (§3.2.6). */
export const SHARED_SEMANTIC_EXISTING_MAX = 200;
export const SHARED_SEMANTIC_EXISTING_BYTES = 24 * 1024;
/** S8A-04 CP2: the attribution bounds (0175). */
export const SHARED_SEMANTIC_HOLDERS_MAX = 4;
export const SHARED_SEMANTIC_RELAYERS_MAX = 3;
export const SHARED_SEMANTIC_ABOUT_MAX = 3;
export const SHARED_SEMANTIC_ABSENT_HOLDER_MAX = 60;

export interface SharedSemanticContribution {
  /** An opaque ordinal, 1-based, in canonical order (oldest first). Never an identity. */
  readonly ref: number;
  /** S8A-04 CP1: the speaker token of its trusted author in this reading (`S1`, `S2`, … by first appearance). */
  readonly from: string;
  readonly text: string;
}

/** S8A-04 CP1: one writer of this reading — their token, and the visible Name shown for them (numbered when Names collide). */
export interface SharedSemanticWriter {
  readonly speaker: string;
  readonly name: string;
}

export type SharedSemanticNature = 'VIEW' | 'CLAIM';

/** S8A-04 CP2: whose a meaning is, in this reading's speaker tokens. */
export interface SharedSemanticAttribution {
  readonly nature: SharedSemanticNature;
  /** The writers whose view or claim it is; empty exactly when `absentHolder` is given. */
  readonly holders: ReadonlyArray<string>;
  /** How someone outside the World is referred to (1–60 characters): text only, never an identity. */
  readonly absentHolder: string | null;
  readonly relayedBy: ReadonlyArray<string>;
  readonly about: ReadonlyArray<string>;
  readonly hedged: boolean;
}

export interface SharedSemanticExistingMeaning extends SharedSemanticAttribution {
  /** S8A-04 CP2: `E1`, `E2`, … in order. */
  readonly ref: string;
  readonly meaning: string;
  /** The ordinals, among this reading's contributions, it rests on (those still given); may be empty. */
  readonly sourceRefs: ReadonlyArray<number>;
}

/** The interpreter's ENTIRE input. */
export interface SharedSemanticInput {
  readonly contract: typeof SHARED_SEMANTIC_INTERPRETATION_CONTRACT;
  /**
   * Every speaker token this reading uses, once each: the contributions' writers in order of first appearance, then the
   * members the existing meanings name (S8A-04 CP2).
   */
  readonly writers: ReadonlyArray<SharedSemanticWriter>;
  readonly contributions: ReadonlyArray<SharedSemanticContribution>;
  readonly existing: ReadonlyArray<SharedSemanticExistingMeaning>;
}

export interface SharedSemanticPlaceProposal {
  /** The meaning, in one short line (≤ 120). */
  readonly meaning: string;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
  /** The exact contributions it is read from: a non-empty subset of the given ordinals. */
  readonly sourceRefs: ReadonlyArray<number>;
  /** The semantic region the meaning is read under — never a coordinate. */
  readonly lensKey: string;
  /** S8A-04 CP2: whose it is (speaker tokens), and the existing ref it revises, if any. */
  readonly attribution: SharedSemanticAttribution;
  readonly revises: string | null;
}

/** A reading: zero to three NEW places. Zero is an honest answer: nothing new has formed. */
export interface SharedSemanticReading {
  readonly places: ReadonlyArray<SharedSemanticPlaceProposal>;
}

export interface SharedSemanticInterpreter {
  read(input: SharedSemanticInput, signal: AbortSignal): Promise<unknown>;
}

export const SHARED_SEMANTIC_INTERPRETER = Symbol('SHARED_SEMANTIC_INTERPRETER');

export class SharedSemanticInterpreterUnavailableError extends Error {
  constructor() {
    super('Shared semantic interpretation is unavailable.');
    this.name = 'SharedSemanticInterpreterUnavailableError';
  }
}

const LENS_KEY = /^[a-z0-9][a-z0-9_.-]{0,63}$/u;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

/** S8A-04 CP1: a speaker token, as the server writes it. */
export const SHARED_SPEAKER_TOKEN = /^S[1-9][0-9]*$/u;
const TOKEN_WORD = /(?<![\p{L}\p{N}])S[1-9][0-9]*(?![\p{L}\p{N}])/gu;

/**
 * S8A-04 CP1: does `text` carry one of this reading's speaker tokens as a word of its own? A token means nothing outside
 * its reading, so a meaning or a theme written with one would turn a request-local label into durable text.
 */
function carriesSpeakerToken(text: string, tokens: ReadonlySet<string>): boolean {
  return (text.match(TOKEN_WORD) ?? []).some((token) => tokens.has(token));
}

const PLACE_KEYS = ['meaning', 'primaryThemes', 'secondaryThemes', 'sourceRefs', 'lensKey', 'nature', 'holders', 'relayedBy', 'about', 'hedged'] as const;
const NUMBERED_LABEL = / \([1-9][0-9]*\)$/u;

/** A distinct list of this reading's speaker tokens, within `max`. */
const tokenList = (value: unknown, tokens: ReadonlySet<string>, max: number): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every((token) => typeof token === 'string' && tokens.has(token)) && new Set(value).size === value.length;

/**
 * S8A-04 CP2: the labels this reading sent that were numbered to tell people apart (`محمد (2)`). A meaning or an absent
 * holder that carries one would turn a request-local label into durable text.
 */
export function sharedSemanticReadingLabels(input: SharedSemanticInput): string[] {
  return input.writers.map((writer) => writer.name).filter((name) => NUMBERED_LABEL.test(name));
}

/** The words of a Name or an absent holder, for comparison only (MEM-AR-01A's normalizer; a reading's numbering removed). */
function nameWords(name: string): string[] {
  return normalizeArabicComparison(name.replace(NUMBERED_LABEL, '')).split(' ').filter((word) => word.length > 0);
}

interface ReadingRules {
  readonly refs: ReadonlySet<number>;
  readonly tokens: ReadonlySet<string>;
  readonly writerOf: ReadonlyMap<number, string>;
  readonly existing: ReadonlySet<string>;
  readonly labels: ReadonlyArray<string>;
}

function placeOf(value: unknown, rules: ReadingRules): SharedSemanticPlaceProposal | null {
  const { refs, tokens } = rules;
  if (!isRecord(value)) return null;
  const optional = ['absentHolder', 'revises'].filter((key) => Object.prototype.hasOwnProperty.call(value, key));
  if (!exactKeys(value, [...PLACE_KEYS, ...optional])) return null;
  const { meaning, primaryThemes, secondaryThemes, sourceRefs, lensKey } = value;
  if (!isSemanticText(meaning, SEMANTIC_MEANING_MAX) || !isSemanticThemeSet(primaryThemes, SEMANTIC_PRIMARY_THEMES)
    || !isSemanticThemeSet(secondaryThemes, SEMANTIC_SECONDARY_THEMES) || !areDisjointThemes(primaryThemes, secondaryThemes)
    || typeof lensKey !== 'string' || !LENS_KEY.test(lensKey)) return null;
  if ([meaning, ...primaryThemes, ...secondaryThemes].some((text) => carriesSpeakerToken(text, tokens))) return null;
  if (!Array.isArray(sourceRefs) || sourceRefs.length < 1 || sourceRefs.length > SHARED_SEMANTIC_SOURCES_PER_PLACE
    || !sourceRefs.every((ref) => Number.isInteger(ref) && refs.has(ref as number)) || new Set(sourceRefs).size !== sourceRefs.length) return null;
  // S8A-04 CP2 — the attribution (M1 decoder rules). Anything broken refuses the whole reading.
  const { nature, holders, relayedBy, about, hedged } = value;
  const absentHolder = value.absentHolder === undefined ? null : value.absentHolder;
  const revises = value.revises === undefined ? null : value.revises;
  if ((nature !== 'VIEW' && nature !== 'CLAIM') || typeof hedged !== 'boolean' || !tokenList(holders, tokens, SHARED_SEMANTIC_HOLDERS_MAX)
    || !tokenList(relayedBy, tokens, SHARED_SEMANTIC_RELAYERS_MAX) || !tokenList(about, tokens, SHARED_SEMANTIC_ABOUT_MAX)) return null;
  if (absentHolder !== null && (!isSemanticText(absentHolder, SHARED_SEMANTIC_ABSENT_HOLDER_MAX) || carriesSpeakerToken(absentHolder, tokens))) return null;
  // Holders XOR an absent holder; an absent holder always has its relayer; no one both holds and relays.
  if ((holders.length > 0) === (absentHolder !== null)) return null;
  if (absentHolder !== null && relayedBy.length === 0) return null;
  if (holders.some((token) => relayedBy.includes(token))) return null;
  // No label this reading numbered may become durable text.
  if (rules.labels.some((label) => meaning.includes(label) || (absentHolder !== null && absentHolder.includes(label)))) return null;
  // Holders are writers of a cited contribution unless it was relayed; relayers always are.
  const citedWriters = new Set((sourceRefs as number[]).map((ref) => rules.writerOf.get(ref)));
  if ((relayedBy.length === 0 && !holders.every((token) => citedWriters.has(token))) || !relayedBy.every((token) => citedWriters.has(token))) return null;
  if (revises !== null && (typeof revises !== 'string' || !rules.existing.has(revises))) return null;
  return Object.freeze({
    meaning, primaryThemes: Object.freeze([...primaryThemes]), secondaryThemes: Object.freeze([...secondaryThemes]),
    sourceRefs: Object.freeze([...(sourceRefs as number[])].sort((a, b) => a - b)), lensKey,
    attribution: Object.freeze({
      nature, holders: Object.freeze([...holders]), absentHolder: absentHolder as string | null, relayedBy: Object.freeze([...relayedBy]),
      about: Object.freeze([...about]), hedged,
    }),
    revises: revises as string | null,
  });
}

/**
 * An interpreter's reading of exactly `input`, or null. Exactly `{ places }`, each place exactly its fields (S8A-04 CP2:
 * the five of SHARED-VIS-01, the attribution, and optionally `absentHolder` and `revises`), every source one of the given
 * ordinals and every token one of the given writers; anything more — a coordinate, a score, an identity — or anything
 * invented is malformed. A meaning may name a person (Product Owner D2, S8A-04 CP1); it never carries one of this
 * reading's speaker tokens or numbered labels. Each existing ref is revised at most once in the reading.
 *
 * Some well-formed places are not kept, because the server cannot prove their attribution; not saving one is better than
 * saving a wrong one (the Product Owner's corrections, 2026-10-25). The reading's other places stay.
 *   - F1: a place held by MORE THAN ONE member. Readings folded one person's view into another's that way.
 *   - S4: a member who holds more than one place in the reading (a joint one included) keeps only the one read from the
 *     latest contribution, and none when that one is joint or two are equally late. A withdrawn position and the one that
 *     replaced it are never both saved as current.
 *   - V2: an absent holder whose every word is in the Name of one of this reading's writers. A member is never turned into
 *     someone absent by a Name; the Name never decides who it is, so the place is not saved at all.
 */
export function decodeSharedSemanticReading(value: unknown, input: SharedSemanticInput): SharedSemanticReading | null {
  if (!isRecord(value) || !exactKeys(value, ['places']) || !Array.isArray(value.places) || value.places.length > SHARED_SEMANTIC_PLACES_PER_READING) return null;
  const rules: ReadingRules = {
    refs: new Set(input.contributions.map((contribution) => contribution.ref)),
    tokens: new Set(input.writers.map((writer) => writer.speaker)),
    writerOf: new Map(input.contributions.map((contribution) => [contribution.ref, contribution.from])),
    existing: new Set(input.existing.map((meaning) => meaning.ref)),
    labels: sharedSemanticReadingLabels(input),
  };
  const read: SharedSemanticPlaceProposal[] = [];
  for (const entry of value.places) {
    const place = placeOf(entry, rules);
    if (place === null) return null;
    read.push(place);
  }
  const unproven = new Set<SharedSemanticPlaceProposal>(read.filter((place) => place.attribution.holders.length > 1));
  const latest = (place: SharedSemanticPlaceProposal) => place.sourceRefs[place.sourceRefs.length - 1];
  for (const token of rules.tokens) {
    const held = read.filter((place) => place.attribution.holders.includes(token));
    if (held.length < 2) continue;
    const newest = Math.max(...held.map(latest));
    const kept = held.filter((place) => latest(place) === newest);
    for (const place of held) if (kept.length !== 1 || place !== kept[0]) unproven.add(place);
  }
  const writerNames = input.writers.map((writer) => new Set(nameWords(writer.name)));
  for (const place of read) {
    const absent = place.attribution.absentHolder;
    if (absent === null) continue;
    const words = nameWords(absent);
    if (words.length > 0 && writerNames.some((name) => words.every((word) => name.has(word)))) unproven.add(place);
  }
  const places = read.filter((place) => !unproven.has(place));
  const revised = places.flatMap((place) => (place.revises === null ? [] : [place.revises]));
  if (new Set(revised).size !== revised.length) return null;
  return Object.freeze({ places: Object.freeze(places) });
}

/**
 * The deterministic test interpreter (NODE_ENV=test only). It reads nothing but its input, answers the same input with the
 * same output and copies no contribution text. Once at least two contributions are read by no existing meaning, it reads
 * them as ONE place; otherwise nothing new has formed. It is not a model and never ships a reading to a real person.
 */
export class FakeSharedSemanticInterpreter implements SharedSemanticInterpreter {
  private static readonly THEMES = ['family', 'work', 'plans', 'trust', 'decisions', 'memories', 'care', 'home'] as const;

  async read(input: SharedSemanticInput): Promise<unknown> {
    const read = new Set(input.existing.flatMap((meaning) => meaning.sourceRefs));
    const unread = input.contributions.filter((contribution) => !read.has(contribution.ref)).slice(-SHARED_SEMANTIC_SOURCES_PER_PLACE);
    if (unread.length < 2) return { places: [] };
    const seed = createHash('sha256').update(unread.map((contribution) => contribution.text).join('\n'), 'utf8').digest();
    const themes = FakeSharedSemanticInterpreter.THEMES;
    const primary = themes[seed[0] % themes.length];
    const secondary = themes[(seed[0] + 1) % themes.length];
    return {
      places: [{
        meaning: `A test reading of ${unread.length} shared contributions`,
        primaryThemes: [primary],
        secondaryThemes: [secondary],
        sourceRefs: unread.map((contribution) => contribution.ref),
        lensKey: primary,
        // S8A-04 CP2: a view held by the writer of the newest contribution it was read from (one holder: F1).
        nature: 'VIEW',
        holders: [unread[unread.length - 1].from],
        relayedBy: [],
        about: [],
        hedged: false,
      }],
    };
  }
}

/**
 * Refuses: never a fallback, never a canned answer. The interpreter for a reading that has no provider. S8A-04 CP1 moved
 * the factory to `shared-semantic-interpreter-provider.ts`, so this port still reaches no provider.
 */
export class UnconfiguredSharedSemanticInterpreter implements SharedSemanticInterpreter {
  async read(): Promise<unknown> {
    throw new SharedSemanticInterpreterUnavailableError();
  }
}
