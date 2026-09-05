// T-03B3 - the prepared cross-Session Thread continuity evaluator (B3-02 / B3-03).
//
// Turns ONE committed CU, its canonical B1 bundle, its current focus
// grounding and the EXHAUSTIVE set of the user's canonical Thread dossiers
// into a prepared, in-memory continuity decision:
//
//   input boundary gates
//   -> deterministic short-circuits (no independent focus; no dossier at all)
//   -> exhaustive deterministic screening: every dossier, in thread_id
//      textual order, in fixed-size chunks of THREAD_CONTINUITY_SCREEN_CHUNK_SIZE,
//      one provider screening call per chunk, strictly sequential
//   -> union of every nominated Thread id (deterministic short-circuit to
//      DISTINCT_NEW when nothing was nominated: a provider cannot bind to
//      nothing, and no id can be minted)
//   -> ONE final resolution over the nominated dossiers
//   -> deterministic validation
//   -> prepared result with provenance.
//
// It writes nothing, allocates nothing, and never inspects a Home, a
// relation, an importance, a confidence, a viewport or any later material:
// none of them exists in its inputs. A technical failure is never
// DISTINCT_NEW.

import { codePointLength } from '../conversation-unit/cu-anchor-mapper';
import { ATTENTION_KINDS, MAX_FOCUS_SOURCE_CHARS } from '../conversational-focus/conversational-focus.types';
import { THREAD_CONTINUITY_PROMPT_VERSION } from './thread-continuity-provider.config';
import {
  THREAD_CONTINUITY_SCHEMA_VERSION,
  ThreadContinuityProviderError,
  type ThreadContinuityProvider,
  type ThreadContinuityResolutionProposal,
  type ThreadContinuityScreeningProposal,
} from './thread-continuity-provider.types';
import { validateThreadContinuityResolution, validateThreadContinuityScreening } from './thread-continuity-validator';
import {
  compareThreadIdText,
  THREAD_CONTINUITY_EVALUATOR_VERSION,
  THREAD_CONTINUITY_SCREEN_CHUNK_SIZE,
  ThreadContinuityRejectedError,
  type PreparedThreadContinuityResult,
  type ThreadContinuityEvaluationInput,
  type ThreadContinuityProvenance,
  type ThreadIdentityDossier,
} from './thread-continuity.types';
import { THREAD_LIFECYCLE_POLICY_VERSION } from './thread-lifecycle.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The current focus's grounding handle(s), supplied by the orchestration from canonical B1 truth. */
export interface ThreadContinuityGroundingHandles {
  readonly groundingHandleIds: readonly string[];
}

export class ThreadContinuityEvaluatorService {
  constructor(
    private readonly provider: ThreadContinuityProvider,
    private readonly providerName: string,
    private readonly providerModel: string,
  ) {}

