import { Injectable } from '@nestjs/common';
import { MemoryDataApiService } from '../memory/memory-data-api.service';

/**
 * W3-MEGA-U — the reader's own explicit signals about their QANDEEL Understanding, as the provider-facing Hypothesis
 * reasoning context consumes them. Owner-SELECT-only tables, read with the CALLER'S token and filtered by the
 * caller's id. Only the columns the context needs are selected; nothing here carries text.
 *
 *   discussion focus (migration 0126) — the item the reader chose, from QANDEEL Understanding, to talk about;
 *   contests (migration 0127)         — the items the reader explicitly disagreed with, now under review.
 */
export interface HypothesisDiscussionFocusRow {
  readonly hypothesis_id: string;
  readonly opened_at: string;
}

/** How long an open discussion focus still tells QANDEEL which item the reader chose to talk about. */
export const DISCUSSION_FOCUS_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class HypothesisUserSignalRepository {
  constructor(private readonly dataApi: MemoryDataApiService) {}

  async readOpenDiscussionFocus(token: string, userId: string): Promise<HypothesisDiscussionFocusRow | null> {
    const query = new URLSearchParams({
      select: 'hypothesis_id,opened_at', user_id: `eq.${userId}`, closed_at: 'is.null', limit: '1',
    });
    const rows = await this.dataApi.request<HypothesisDiscussionFocusRow[]>(token, `understanding_discussion_focus?${query}`);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  /**
   * U3 (PG-01) — the items the reader EXPLICITLY disagreed with that are Contested / Under Review (migration 0127).
   * One contest under review per item, so the bound is the reader's item cap.
   */
  async listUnderReview(token: string, userId: string): Promise<ReadonlySet<string>> {
    const query = new URLSearchParams({ select: 'hypothesis_id', user_id: `eq.${userId}`, lifecycle: 'eq.UNDER_REVIEW', limit: '64' });
    const rows = await this.dataApi.request<{ hypothesis_id: string }[]>(token, `understanding_contests?${query}`);
    if (!Array.isArray(rows)) throw new Error('UNDERSTANDING_CONTEST_READ_INVALID');
    return new Set(rows.map((row) => {
      if (!row || typeof row.hypothesis_id !== 'string') throw new Error('UNDERSTANDING_CONTEST_READ_INVALID');
      return row.hypothesis_id;
    }));
  }
}
