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
// widen the shape, invent a source, smuggle a coordinate in or carry a speaker token out. Nothing here logs anything.

import { createHash } from 'node:crypto';
import {
  SEMANTIC_MEANING_MAX, SEMANTIC_PRIMARY_THEMES, SEMANTIC_SECONDARY_THEMES, areDisjointThemes, isSemanticText, isSemanticThemeSet,
} from '../public-world/public-semantic-interpreter';

export const SHARED_SEMANTIC_INTERPRETATION_CONTRACT = 'SHARED_SEMANTIC_INTERPRETATION_V1' as const;

/** At most this many places from one reading, and this many contributions per place (the database's own bounds). */
export const SHARED_SEMANTIC_PLACES_PER_READING = 3;
export const SHARED_SEMANTIC_SOURCES_PER_PLACE = 24;
/** The newest contributions one reading is given, and the World's existing meanings shown with them. */
export const SHARED_SEMANTIC_CONTRIBUTIONS_MAX = 40;

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

export interface SharedSemanticExistingMeaning {
  readonly meaning: string;
  /** The ordinals, among this reading's contributions, it was read from (those still given). */
  readonly sourceRefs: ReadonlyArray<number>;
}

/** The interpreter's ENTIRE input. */
export interface SharedSemanticInput {
  readonly contract: typeof SHARED_SEMANTIC_INTERPRETATION_CONTRACT;
  /** Every speaker token `contributions` uses, once each, in order of first appearance. */
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

function placeOf(value: unknown, refs: ReadonlySet<number>, tokens: ReadonlySet<string>): SharedSemanticPlaceProposal | null {
  if (!isRecord(value) || !exactKeys(value, ['meaning', 'primaryThemes', 'secondaryThemes', 'sourceRefs', 'lensKey'])) return null;
  const { meaning, primaryThemes, secondaryThemes, sourceRefs, lensKey } = value;
  if (!isSemanticText(meaning, SEMANTIC_MEANING_MAX) || !isSemanticThemeSet(primaryThemes, SEMANTIC_PRIMARY_THEMES)
    || !isSemanticThemeSet(secondaryThemes, SEMANTIC_SECONDARY_THEMES) || !areDisjointThemes(primaryThemes, secondaryThemes)
    || typeof lensKey !== 'string' || !LENS_KEY.test(lensKey)) return null;
  if ([meaning, ...primaryThemes, ...secondaryThemes].some((text) => carriesSpeakerToken(text, tokens))) return null;
  if (!Array.isArray(sourceRefs) || sourceRefs.length < 1 || sourceRefs.length > SHARED_SEMANTIC_SOURCES_PER_PLACE
    || !sourceRefs.every((ref) => Number.isInteger(ref) && refs.has(ref as number)) || new Set(sourceRefs).size !== sourceRefs.length) return null;
  return Object.freeze({
    meaning, primaryThemes: Object.freeze([...primaryThemes]), secondaryThemes: Object.freeze([...secondaryThemes]),
    sourceRefs: Object.freeze([...(sourceRefs as number[])].sort((a, b) => a - b)), lensKey,
  });
}

/**
 * An interpreter's reading of exactly `input`, or null. Exactly `{ places }`, each place exactly its five fields, every
 * source one of the given ordinals; anything more — a coordinate, a score, an author — or anything invented is malformed.
 * A meaning may name a person (Product Owner D2, S8A-04 CP1); it never carries one of this reading's speaker tokens.
 */
export function decodeSharedSemanticReading(value: unknown, input: SharedSemanticInput): SharedSemanticReading | null {
  if (!isRecord(value) || !exactKeys(value, ['places']) || !Array.isArray(value.places) || value.places.length > SHARED_SEMANTIC_PLACES_PER_READING) return null;
  const refs = new Set(input.contributions.map((contribution) => contribution.ref));
  const tokens = new Set(input.writers.map((writer) => writer.speaker));
  const places: SharedSemanticPlaceProposal[] = [];
  for (const entry of value.places) {
    const place = placeOf(entry, refs, tokens);
    if (place === null) return null;
    places.push(place);
  }
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