  /**
   * Resolves ONE committed CU's focus against the exhaustive dossier set, or
   * throws a typed fail-closed rejection. Nothing is written, and a technical
   * failure is never reported as DISTINCT_NEW.
   */
  async resolveOne(input: ThreadContinuityEvaluationInput, handles: ThreadContinuityGroundingHandles): Promise<PreparedThreadContinuityResult> {
    assertInput(input, handles);
    const focusId = input.currentFocusSemantics.attention.emerging_focus_id as string;
    const screenedThreadIds = input.dossiers.map((dossier) => dossier.threadId);

    // Deterministic: with no dossier at all there is nothing to be the same as.
    if (input.dossiers.length === 0) return this.prepared(input, focusId, 'DISTINCT_NEW', null, [], [], [], screenedThreadIds);

    // Exhaustive deterministic screening, one fixed chunk at a time, strictly sequential.
    const nominated = new Set<string>();
    for (let start = 0; start < input.dossiers.length; start += THREAD_CONTINUITY_SCREEN_CHUNK_SIZE) {
      const chunk = input.dossiers.slice(start, start + THREAD_CONTINUITY_SCREEN_CHUNK_SIZE);
      let proposal: ThreadContinuityScreeningProposal;
      try {
        proposal = await this.provider.screen({
          schemaVersion: THREAD_CONTINUITY_SCHEMA_VERSION,
          currentCu: input.currentCu,
          currentFocusSemantics: input.currentFocusSemantics,
          currentFocusGrounding: input.currentFocusGrounding,
          candidates: chunk,
        });
      } catch (error) {
        throw providerFailure(error);
      }
      const validated = validateThreadContinuityScreening(proposal, chunk);
      if (validated.outcome === 'REJECTED') throw new ThreadContinuityRejectedError(validated.reason, validated.index);
      for (const threadId of validated.nominated) nominated.add(threadId);
    }

    // Deterministic: nothing nominated anywhere means no existing Thread can be
    // the same; the provider is not asked to bind to nothing.
    if (nominated.size === 0) return this.prepared(input, focusId, 'DISTINCT_NEW', null, [], [], [], screenedThreadIds);

    const nominatedDossiers = input.dossiers.filter((dossier) => nominated.has(dossier.threadId));
    let resolution: ThreadContinuityResolutionProposal;
    try {
      resolution = await this.provider.resolve({
        schemaVersion: THREAD_CONTINUITY_SCHEMA_VERSION,
        currentCu: input.currentCu,
        currentFocusSemantics: input.currentFocusSemantics,
        currentFocusGrounding: input.currentFocusGrounding,
        candidates: nominatedDossiers,
      });
    } catch (error) {
      throw providerFailure(error);
    }
    const validated = validateThreadContinuityResolution(resolution, {
      currentFocusSemantics: input.currentFocusSemantics,
      currentFocusGrounding: input.currentFocusGrounding,
      groundingHandleIds: handles.groundingHandleIds,
      candidates: nominatedDossiers,
    });
    if (validated.outcome === 'REJECTED') throw new ThreadContinuityRejectedError(validated.reason, validated.index);
    return this.prepared(input, focusId, validated.decision, validated.threadId, validated.candidateThreadIds,
      validated.currentEvidenceReferenceIndexes, validated.priorEvidenceRefs, screenedThreadIds);
  }

  private prepared(
    input: ThreadContinuityEvaluationInput,
    focusId: string,
    decision: PreparedThreadContinuityResult['decision'],
    threadId: string | null,
    candidateThreadIds: readonly string[],
    currentEvidenceReferenceIndexes: readonly number[],
    priorEvidenceRefs: PreparedThreadContinuityResult['priorEvidenceRefs'],
    screenedThreadIds: readonly string[],
  ): PreparedThreadContinuityResult {
    return {
      sessionId: input.sessionId,
      cuId: input.currentCu.cuId,
      emergingFocusId: focusId,
      decision,
      threadId,
      candidateThreadIds,
      currentEvidenceReferenceIndexes,
      priorEvidenceRefs,
      screenedThreadIds,
      provenance: this.provenance(),
    };
  }

  private provenance(): ThreadContinuityProvenance {
    return {
      evaluatorVersion: THREAD_CONTINUITY_EVALUATOR_VERSION,
      policyVersion: THREAD_LIFECYCLE_POLICY_VERSION,
      provider: this.providerName,
      model: this.providerModel,
      promptVersion: THREAD_CONTINUITY_PROMPT_VERSION,
      schemaVersion: THREAD_CONTINUITY_SCHEMA_VERSION,
    };
  }
}

