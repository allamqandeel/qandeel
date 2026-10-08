// SHARED-VIS-01 — the provider-neutral Shared Semantic Interpreter: QANDEEL's structured reading of what the humans of ONE
// exact Shared World said, as the meaningful units («places») of that World's Living Analysis geography.
//
// It is the Shared counterpart of the S5-03A Public interpreter and is shaped like it — a port, a deterministic test
// implementation and a factory — with the SAME shape rules (`../public-world/public-semantic-interpreter`: one trimmed line,
// bounded themes, a lens key, no identifier). What differs is only what the Shared World is: there is no publisher who
// closed a package, so QANDEEL also says WHICH of the given contributions each meaning is read from. That provenance is
// exact — a subset of the contributions it was given — and becomes the place's MATERIAL_DEPENDENCY sources.
//
// It is NOT the conversational Model Router: a reading is not a turn and carries no reply text. No production provider is
// bound. Choosing it is Stage 8A. Until then the factory returns an interpreter that REFUSES — never a fallback, never a
// canned answer — so outside tests no place is produced and no provider is called.
//
// The port receives only `SharedSemanticInput`: the human contributions every current member may see (their words only —
// no author, Name, account, member list or identifier; each is addressed by an opaque ordinal), and the meanings the World
// already holds with the ordinals they were read from. It returns `unknown`, decoded strictly HERE, so no adapter can
// widen the shape, invent a source or smuggle a coordinate in. Nothing here logs anything.

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
  readonly text: string;
}

export interface SharedSemanticExistingMeaning {
  readonly meaning: string;
  /** The ordinals, among this reading's contributions, it was read from (those still given). */
  readonly sourceRefs: ReadonlyArray<number>;
}

/** The interpreter's ENTIRE input. */
export interface SharedSemanticInput {
  readonly contract: typeof SHARED_SEMANTIC_INTERPRETATION_CONTRACT;
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

function placeOf(value: unknown, refs: ReadonlySet<number>): SharedSemanticPlaceProposal | null {
  if (!isRecord(value) || !exactKeys(value, ['meaning', 'primaryThemes', 'secondaryThemes', 'sourceRefs', 'lensKey'])) return null;
  const { meaning, primaryThemes, secondaryThemes, sourceRefs, lensKey } = value;
  if (!isSemanticText(meaning, SEMANTIC_MEANING_MAX) || !isSemanticThemeSet(primaryThemes, SEMANTIC_PRIMARY_THEMES)
    || !isSemanticThemeSet(secondaryThemes, SEMANTIC_SECONDARY_THEMES) || !areDisjointThemes(primaryThemes, secondaryThemes)
    || typeof lensKey !== 'string' || !LENS_KEY.test(lensKey)) return null;
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
 */
export function decodeSharedSemanticReading(value: unknown, input: SharedSemanticInput): SharedSemanticReading | null {
  if (!isRecord(value) || !exactKeys(value, ['places']) || !Array.isArray(value.places) || value.places.length > SHARED_SEMANTIC_PLACES_PER_READING) return null;
  const refs = new Set(input.contributions.map((contribution) => contribution.ref));
  const places: SharedSemanticPlaceProposal[] = [];
  for (const entry of value.places) {
    const place = placeOf(entry, refs);
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

/** Until Stage 8A binds a production provider: refuse. Never a fallback, never a canned answer. */
export class UnconfiguredSharedSemanticInterpreter implements SharedSemanticInterpreter {
  async read(): Promise<unknown> {
    throw new SharedSemanticInterpreterUnavailableError();
  }
}

export function createConfiguredSharedSemanticInterpreter(environment: NodeJS.ProcessEnv = process.env): SharedSemanticInterpreter {
  if (environment.NODE_ENV === 'test') return new FakeSharedSemanticInterpreter();
  // Stage 8A owns the production provider. No provider is selected here, and no other interpreter stands in for one.
  return new UnconfiguredSharedSemanticInterpreter();
}
