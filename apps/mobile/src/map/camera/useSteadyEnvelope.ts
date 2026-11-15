/**
 * MAP-CLOSE-01 CA-O1 (Product Owner, 2026-11-14): the world's envelope, its anchor held where it was when only the room
 * below the world changes (`steadyEnvelope`), so the world does not jump when the return acts or a place's panel come and
 * go.
 *
 * Holding starts with the reader's first act on this world (its camera changed): until then the Analysis screen is still
 * composing its glass (its bands measure what they hold over several layouts), and the opening composition is exactly
 * what it was. Every band change that FOLLOWS an act — the return acts appearing after a zoom or a drag, a place's panel
 * opening or closing — then leaves the world where it was on the glass.
 *
 * Presentation only (Class D): no camera moves, nothing is dispatched and nothing is recorded.
 */
import { useState } from 'react';

import type { CanonicalWorldAddress } from '../world';
import { envelopeEquals, steadyEnvelope, type ViewportEnvelope } from './viewport';

/** What identifies where a world's camera looks: its anchor and its rung. */
export interface SteadyEnvelopeCamera {
  readonly anchor: CanonicalWorldAddress;
  readonly depth: string;
}

interface Record {
  /** The camera this world was composed at, until the reader's first act. */
  readonly first: string | null;
  readonly acted: boolean;
  readonly held: ViewportEnvelope;
}

const keyOf = (camera: SteadyEnvelopeCamera | null): string | null =>
  camera === null ? null : `${camera.anchor.x}:${camera.anchor.y}:${camera.depth}`;

export function useSteadyEnvelope(envelope: ViewportEnvelope, camera: SteadyEnvelopeCamera | null): ViewportEnvelope {
  const key = keyOf(camera);
  const [record, setRecord] = useState<Record>(() => ({ first: key, acted: false, held: envelope }));
  const first = record.first ?? key;
  const acted = record.acted || (first !== null && key !== null && key !== first);
  const steady = acted ? steadyEnvelope(record.held, envelope) : envelope;
  // Information from the previous render, kept as React keeps it: the update is conditional and settles in one pass,
  // because holding a held anchor again returns the same envelope.
  if (record.first !== first || record.acted !== acted || !envelopeEquals(record.held, steady)) setRecord({ first, acted, held: steady });
  return steady;
}