function providerFailure(error: unknown): Error {
  if (error instanceof ThreadContinuityProviderError) {
    return new ThreadContinuityRejectedError(error.code === 'INVALID_STRUCTURED_OUTPUT' ? 'INVALID_PROVIDER_PAYLOAD' : 'CONTINUITY_PROVIDER_UNAVAILABLE');
  }
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * The input boundary: one committed CU with ITS canonical B1 bundle carrying a
 * stable independent focus, its grounding, and dossiers that are unique, in
 * exact canonical textual order, each with at least one source-grounded item.
 */
function assertInput(input: ThreadContinuityEvaluationInput, handles: ThreadContinuityGroundingHandles): void {
  const invalid = () => new ThreadContinuityRejectedError('INVALID_EVALUATION_INPUT');
  if (!input || !isNonEmptyString(input.sessionId) || !input.currentCu || !input.currentFocusSemantics || !input.currentFocusGrounding) throw invalid();
  const { currentCu, currentFocusSemantics, currentFocusGrounding, dossiers } = input;
  if (!isNonEmptyString(currentCu.cuId) || !isNonEmptyString(currentCu.committedText) || codePointLength(currentCu.committedText) > MAX_FOCUS_SOURCE_CHARS) throw invalid();
  if (currentCu.sourceRole !== 'USER' && currentCu.sourceRole !== 'ASSISTANT') throw invalid();
  if (currentFocusSemantics.unit_id !== currentCu.cuId) throw new ThreadContinuityRejectedError('FOCUS_SEMANTICS_MISMATCH');
  const attention = currentFocusSemantics.attention;
  if (!attention || !(ATTENTION_KINDS as readonly string[]).includes(attention.kind) || !Array.isArray(currentFocusSemantics.references)) throw invalid();
  if (attention.kind === 'NO_INDEPENDENT_FOCUS' || !isNonEmptyString(attention.emerging_focus_id) || !UUID.test(attention.emerging_focus_id)) {
    throw new ThreadContinuityRejectedError('NO_INDEPENDENT_FOCUS');
  }
  if (currentFocusGrounding.emergingFocusId !== attention.emerging_focus_id || !Array.isArray(currentFocusGrounding.groundingSurfaces)) throw invalid();
  for (const surface of currentFocusGrounding.groundingSurfaces) {
    if (!surface || !isNonEmptyString(surface.cuId) || !isNonEmptyString(surface.exactSurface) || !isNonEmptyString(surface.committedCuText)) throw invalid();
  }
  if (!handles || !Array.isArray(handles.groundingHandleIds) || handles.groundingHandleIds.length === 0 || !handles.groundingHandleIds.every((id) => UUID.test(id))) throw invalid();
  if (!Array.isArray(dossiers)) throw invalid();
  let last: string | null = null;
  for (const dossier of dossiers) {
    if (!dossier || !isNonEmptyString(dossier.threadId) || !UUID.test(dossier.threadId) || !Array.isArray(dossier.identityEvidence) || dossier.identityEvidence.length === 0) {
      throw new ThreadContinuityRejectedError('INVALID_DOSSIER');
    }
    // Deterministic textual order, no duplicate: the exhaustiveness proof rests on it.
    if (last !== null && compareThreadIdText(last, dossier.threadId) >= 0) throw new ThreadContinuityRejectedError('INVALID_DOSSIER');
    for (const item of dossier.identityEvidence) {
      if (!item || !isNonEmptyString(item.sessionId) || !isNonEmptyString(item.cuId) || !isNonEmptyString(item.exactSurface) || !isNonEmptyString(item.committedCuText)
        || (item.sourceRole !== 'USER' && item.sourceRole !== 'ASSISTANT')) {
        throw new ThreadContinuityRejectedError('INVALID_DOSSIER');
      }
      // A dossier item is source-grounded: its surface is committed wording of its CU.
      if (!item.committedCuText.includes(item.exactSurface)) throw new ThreadContinuityRejectedError('INVALID_DOSSIER');
    }
    last = dossier.threadId;
  }
}

/** Splits one exhaustive dossier list into its deterministic fixed-size chunks (exported for the exhaustiveness proof). */
export function chunkDossiers(dossiers: readonly ThreadIdentityDossier[], size: number = THREAD_CONTINUITY_SCREEN_CHUNK_SIZE): readonly (readonly ThreadIdentityDossier[])[] {
  const chunks: ThreadIdentityDossier[][] = [];
  for (let start = 0; start < dossiers.length; start += size) chunks.push(dossiers.slice(start, start + size));
  return chunks;
}
