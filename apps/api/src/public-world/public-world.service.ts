import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PublicWorldRepository } from './public-world.repository';

export type PublicEntryView = { readonly outcome: 'ALLOW' | 'UNAVAILABLE' };
export type PublicDisplayMode = 'PSEUDONYM' | 'REAL_NAME';
export interface PublicDisplayView { readonly mode: PublicDisplayMode; readonly label: string | null; readonly realNameAvailable: boolean }
export interface PublicDisplayChangeView { readonly outcome: 'UPDATED' | 'UNCHANGED' | 'UNAVAILABLE'; readonly mode: PublicDisplayMode; readonly label: string | null }

const MODES: readonly string[] = ['PSEUDONYM', 'REAL_NAME'];
const OUTCOMES: readonly string[] = ['UPDATED', 'UNCHANGED', 'UNAVAILABLE'];
const isMode = (value: unknown): value is PublicDisplayMode => typeof value === 'string' && MODES.includes(value);
const labelOf = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public World is unavailable.'); };

/**
 * S5-01 — the «العالم العام» / Public World Product boundary over migration 0142, above the frozen I-05 runtime.
 *
 *   - entry: "may I enter Public World now?", answered by the database from current truth only (the authenticated
 *     human, the ONE Public World, the CURRENT audience policy). ALLOW, or one neutral UNAVAILABLE that says nothing
 *     about why. It authorizes the Public World ROOT and nothing inside it: no Experience, Draft, publication, search,
 *     placement, discussion, Public QANDEEL or reaction exists behind it in S5-01;
 *   - display: the reader's own Public display choice (P1 §6), PSEUDONYM (the current Public ID) or REAL_NAME (the
 *     current Name). The reader sends a MODE and nothing else — never label text; the label is derived by the database.
 *
 * Identity is the verified token only. Nothing is logged.
 */
@Injectable()
export class PublicWorldService {
  constructor(private readonly repository: PublicWorldRepository) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  entry(token: string): Promise<PublicEntryView> {
    return this.guard(async () => {
      const [row] = await this.repository.entry(token);
      // Anything but an exact ALLOW is the one neutral refusal.
      return { outcome: row?.verdict === 'ALLOW' ? 'ALLOW' : 'UNAVAILABLE' };
    });
  }

  display(token: string): Promise<PublicDisplayView> {
    return this.guard(async () => {
      const [row] = await this.repository.readDisplay(token);
      if (!row || !isMode(row.label_mode) || typeof row.real_name_available !== 'boolean') return unavailable();
      return { mode: row.label_mode, label: labelOf(row.display_label), realNameAvailable: row.real_name_available };
    });
  }

  setDisplay(token: string, body: unknown): Promise<PublicDisplayChangeView> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (Object.keys(value).some((key) => key !== 'mode') || !isMode(value.mode)) invalid();
    const mode = value.mode as PublicDisplayMode;
    return this.guard(async () => {
      const [row] = await this.repository.setDisplayMode(token, mode);
      if (!row || !OUTCOMES.includes(row.outcome) || !isMode(row.label_mode)) return unavailable();
      return { outcome: row.outcome, mode: row.label_mode, label: labelOf(row.display_label) };
    });
  }
}
