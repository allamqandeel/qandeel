/**
 * COSMOS-INT-01 Slice D (Contract v1.5 §19.4 / §19.6) — the Detail Sheet's presentation state, owned by the host.
 *
 * The phase is PRESENTATION ONLY (D-12): it is never written to a canonical store, a controller, history, the recovery
 * record or a per-World anchor, and nothing here calls the world's Back, clears a focus, writes a camera or reads the
 * server. The host names WHAT its sheet shows (`SheetContent`); this hook decides only how much of it is shown:
 *
 *   - a content of a new GROUP (a new focus, the results, the section list, a field state) opens the PEEK, or EXPANDED
 *     when it asks for it (the Public discussion);
 *   - a new content within the SAME group (the discussion of the focused Experience, opened or closed) keeps the phase,
 *     a CLOSED one too, except that entering a content that asks for EXPANDED expands;
 *   - no content forces CLOSED;
 *   - an explicit reader act (`open`) shows a closed sheet again (SD-12: a tap on the focused item);
 *   - `back` is the sheet's share of the host's ONE hardware Back handler: EXPANDED → PEEK → CLOSED, and `false` once
 *     there is nothing left to dismiss, so the host's own navigation runs.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { SheetPhase } from './sheet-geometry';

export interface SheetContent {
  /** This content's identity: a change of key with the same group keeps the phase. */
  readonly key: string;
  /** The thing it is about (one Experience, the results, the sections): a change of group opens the PEEK again. */
  readonly group: string;
  /** Entering this content shows it EXPANDED (the Public discussion: a reading surface of its own). */
  readonly expanded?: boolean;
}

export interface DetailSheet {
  readonly phase: SheetPhase;
  /** The phase a drag or the handle settled in. Ignored while there is no content (nothing is shown into nothing). */
  readonly settle: (phase: SheetPhase) => void;
  /** An explicit reader act shows the sheet: a closed one in PEEK; an open one is left where it is. */
  readonly open: () => void;
  /** The sheet's step of the host's hardware Back: `true` when it dismissed something, `false` when it had nothing to dismiss. */
  readonly back: () => boolean;
}

interface Held {
  readonly phase: SheetPhase;
  readonly key: string | null;
  readonly group: string | null;
}

function next(held: Held, content: SheetContent | null): Held {
  if (content === null) return held.key === null && held.phase === 'CLOSED' ? held : { phase: 'CLOSED', key: null, group: null };
  if (content.key === held.key) return held;
  const entering: SheetPhase = content.expanded === true ? 'EXPANDED' : 'PEEK';
  // §19.4: within the same Experience the phase is kept, a CLOSED one too (the hardware Back that leaves the discussion
  // once the sheet has closed must not show the panel again; the reader's next Back releases the focus).
  if (content.group === held.group) {
    return { phase: content.expanded === true ? 'EXPANDED' : held.phase, key: content.key, group: content.group };
  }
  return { phase: entering, key: content.key, group: content.group };
}

export function useDetailSheet(content: SheetContent | null): DetailSheet {
  const [held, setHeld] = useState<Held>(() => next({ phase: 'CLOSED', key: null, group: null }, content));
  // The content is followed during render (no effect, no frame where the old phase shows the new content).
  const followed = next(held, content);
  if (followed !== held) setHeld(followed);
  // What `back` reads: the phase as last rendered (a hardware key press is handled between renders, never inside one).
  const present = useRef(followed);
  useLayoutEffect(() => { present.current = followed; });

  const settle = useCallback((phase: SheetPhase) => {
    setHeld((at) => (at.key === null || at.phase === phase ? at : { ...at, phase }));
  }, []);
  const open = useCallback(() => {
    setHeld((at) => (at.key === null || at.phase !== 'CLOSED' ? at : { ...at, phase: 'PEEK' }));
  }, []);
  const back = useCallback(() => {
    const at = present.current;
    if (at.key === null || at.phase === 'CLOSED') return false;
    const to: SheetPhase = at.phase === 'EXPANDED' ? 'PEEK' : 'CLOSED';
    present.current = { ...at, phase: to };
    setHeld((now) => (now.key === at.key ? { ...now, phase: to } : now));
    return true;
  }, []);

  return { phase: followed.phase, settle, open, back };
}
