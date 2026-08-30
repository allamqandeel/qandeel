import { ServiceUnavailableException } from '@nestjs/common';
import { QuestionForegroundSelectionService } from './question-foreground-selection.service';
import {
  QUESTION_FOREGROUND_WAIT_BUDGET_MS,
  type QuestionForegroundSelectionInput,
} from './question-foreground-selection.types';
import { QUESTION_INFORMATION_OBJECTIVES } from './question-context.types';
import type { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';

const BINDING_ID = '40000000-0000-4000-8000-000000000001';

const selectedRow = (questionType = 'VALIDATION') => [{ outcome: 'SELECTED', binding_id: BINDING_ID, question_type: questionType }];
const emptyRow = (reason: string) => [{ outcome: reason, binding_id: null, question_type: null }];

describe('QIR-006 QuestionForegroundSelectionService', () => {
  let serviceApi: { rpc: jest.Mock };
  let correlation: CorrelationService;
  let telemetry: TelemetryService;
  let recordSelection: jest.SpyInstance;
  const input: QuestionForegroundSelectionInput = {
    userId: '10000000-0000-4000-8000-000000000001',
    sessionId: '20000000-0000-4000-8000-000000000002',
    sourceTurnId: '30000000-0000-4000-8000-000000000003',
    path: 'FAST',
  };
  const service = () => new QuestionForegroundSelectionService(
    serviceApi as unknown as SupabaseServiceRoleApiService, correlation, telemetry);

  beforeEach(() => {
    serviceApi = { rpc: jest.fn().mockResolvedValue(emptyRow('NO_ELIGIBLE_GAP')) };
    correlation = new CorrelationService();
    telemetry = new TelemetryService(correlation);
    recordSelection = jest.spyOn(telemetry, 'recordQuestionForegroundSelection');
  });

  it('freezes the QIR-006 foreground wait ceiling at exactly 300 ms', () => {
    expect(QUESTION_FOREGROUND_WAIT_BUDGET_MS).toBe(300);
  });

  it('issues exactly ONE selection RPC carrying only the caller identity triple, and never a gap/hypothesis/confidence identity', async () => {
    await service().select(input);
    expect(serviceApi.rpc).toHaveBeenCalledTimes(1);
    expect(serviceApi.rpc).toHaveBeenCalledWith('select_formal_question_opportunity_v1', {
      p_user_id: input.userId, p_session_id: input.sessionId, p_source_turn_id: input.sourceTurnId,
    });
    const body = JSON.stringify(serviceApi.rpc.mock.calls[0][1]);
    for (const forbidden of ['gap', 'hypothesis', 'confidence', 'epoch', 'objective', 'status', 'missing']) {
      expect(body.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('returns SELECTED with the reservation identity and the exact sanitized provider-safe QuestionContext', async () => {
    serviceApi.rpc.mockResolvedValue(selectedRow('FACT_FINDING'));
    const outcome = await service().select(input);
    expect(outcome).toEqual({
      state: 'SELECTED', bindingId: BINDING_ID,
      questionContext: {
        contractVersion: 1, source: 'QANDEEL_QUESTION_ENGINE', questionType: 'FACT_FINDING',
        answerFormat: 'FREE_TEXT', informationObjective: QUESTION_INFORMATION_OBJECTIVES.FACT_FINDING,
      },
    });
    expect(recordSelection).toHaveBeenCalledTimes(1);
    expect(recordSelection).toHaveBeenCalledWith('SELECTED', 'FAST', undefined);
  });

  it.each([
    ['VALIDATION', QUESTION_INFORMATION_OBJECTIVES.VALIDATION],
    ['DISCRIMINATING', QUESTION_INFORMATION_OBJECTIVES.DISCRIMINATING],
  ] as const)('maps the server-derived %s opportunity to its fixed sanitized objective', async (questionType, objective) => {
    serviceApi.rpc.mockResolvedValue(selectedRow(questionType));
    const outcome = await service().select(input);
    expect(outcome.state).toBe('SELECTED');
    if (outcome.state === 'SELECTED') {
      expect(outcome.questionContext.questionType).toBe(questionType);
      expect(outcome.questionContext.informationObjective).toBe(objective);
      // The provider-safe context carries the sanitized objective ONLY.
      expect(Object.keys(outcome.questionContext).sort()).toEqual(
        ['answerFormat', 'contractVersion', 'informationObjective', 'questionType', 'source']);
    }
  });

  it.each(['NO_ELIGIBLE_GAP', 'OUTSTANDING_OPEN_QUESTION'] as const)(
    'returns LEGITIMATE_EMPTY with the bounded %s reason', async (reason) => {
      serviceApi.rpc.mockResolvedValue(emptyRow(reason));
      await expect(service().select(input)).resolves.toEqual({ state: 'LEGITIMATE_EMPTY', reason });
      expect(recordSelection).toHaveBeenCalledWith('LEGITIMATE_EMPTY', 'FAST', reason);
    });

  it('classifies FOREGROUND_BUDGET_EXPIRY at exactly the 300 ms boundary and discards the late fulfillment', async () => {
    jest.useFakeTimers();
    try {
      let resolveLate: (value: unknown) => void = () => undefined;
      serviceApi.rpc.mockImplementation(() => new Promise((resolve) => { resolveLate = resolve; }));
      const pending = service().select(input);
      await jest.advanceTimersByTimeAsync(QUESTION_FOREGROUND_WAIT_BUDGET_MS - 1);
      expect(recordSelection).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual({ state: 'FOREGROUND_BUDGET_EXPIRY' });
      expect(recordSelection).toHaveBeenCalledTimes(1);
      expect(recordSelection).toHaveBeenCalledWith('FOREGROUND_BUDGET_EXPIRY', 'FAST', undefined);
      // The late fulfillment settles into the already-settled race as a no-op:
      // no second outcome, no second metric, nothing consumed by this turn.
      resolveLate(selectedRow());
      await Promise.resolve(); await Promise.resolve();
      expect(recordSelection).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it('absorbs a late rejection after expiry with no unhandled rejection and no extra outcome', async () => {
    jest.useFakeTimers();
    try {
      let rejectLate: (error: unknown) => void = () => undefined;
      serviceApi.rpc.mockImplementation(() => new Promise((_resolve, reject) => { rejectLate = reject; }));
      const pending = service().select(input);
      await jest.advanceTimersByTimeAsync(QUESTION_FOREGROUND_WAIT_BUDGET_MS);
      await expect(pending).resolves.toEqual({ state: 'FOREGROUND_BUDGET_EXPIRY' });
      rejectLate(new DataApiError(401));
      await Promise.resolve(); await Promise.resolve();
      expect(recordSelection).toHaveBeenCalledTimes(1);
      expect(recordSelection).toHaveBeenCalledWith('FOREGROUND_BUDGET_EXPIRY', 'FAST', undefined);
    } finally { jest.useRealTimers(); }
  });

  it('clears the deadline timer when a fast selection settles first', async () => {
    jest.useFakeTimers();
    try {
      serviceApi.rpc.mockResolvedValue(emptyRow('NO_ELIGIBLE_GAP'));
      await expect(service().select(input)).resolves.toEqual({ state: 'LEGITIMATE_EMPTY', reason: 'NO_ELIGIBLE_GAP' });
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });

  it.each([408, 429, 500, 503, 599])(
    'degrades the approved transient status %s to OPTIONAL_AVAILABILITY_FAILURE', async (status) => {
      serviceApi.rpc.mockRejectedValue(new DataApiError(status));
      await expect(service().select(input)).resolves.toEqual({ state: 'OPTIONAL_AVAILABILITY_FAILURE' });
      expect(recordSelection).toHaveBeenCalledWith('OPTIONAL_AVAILABILITY_FAILURE', 'FAST', undefined);
    });

  it('degrades the sanitized ServiceUnavailable transport/configuration identity', async () => {
    serviceApi.rpc.mockRejectedValue(new ServiceUnavailableException('Server conversation authority is unavailable.'));
    await expect(service().select(input)).resolves.toEqual({ state: 'OPTIONAL_AVAILABILITY_FAILURE' });
  });

  it.each([400, 401, 403, 404, 409, 422])(
    'fails CLOSED on authority/integrity status %s with the ORIGINAL error', async (status) => {
      const original = new DataApiError(status);
      serviceApi.rpc.mockRejectedValue(original);
      await expect(service().select(input)).rejects.toBe(original);
      expect(recordSelection).toHaveBeenCalledWith('HARD_FAILURE', 'FAST', undefined);
    });

  it('fails CLOSED on an unexpected error type with the ORIGINAL error', async () => {
    const original = new Error('unexpected');
    serviceApi.rpc.mockRejectedValue(original);
    await expect(service().select(input)).rejects.toBe(original);
  });

  it.each([
    ['an empty result set', []],
    ['two result rows', [...selectedRow(), ...selectedRow()]],
    ['a non-array value', { outcome: 'SELECTED' }],
    ['a null row', [null]],
    ['an unknown outcome', [{ outcome: 'ASKED', binding_id: null, question_type: null }]],
    ['a SELECTED row with no reservation identity', [{ outcome: 'SELECTED', binding_id: null, question_type: 'VALIDATION' }]],
    ['a SELECTED row with a malformed reservation identity', [{ outcome: 'SELECTED', binding_id: 'not-a-uuid', question_type: 'VALIDATION' }]],
    ['a SELECTED row with an unknown question type', [{ outcome: 'SELECTED', binding_id: BINDING_ID, question_type: 'CLARIFICATION' }]],
    ['a legitimate-empty row smuggling a reservation identity', [{ outcome: 'NO_ELIGIBLE_GAP', binding_id: BINDING_ID, question_type: null }]],
    ['a legitimate-empty row smuggling a question type', [{ outcome: 'OUTSTANDING_OPEN_QUESTION', binding_id: null, question_type: 'VALIDATION' }]],
  ] as const)('treats %s as HARD_FAILURE - never reinterpreted as empty, never fabricated into omission', async (_label, value) => {
    serviceApi.rpc.mockResolvedValue(value);
    await expect(service().select(input)).rejects.toThrow('QIR_QUESTION_FOREGROUND_MALFORMED_RESULT');
    expect(recordSelection).toHaveBeenCalledWith('HARD_FAILURE', 'FAST', undefined);
    expect(recordSelection).toHaveBeenCalledTimes(1);
  });

  it('keeps telemetry fail-soft: a throwing recorder never alters the selection outcome', async () => {
    recordSelection.mockImplementation(() => { throw new Error('meter down'); });
    serviceApi.rpc.mockResolvedValue(selectedRow());
    const outcome = await service().select(input);
    expect(outcome.state).toBe('SELECTED');
    const original = new DataApiError(403);
    serviceApi.rpc.mockRejectedValue(original);
    await expect(service().select(input)).rejects.toBe(original);
  });

  it('emits exactly one bounded outcome metric per selection, at determination time', async () => {
    serviceApi.rpc.mockResolvedValue(emptyRow('OUTSTANDING_OPEN_QUESTION'));
    await service().select(input);
    expect(recordSelection).toHaveBeenCalledTimes(1);
    serviceApi.rpc.mockResolvedValue(selectedRow());
    await service().select(input);
    expect(recordSelection).toHaveBeenCalledTimes(2);
  });
});
