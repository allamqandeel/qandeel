// S5-03A — the provider-neutral Public Semantic Interpreter: QANDEEL's structured reading of ONE exact Public package.
//
// It is NOT the conversational Model Router. A semantic interpretation is not a turn, has no conversation, no memory,
// no Human Intelligence, no behavioural policy and no reply text: forcing it through `CONVERSATIONAL_RESPONSE` would
// make the one conversational contract lie about what it carries. It is its own small port, shaped like the other
// structured provider boundaries (hypothesis intent extraction, evidence association): a port, a deterministic test
// implementation, and a factory.
//
// No production provider is bound in THIS module: its own factory still returns the test interpreter under test and an
// interpreter that REFUSES otherwise — never a fallback to the conversational router, another provider or a canned
// answer. S8A-05 CP3 (Controlled Amendment A-4) composes the one production provider in its own module
// (`public-semantic-interpreter-provider.ts`) around the accounted transport (`ai-usage/accounted-provider-clients`), the
// one AI-COST-01 boundary, under the feature family PUBLIC_SEMANTIC_INTERPRETATION (migration 0181).
//
// The port receives only `PublicSemanticPackageInput`: the exact package of the exact Experience Version as ONE bounded
// text (≤ 24,576 bytes, migration 0181; never the title or the section), as the database's one package-only reader
// served it, and — for a correction — the publisher's own words as the database stored them. It returns `unknown`:
// whatever an implementation answers is decoded strictly by THIS module, so no adapter can widen the result shape,
// smuggle a coordinate in, name a region outside the closed vocabulary, or skip validation. Nothing here logs anything.

import { createHash } from 'node:crypto';
import { PUBLIC_SUB_REGIONS, decodePublicRegionProfile, type PublicRegionProfile } from './public-semantic-regions';

/** V2 (A-4): the package arrives as one bounded text, and the placement intent is a closed region profile. */
export const PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT = 'PUBLIC_SEMANTIC_INTERPRETATION_V2' as const;
/** The bounded input's budget, exactly the database's (0180 `interpreter_input_bytes_v1`). */
export const PUBLIC_SEMANTIC_INPUT_MAX_BYTES = 24_576;

/**
 * The interpreter's ENTIRE input: the exact public package as one bounded text, nothing else — no title, no section, no
 * author, no alias, no identifier. Each line begins with who wrote it (AUTHOR_TEXT, AUTHOR, QANDEEL,
 * QANDEEL_UNDERSTANDING; SOURCE / ANALYSIS for an S5-02 package), and [EMPHASIZED] marks what the publisher emphasized.
 */
export interface PublicSemanticPackageInput {
  readonly contract: typeof PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT;
  readonly packageText: string;
}

/** The publisher's correction: a meaning and its themes. Never a location. */
export interface PublicSemanticCorrection {
  readonly meaning: string;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
}

export interface PublicSemanticCorrectionInput extends PublicSemanticPackageInput {
  readonly correction: PublicSemanticCorrection;
}

/**
 * Structured placement intent (A-4): a closed region profile — one to three sub-regions of QANDEEL_PUBLIC_REGIONS_V1
 * with weights summing to 1. It is not a coordinate, a vector, a rank or a neighbour; the database keeps the dominant
 * sub-region as the reviewed lens key and computes the place from it, at publication.
 */
export type PublicSemanticPlacementIntent = PublicRegionProfile;

export interface PublicSemanticProposal {
  /** The meaning, in one short line (≤ 120): it becomes the frozen 0096 semantic label. */
  readonly meaning: string;
  readonly primaryThemes: ReadonlyArray<string>;
  readonly secondaryThemes: ReadonlyArray<string>;
  /** Why QANDEEL reads it so, for the publisher (≤ 280). */
  readonly explanation: string;
  readonly placementIntent: PublicSemanticPlacementIntent;
}

export type PublicSemanticCorrectionAssessment =
  | { readonly verdict: 'CONSISTENT'; readonly placementIntent: PublicSemanticPlacementIntent }
  | { readonly verdict: 'NOT_SUPPORTED_BY_PACKAGE' };

export interface PublicSemanticInterpreter {
  propose(input: PublicSemanticPackageInput, signal: AbortSignal): Promise<unknown>;
  assessCorrection(input: PublicSemanticCorrectionInput, signal: AbortSignal): Promise<unknown>;
}

export const PUBLIC_SEMANTIC_INTERPRETER = Symbol('PUBLIC_SEMANTIC_INTERPRETER');

export class PublicSemanticInterpreterUnavailableError extends Error {
  constructor() {
    super('Public semantic interpretation is unavailable.');
    this.name = 'PublicSemanticInterpreterUnavailableError';
  }
}

// ------------------------------------------------------------------------------------------------ the shape rules
// Exactly the database's (migration 0144, A.1–A.3): one line, already trimmed, no identifier.

export const SEMANTIC_MEANING_MAX = 120;
export const SEMANTIC_THEME_MAX = 40;
export const SEMANTIC_EXPLANATION_MAX = 280;
export const SEMANTIC_PRIMARY_THEMES = { min: 1, max: 3 } as const;
export const SEMANTIC_SECONDARY_THEMES = { min: 0, max: 3 } as const;
const IDENTIFIER = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

export function isSemanticText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= max && value === value.trim()
    && !/[\n\r\t]/u.test(value) && !IDENTIFIER.test(value);
}

