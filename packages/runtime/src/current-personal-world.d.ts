/**
 * COSMOS E-2 corrections, Slice C — the user-level CURRENT Personal World (Product Owner decision D-5, Option U,
 * 2026-11-20; migration 0199).
 *
 * Beside — never instead of — the Session-bound historical projection (`historical-projection.d.ts`), whose frozen
 * availability law is unchanged: this is the ONE world the person has NOW. It carries no Session Position, no Live Head,
 * no lifecycle state and no Reading appearance: those are Session-anchored facts under the frozen temporal authority.
 * `asOf` is the instant of the read — a marker that this is the present, never a TC.
 */
import type { DisclosedThreadName, DisclosedThreadOrigin } from './historical-projection';

export interface CurrentPersonalThread {
  readonly id: string;
  /** The Thread's ONE canonical Home (0068), as exact integer text. */
  readonly home: { readonly x: string; readonly y: string };
  /** The served name under the 0198 law: the person's alias, else the grounding wording of their own words, else NONE. */
  readonly name: DisclosedThreadName;
  /** Where the Thread was established: the person's own Session and the Session Position. */
  readonly origin: DisclosedThreadOrigin;
}

export interface CurrentPersonalWorld {
  /** ISO-8601 instant of the read. The present; never a Session Position. */
  readonly asOf: string;
  /** Every Thread the person owns that carries a Home, in a deterministic order (by id). Empty is a truthful answer. */
  readonly threads: readonly CurrentPersonalThread[];
}
