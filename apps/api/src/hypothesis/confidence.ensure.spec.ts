import type { EvidenceService } from '../memory/evidence.service';
import { MemoryDataApiError, type MemoryDataApiService } from '../memory/memory-data-api.service';
import { ConfidenceRepository } from './confidence.repository';
import { ConfidenceService } from './confidence.service';
import type { ConfidenceEvaluationRecord } from './confidence.types';
import type { HypothesisService } from './hypothesis.service';
import type { HypothesisView } from './hypothesis.types';

// W3-MEGA-U R2 — exactly-once contest Confidence. These tests drive the REAL ConfidenceService and the REAL
// ConfidenceRepository over a Data API double that behaves like the canonical command: the evaluation id is the
// primary key, so a second insert under it is refused (409) while the first is kept. Concurrency is not simulated by
// calling things one after another: a barrier holds every first read until ALL racing requests have issued theirs, so
// each of them observes "no evaluation yet" before any create runs — the exact window of the read-then-create race.

const USER = 'user-a';
const H1 = '11111111-1111-4111-8111-111111111111';
const EVAL = '0f1e2d3c-4b5a-4968-8776-655443322110';
const VERSION = 4;

const hypothesis = (): HypothesisView => ({
  id: H1, user_id: USER, statement: 'Time pressure contributes.', type: 'CAUSAL', domain: 'DECISION', scope: 'scope',
  origin: 'SYSTEM_GENERATED', status: 'MIXED', version: VERSION, supporting_evidence_ids: [], contradicting_evidence_ids: [],
  competing_hypothesis_ids: [], assumptions: [], disconfirming_conditions: [],
  currentlyEligibleSupportingEvidenceIds: [], currentlyEligibleContradictingEvidenceIds: [],
  created_at: '2026-09-30T00:00:00.000Z', updated_at: '2026-09-30T00:00:00.000Z',
});

