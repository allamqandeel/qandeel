/**
 * S5-01 — the «العالم العام» / Public World entry controller: the ONE way into the Public World root, for the Global
 * Switcher and for a `qandeel://public` link alike.
 *
 * Entering asks the server's entry verdict NOW (CW2-07 §25: destination content renders only after the current Public
 * audience policy allows viewing). Until it answers, the area is the neutral pre-authority shell; ALLOW makes the root
 * active; anything else is one neutral "not available". A switcher tap, a link or a previous ALLOW is never authority:
 * every entry resolves again.
 *
 * Its state is viewer-local and its own (CW2-07 §24): it holds nothing of the Personal world (no Session, camera, focus
 * or time) and nothing of the Shared area, and it writes nothing to either. S5-01's root was content-empty by truth;
 * S5-03B gives it the semantic field, through its own Public-only field controller (`./field`), held here and nowhere else.
 */
import type { PublicAuthoringController } from '../public-authoring';
import type { PublicFieldController } from './field/public-field-controller';
import type { PublicEntryResult } from '../runtime-entry';

export interface PublicWorldTransport {
  entry(): Promise<PublicEntryResult>;
}

export interface PublicAreaState {
  readonly entry: 'NONE' | 'RESOLVING' | 'ALLOW' | 'DENIED';
}

export interface PublicWorldController {
  getState(): PublicAreaState;
  subscribe(listener: () => void): () => void;
  /** Resolve the entry verdict now (the switcher, a link, a retry). */
  enter(): void;
  /** S5-02 — the authoring workspace drawn inside the Public World root; null where the host provides none. */
  readonly authoring: PublicAuthoringController | null;
  /** S5-03B — the Public semantic field; null where the host provides none (the root then stays content-empty). */
  readonly field: PublicFieldController | null;
  retire(): void;
}

export interface PublicWorldControllerOptions {
  readonly transport: PublicWorldTransport;
  readonly isCurrent: () => boolean;
  readonly authoring?: PublicAuthoringController | null;
  readonly field?: PublicFieldController | null;
}

const INITIAL: PublicAreaState = Object.freeze<PublicAreaState>({ entry: 'NONE' });

export function createPublicWorldController({ transport, isCurrent, authoring = null, field = null }: PublicWorldControllerOptions): PublicWorldController {
  const listeners = new Set<() => void>();
  let state: PublicAreaState = INITIAL;
  let retired = false;
  let ticket = 0;
  const live = () => !retired && isCurrent();
  const publish = (next: PublicAreaState) => {
    if (!live()) return;
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  async function resolve(): Promise<void> {
    const mine = ++ticket;
    publish({ entry: 'RESOLVING' });
    let result: PublicEntryResult;
    try {
      result = await transport.entry();
    } catch {
      result = { kind: 'UNAVAILABLE' };
    }
    if (mine !== ticket) return;
    publish({ entry: result.kind === 'ALLOW' ? 'ALLOW' : 'DENIED' });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    enter() {
      void resolve();
    },
    authoring,
    field,
    retire() {
      retired = true;
      listeners.clear();
      authoring?.retire();
      field?.retire();
    },
  };
}
