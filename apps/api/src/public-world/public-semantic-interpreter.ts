// S5-03A — the provider-neutral Public Semantic Interpreter: QANDEEL's structured reading of ONE exact Public package.
//
// It is NOT the conversational Model Router. A semantic interpretation is not a turn, has no conversation, no memory,
// no Human Intelligence, no behavioural policy and no reply text: forcing it through `CONVERSATIONAL_RESPONSE` would
// make the one conversational contract lie about what it carries. It is its own small port, shaped like the other
// structured provider boundaries (hypothesis intent extraction, evidence association): a port, a deterministic test
// implementation, and a factory.
//
// No production provider is bound here. Choosing the Production LLM is Stage 8A (QANDEEL AI Brain / Production LLM
// Runtime). Until then the factory returns an interpreter that REFUSES — it never falls back to the conversational
// router, to another provider, or to a canned answer — so outside tests no interpretation is produced and no provider
// is called (and therefore no provider spend exists to account). When Stage 8A binds a provider, its adapter is composed
// in this factory around an accounted transport (`ai-usage/accounted-provider-clients`), the one AI-COST-01 boundary,
// exactly as the existing structured providers are; the ledger's feature family is added by that change.
//
// The port receives only `PublicSemanticPackageInput`: the exact package items of the exact Experience Version, as the
// database's one package-only reader served them, and — for a correction — the publisher's own words as the database
// stored them. It returns `unknown`: whatever an implementation answers is decoded strictly by THIS module, so no
// adapter can widen the result shape, smuggle a coordinate in, or skip validation. Nothing here logs anything.

import { createHash } from 'node:crypto';

export const PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT = 'PUBLIC_SEMANTIC_INTERPRETATION_V1' as const;

export interface PublicSemanticPackageItem {
  readonly ordinal: number;
  /** Whether the item is source content (a human's words, or a source-content-bearing copy) or QANDEEL's analysis. */
  readonly kind: 'SOURCE_CONTENT' | 'ANALYSIS';
  readonly text: string;
}

/** The interpreter's ENTIRE input: the exact public package, nothing else — no author, no alias, no identifier. */
export interface PublicSemanticPackageInput {
  readonly contract: typeof PUBLIC_SEMANTIC_INTERPRETATION_CONTRACT;
  readonly items: ReadonlyArray<PublicSemanticPackageItem>;
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
 * Structured placement intent for S5-03B: a lens key — the semantic region the meaning is read under. It is not a
 * coordinate, a vector, a rank or a neighbour; S5-03B turns the reviewed interpretation into a stable spatial placement.
 */
export interface PublicSemanticPlacementIntent {
  readonly lensKey: string;
}

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
const LENS_KEY = /^[a-z0-9][a-z0-9_.-]{0,63}$/u;
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

const intentOf = (value: unknown): PublicSemanticPlacementIntent | null =>
  (isRecord(value) && exactKeys(value, ['lensKey']) && typeof value.lensKey === 'string' && LENS_KEY.test(value.lensKey)
    ? { lensKey: value.lensKey } : null);

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

  async propose(input: PublicSemanticPackageInput): Promise<unknown> {
    const seed = createHash('sha256').update(input.items.map((item) => `${item.ordinal}:${item.kind}:${item.text}`).join('\n'), 'utf8').digest();
    const themes = FakePublicSemanticInterpreter.THEMES;
    const primary = themes[seed[0] % themes.length];
    const secondary = themes[(seed[0] + 1) % themes.length];
    return {
      meaning: `A test reading of ${input.items.length} public item${input.items.length === 1 ? '' : 's'}`,
      primaryThemes: [primary],
      secondaryThemes: [secondary],
      explanation: 'A deterministic test interpretation derived only from the public package.',
      placementIntent: { lensKey: primary },
    };
  }

  async assessCorrection(input: PublicSemanticCorrectionInput): Promise<unknown> {
    const digest = createHash('sha256').update(input.correction.primaryThemes.join('\n'), 'utf8').digest('hex').slice(0, 8);
    return { verdict: 'CONSISTENT', placementIntent: { lensKey: `corrected.${digest}` } };
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
