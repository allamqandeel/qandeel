// T-03C - the authenticated Layer-A read seam.
//
// ONE owner-scoped read and nothing else: `get_session_historical_projection_v1`
// through the AUTHENTICATED Data API channel with the caller's own token. The
// database derives the owner from `auth.uid()`, decides coverage, validates TC
// against the authoritative Session Position and projects every family by its
// own availability anchor. This seam maps the row strictly and classifies the
// database's typed refusals; it never invents a projection, never falls back
// to current rows and never writes.

import { DataApiError, readDataApiUpstreamIdentity, type SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { mapHistoricalProjectionRow } from './historical-projection-mapper';
import { HistoricalProjectionUnavailableError, type HistoricalKnowledge } from './historical-projection.types';

const TYPED_REFUSALS = ['HISTORICAL_COVERAGE_UNAVAILABLE', 'LIVE_HEAD_NOT_ESTABLISHED', 'HISTORICAL_BASELINE_MISSING', 'SESSION_POSITION_NOT_ADDRESSABLE'] as const;

/**
 * Classifies a Data API failure into the projection's typed refusals. The
 * database raises exactly these tokens; `FORBIDDEN` (a Session the caller does
 * not own, or no caller) is reported as not visible so that existence is
 * never disclosed. Anything else is not a projection refusal and is rethrown.
 */
export function classifyProjectionFailure(error: unknown): HistoricalProjectionUnavailableError | null {
  if (!(error instanceof DataApiError)) return null;
  const { databaseCode, databaseMessage } = readDataApiUpstreamIdentity(error);
  const message = databaseMessage ?? '';
  for (const refusal of TYPED_REFUSALS) {
    if (message.includes(refusal)) return new HistoricalProjectionUnavailableError(refusal);
  }
  if (message.includes('FORBIDDEN') || databaseCode === '42501' || error.status === 403 || error.status === 401) {
    return new HistoricalProjectionUnavailableError('SESSION_NOT_VISIBLE');
  }
  return null;
}

export class HistoricalProjectionRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  /** `K(TC)` for ONE covered Session at ONE addressable Session Position, as the caller's own owner-scoped read. */
  async project(accessToken: string, sessionId: string, tc: number): Promise<HistoricalKnowledge> {
    if (!Number.isSafeInteger(tc) || tc < 1) throw new HistoricalProjectionUnavailableError('SESSION_POSITION_NOT_ADDRESSABLE');
    let rows: unknown;
    try {
      rows = await this.dataApi.request<unknown>(accessToken, 'rpc/get_session_historical_projection_v1', {
        method: 'POST',
        body: JSON.stringify({ p_session_id: sessionId, p_tc: tc }),
      });
    } catch (error) {
      throw classifyProjectionFailure(error) ?? error;
    }
    if (!Array.isArray(rows) || rows.length !== 1) throw new HistoricalProjectionUnavailableError('SESSION_NOT_VISIBLE');
    const knowledge = mapHistoricalProjectionRow(rows[0]);
    if (knowledge.sessionId !== sessionId || knowledge.tc !== tc) throw new HistoricalProjectionUnavailableError('SESSION_NOT_VISIBLE');
    return knowledge;
  }
}