/** Releases every waiter once `parties` of them have arrived; later arrivals pass straight through. */
function barrier(parties: number): () => Promise<void> {
  let arrived = 0;
  let release!: () => void;
  const open = new Promise<void>((resolve) => { release = resolve; });
  return async () => {
    arrived += 1;
    if (arrived >= parties) release();
    await open;
  };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

class PrimaryKeyedConfidenceTable {
  readonly rows: ConfidenceEvaluationRecord[] = [];
  readonly creates: string[] = [];
  firstRead: (() => Promise<void>) | null = null;
  failNextCreate = false;

  readonly api = {
    request: async (_token: string, path: string, init?: RequestInit): Promise<unknown> => {
      await tick();
      if (path === 'rpc/create_confidence_evaluation') {
        const { p_evaluation: value } = JSON.parse(String(init?.body)) as { p_evaluation: ConfidenceEvaluationRecord };
        this.creates.push(value.id);
        await tick();
        if (this.failNextCreate) { this.failNextCreate = false; throw new MemoryDataApiError(503); }
        if (value.target_version !== VERSION) throw new MemoryDataApiError(400);
        if (this.rows.some((row) => row.id === value.id)) throw new MemoryDataApiError(409);
        const row = { ...value, user_id: USER, created_at: 'now', updated_at: 'now' } as ConfidenceEvaluationRecord;
        this.rows.push(row);
        return [row];
      }
      const query = new URLSearchParams(path.slice(path.indexOf('?') + 1));
      if (this.firstRead) await this.firstRead();
      const user = query.get('user_id')?.replace(/^eq\./u, '');
      const id = query.get('id')?.replace(/^eq\./u, '');
      const exact = /target_version\.eq\.(\d+)/u.exec(query.get('or') ?? '');
      return this.rows.filter((row) => row.user_id === user && (id === undefined || row.id === id) &&
        (exact === null || row.target_version === Number(exact[1])));
    },
  };
}

describe('ConfidenceService.ensureHypothesisVersionEvaluation — one contest, one Confidence row', () => {
  let table: PrimaryKeyedConfidenceTable;
  let repository: ConfidenceRepository;
  let service: ConfidenceService;
  beforeEach(() => {
    table = new PrimaryKeyedConfidenceTable();
    repository = new ConfidenceRepository(table.api as unknown as MemoryDataApiService);
    const hypotheses = { find: jest.fn().mockResolvedValue(hypothesis()) } as unknown as HypothesisService;
    const evidence = { listEligibleForUser: jest.fn().mockResolvedValue([]) } as unknown as EvidenceService;
    service = new ConfidenceService(hypotheses, evidence, repository);
  });
  const ensure = () => service.ensureHypothesisVersionEvaluation(USER, 'token', H1, VERSION, EVAL);

  it('creates the canonical, uncalibrated exact-version evaluation under THAT identity', async () => {
    const row = await ensure();
    expect(row).toMatchObject({
      id: EVAL, user_id: USER, target_id: H1, target_type: 'HYPOTHESIS', target_version: VERSION, lifecycle_state: 'EVALUATED',
      numeric_score: null, confidence_band: null, calibration_state: 'UNCALIBRATED', stability: 'UNASSESSED',
      policy_version: 'confidence-foundation-v1', provenance: 'QANDEEL_CONFIDENCE_RUNTIME',
    });
    expect(row.missing_information_codes).toContain('CONFIDENCE_MODEL_UNCALIBRATED');
    expect(table.rows).toHaveLength(1);
  });

  it('Case A — lost-response replay: the completed evaluation is found, verified and reused; nothing is created again', async () => {
    await ensure();
    await expect(ensure()).resolves.toMatchObject({ id: EVAL });
    await expect(ensure()).resolves.toMatchObject({ id: EVAL });
    expect(table.creates).toEqual([EVAL]);
    expect(table.rows.map((row) => row.id)).toEqual([EVAL]);
  });

  it('Case B — a transient failure before any row exists: the retry uses the SAME identity and one row results', async () => {
    table.failNextCreate = true;
    await expect(ensure()).rejects.toBeInstanceOf(MemoryDataApiError);
    expect(table.rows).toHaveLength(0);
    await expect(ensure()).resolves.toMatchObject({ id: EVAL });
    expect(table.creates).toEqual([EVAL, EVAL]);
    expect(table.rows.map((row) => row.id)).toEqual([EVAL]);
  });

  it('Case C — simultaneous requests that ALL observed "none yet" converge on exactly ONE row', async () => {
    const racers = 4;
    table.firstRead = barrier(racers);
    const results = await Promise.all(Array.from({ length: racers }, () => ensure()));
    // Every request really raced: each one attempted the create under the same identity after reading nothing.
    expect(table.creates).toEqual(Array(racers).fill(EVAL));
    expect(results.map((row) => row.id)).toEqual(Array(racers).fill(EVAL));
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({ id: EVAL, target_id: H1, target_version: VERSION, provenance: 'QANDEEL_CONFIDENCE_RUNTIME' });
  });

  it('control: the pre-R2 read-any-exact-version-then-create pattern DOES duplicate under the same interleaving', async () => {
    table.firstRead = barrier(2);
    const legacy = async () => {
      const existing = await repository.listExactVersionsForTargets('token', USER, [{ id: H1, version: VERSION }]);
      if (existing.length === 0) await service.evaluateHypothesisVersion(USER, 'token', H1, VERSION);
    };
    await Promise.all([legacy(), legacy()]);
    expect(table.rows).toHaveLength(2);
    expect(new Set(table.rows.map((row) => row.id)).size).toBe(2);
  });

  it('a row under the identity that is not this exact evaluation is an integrity failure, never a success', async () => {
    table.rows.push({ ...(await ensure()), target_version: VERSION - 1 });
    table.rows.shift();
    await expect(ensure()).rejects.toThrow('CONFIDENCE_TARGET_VERSION_INTEGRITY');
    table.rows[0] = { ...table.rows[0], target_version: VERSION, target_id: '99999999-9999-4999-8999-999999999999' };
    await expect(ensure()).rejects.toThrow('CONFIDENCE_TARGET_VERSION_INTEGRITY');
    table.rows[0] = { ...table.rows[0], target_id: H1, numeric_score: 0.7 as never };
    await expect(ensure()).rejects.toThrow('CONFIDENCE_TARGET_VERSION_INTEGRITY');
  });

  it('refuses a malformed identity or version before touching the database', async () => {
    await expect(service.ensureHypothesisVersionEvaluation(USER, 'token', H1, VERSION, 'not-a-uuid')).rejects.toThrow('CONFIDENCE_EVALUATION_IDENTITY_INVALID');
    await expect(service.ensureHypothesisVersionEvaluation(USER, 'token', H1, 0, EVAL)).rejects.toThrow('Invalid confidence target version.');
    expect(table.creates).toEqual([]);
  });
});