export function isSemanticThemeSet(value: unknown, bounds: { readonly min: number; readonly max: number }): value is string[] {
  return Array.isArray(value) && value.length >= bounds.min && value.length <= bounds.max
    && value.every((theme) => isSemanticText(theme, SEMANTIC_THEME_MAX))
    && new Set((value as string[]).map((theme) => theme.toLowerCase())).size === value.length;
}

export function areDisjointThemes(primary: readonly string[], secondary: readonly string[]): boolean {
  const first = new Set(primary.map((theme) => theme.toLowerCase()));
  return secondary.every((theme) => !first.has(theme.toLowerCase()));
}

/** The closed region profile (`public-semantic-regions.ts`): known sub-regions and exact weights, nothing else. */
const intentOf = (value: unknown): PublicSemanticPlacementIntent | null => decodePublicRegionProfile(value);

/** An interpreter's proposal, or null. Exactly these five fields; anything more — a coordinate, a score — is malformed. */
export function decodePublicSemanticProposal(value: unknown): PublicSemanticProposal | null {
  if (!isRecord(value) || !exactKeys(value, ['meaning', 'primaryThemes', 'secondaryThemes', 'explanation', 'placementIntent'])) return null;
  const placementIntent = intentOf(value.placementIntent);
  if (!isSemanticText(value.meaning, SEMANTIC_MEANING_MAX) || !isSemanticText(value.explanation, SEMANTIC_EXPLANATION_MAX)
    || !isSemanticThemeSet(value.primaryThemes, SEMANTIC_PRIMARY_THEMES) || !isSemanticThemeSet(value.secondaryThemes, SEMANTIC_SECONDARY_THEMES)
    || !areDisjointThemes(value.primaryThemes, value.secondaryThemes) || !placementIntent) return null;
  return Object.freeze({
    meaning: value.meaning, primaryThemes: Object.freeze([...value.primaryThemes]), secondaryThemes: Object.freeze([...value.secondaryThemes]),
    explanation: value.explanation, placementIntent: Object.freeze(placementIntent),
  });
}

/** An interpreter's assessment of a correction, or null. */
export function decodePublicSemanticAssessment(value: unknown): PublicSemanticCorrectionAssessment | null {
  if (!isRecord(value)) return null;
  if (value.verdict === 'NOT_SUPPORTED_BY_PACKAGE' && exactKeys(value, ['verdict'])) return Object.freeze({ verdict: 'NOT_SUPPORTED_BY_PACKAGE' as const });
  if (value.verdict === 'CONSISTENT' && exactKeys(value, ['verdict', 'placementIntent'])) {
    const placementIntent = intentOf(value.placementIntent);
    return placementIntent ? Object.freeze({ verdict: 'CONSISTENT' as const, placementIntent: Object.freeze(placementIntent) }) : null;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ implementations

/**
 * The deterministic test interpreter (NODE_ENV=test only). It reads nothing but its input, answers the same input with
 * the same output, and copies no package text. It is not a model and never ships an interpretation to a real person.
 */
export class FakePublicSemanticInterpreter implements PublicSemanticInterpreter {
  private static readonly THEMES = ['family', 'work', 'fear', 'loneliness', 'decisions', 'relationships', 'parenthood', 'hope'] as const;

  /** A two-region profile of the closed vocabulary, chosen by the seed alone: 0.7 and 0.3. */
  private static profileOf(seed: Buffer): unknown {
    const count = PUBLIC_SUB_REGIONS.length;
    const first = seed[1] % count;
    const second = (first + 1 + (seed[2] % (count - 1))) % count;
    return { regions: [{ key: PUBLIC_SUB_REGIONS[first].key, weight: 0.7 }, { key: PUBLIC_SUB_REGIONS[second].key, weight: 0.3 }] };
  }

  async propose(input: PublicSemanticPackageInput): Promise<unknown> {
    const seed = createHash('sha256').update(input.packageText, 'utf8').digest();
    const themes = FakePublicSemanticInterpreter.THEMES;
    const primary = themes[seed[0] % themes.length];
    const secondary = themes[(seed[0] + 1) % themes.length];
    const lines = input.packageText.split('\n').length;
    return {
      meaning: `A test reading of ${lines} public line${lines === 1 ? '' : 's'}`,
      primaryThemes: [primary],
      secondaryThemes: [secondary],
      explanation: 'A deterministic test interpretation derived only from the public package.',
      placementIntent: FakePublicSemanticInterpreter.profileOf(seed),
    };
  }

  async assessCorrection(input: PublicSemanticCorrectionInput): Promise<unknown> {
    const seed = createHash('sha256').update(input.correction.primaryThemes.join('\n'), 'utf8').digest();
    return { verdict: 'CONSISTENT', placementIntent: FakePublicSemanticInterpreter.profileOf(seed) };
  }
}

/** Until Stage 8A binds a production provider: refuse. Never a fallback, never a canned answer. */
export class UnconfiguredPublicSemanticInterpreter implements PublicSemanticInterpreter {
  async propose(): Promise<unknown> {
    throw new PublicSemanticInterpreterUnavailableError();
  }

  async assessCorrection(): Promise<unknown> {
    throw new PublicSemanticInterpreterUnavailableError();
  }
}

export function createConfiguredPublicSemanticInterpreter(environment: NodeJS.ProcessEnv = process.env): PublicSemanticInterpreter {
  if (environment.NODE_ENV === 'test') return new FakePublicSemanticInterpreter();
  // Stage 8A owns the production provider. No provider is selected here, and no other interpreter stands in for one.
  return new UnconfiguredPublicSemanticInterpreter();
}
