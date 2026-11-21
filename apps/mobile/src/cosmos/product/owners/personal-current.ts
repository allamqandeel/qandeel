/**
 * COSMOS E-2 corrections, Slice C (the Product Owner's D-5, Option U, 2026-11-20) — the CURRENT Personal World as a
 * COSMOS owner: the Threads the person has NOW (migration 0199), each at its ONE canonical Home, named as the wire names
 * it (the person's alias, else the grounding wording of their own words, else nothing).
 *
 * It is the field owner the Shared and Public worlds already use, over a LOCAL field camera (FAR / MID / NEAR): the
 * Session-bound Personal owner, its kernel camera, its semantic depths, its timeline and T-04's inspection are untouched.
 * Nothing here writes the T-02 kernel or dispatches a Product action; a focused Thread is reported to the host, which
 * shows the PEEK (name, "Open where it began", "Name this topic"). No Reading, Emerging Focus, Live Focus or lifecycle
 * state is drawn: those are Session-anchored and belong to the Thread's own conversation.
 */
import type { CurrentPersonalThread } from '@qandeel/runtime';

import { analysisCopy, type AnalysisLanguage } from '../../../analysis-language';
import type { CurrentPersonalWorldController } from '../../../conversation/current-personal-world-controller';
import { envelopeCenter, unprojectPoint, type ViewportEnvelope } from '../../../map/camera';
import { canonicalWorldAddress, type CanonicalWorldAddress } from '../../../map/world';
import { focusField, nearestTo, panField, wholeWorldCamera, zoomField, type PublicFieldCamera } from '../../../public-world/field/public-field-camera';
import { ORIGIN, createFieldOwner, emitter, memo, type CosmosWorldOwner } from '../owner-core';
import { toFarX, toFarY } from '../../core/adapters';
import { compileStage, dyeOfId, type Entity, type Stage } from '../../core/stage';

export interface CurrentPersonalCosmosOwnerOptions {
  readonly world: CurrentPersonalWorldController;
  readonly language: AnalysisLanguage;
  /** The focused Thread (its id), or null when the focus is released. The host decides what to show. */
  readonly onFocus?: (threadId: string | null) => void;
}

export const CURRENT_THREAD_MARK_PREFIX = 'THREAD:';
export const currentThreadMarkId = (threadId: string): string => `${CURRENT_THREAD_MARK_PREFIX}${threadId}`;
export function currentThreadIdOf(markId: string): string | null {
  return markId.startsWith(CURRENT_THREAD_MARK_PREFIX) ? markId.slice(CURRENT_THREAD_MARK_PREFIX.length) : null;
}

interface CurrentEntry { readonly id: string; readonly threadId: string; readonly address: CanonicalWorldAddress; readonly thread: CurrentPersonalThread }

/** The served Home as a canonical address; a Home outside the canonical bound cannot be drawn and its Thread is left out. */
const addressOf = (thread: CurrentPersonalThread): CanonicalWorldAddress | null => {
  const decoded = canonicalWorldAddress(BigInt(thread.home.x), BigInt(thread.home.y));
  return decoded.ok ? decoded.address : null;
};
const entriesOf = (threads: readonly CurrentPersonalThread[]): CurrentEntry[] =>
  threads.flatMap((thread) => {
    const address = addressOf(thread);
    return address === null ? [] : [{ id: currentThreadMarkId(thread.id), threadId: thread.id, address, thread }];
  });

export function createCurrentPersonalCosmosOwner({ world, language, onFocus }: CurrentPersonalCosmosOwnerOptions): CosmosWorldOwner {
  const copy = analysisCopy(language);
  const rtl = language === 'ar';
  const changes = emitter();
  let envelope: ViewportEnvelope | null = null;
  let camera: PublicFieldCamera | null = null;
  let focusId: string | null = null;
  let lastThreads: readonly CurrentPersonalThread[] | null = null;
  let entries: CurrentEntry[] = [];

  const sync = () => {
    const state = world.getState();
    if (state.threads !== lastThreads) {
      lastThreads = state.threads;
      entries = entriesOf(state.threads);
      // A focused Thread the world no longer serves releases its focus: nothing is shown that does not exist.
      if (focusId !== null && !entries.some((entry) => entry.id === focusId)) { focusId = null; onFocus?.(null); }
    }
    if (state.status === 'READY' && camera === null) camera = wholeWorldCamera();
    if (state.status !== 'READY' && state.status !== 'LOADING') camera = null;
  };
  const publish = () => { changes.emit(); };
  const unsubscribe = world.subscribe(() => { sync(); publish(); });
  sync();

  const compiled = memo<readonly unknown[], Stage>(() => {
    const entities: Entity[] = entries.map((entry) => ({
      id: entry.id, kind: 'THREAD', x: toFarX(ORIGIN, entry.address), y: toFarY(ORIGIN, entry.address), dye: dyeOfId(entry.threadId),
      label: entry.thread.name.text, fromRung: 0,
    }));
    return compileStage({ world: 'PERSONAL', rungs: 3, entities, focusId, rtl });
  });

  const focusOn = (id: string) => {
    const target = entries.find((entry) => entry.id === id);
    if (target === undefined) return;
    camera = focusField(target.address);
    focusId = id;
    onFocus?.(target.threadId);
    publish();
  };
  const releaseFocus = () => {
    if (focusId === null) return;
    focusId = null;
    onFocus?.(null);
  };

  const owner = createFieldOwner({
    world: 'PERSONAL',
    read: () => {
      const state = world.getState();
      const status = state.status === 'READY' ? 'READY' : state.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : state.status === 'LOADING' ? 'LOADING' : 'IDLE';
      return { status, entries, camera: status === 'READY' ? camera : null, focusId };
    },
    subscribe: (listener) => changes.subscribe(listener),
    setEnvelope: (next) => { envelope = next; },
    pan: (tx, ty) => {
      if (camera === null) return { outcome: 'NOT_READY' };
      const moved = panField(camera, tx, ty);
      if (moved.outcome !== 'MOVED') return { outcome: moved.outcome };
      camera = moved.camera;
      publish();
      return { outcome: 'APPLIED' };
    },
    step: (direction, focal) => {
      if (camera === null || envelope === null) return { outcome: 'NOT_READY' };
      if (direction === 'IN' && camera.depth === 'MID') {
        // The last step in is a focus: the nearest Thread to the fingers (or to the centre) becomes the one shown.
        const at = (focal === null ? null : unprojectPoint(camera, envelope, focal)) ?? camera.anchor;
        const nearest = nearestTo(at, entries);
        if (nearest === null) return { outcome: 'AT_BOUNDARY' };
        focusOn(nearest);
        return { outcome: 'APPLIED' };
      }
      const moved = zoomField(camera, direction, null, focal === null ? null : { envelope, point: focal });
      if (moved.outcome !== 'MOVED') return { outcome: moved.outcome };
      if (camera.depth === 'NEAR') releaseFocus();
      camera = moved.camera;
      publish();
      return { outcome: 'APPLIED' };
    },
    tapField: (x, y) => {
      if (camera === null || camera.depth !== 'FAR' || envelope === null) return;
      const centre = envelopeCenter(envelope);
      const recentred = panField(camera, centre.x - x, centre.y - y);
      const base = recentred.outcome === 'MOVED' ? recentred.camera : camera;
      const moved = zoomField(base, 'IN');
      if (moved.outcome === 'MOVED') { camera = moved.camera; publish(); }
    },
    focus: (id) => focusOn(id),
    back: () => {
      if (focusId === null) return false;
      releaseFocus();
      if (camera !== null && camera.depth === 'NEAR') {
        const moved = zoomField(camera, 'OUT');
        if (moved.outcome === 'MOVED') camera = moved.camera;
      }
      publish();
      return true;
    },
    compile: () => compiled([lastThreads, focusId]),
    // The family word, and the served name when there is one — never an invented one.
    labelOf: (id) => {
      const name = entries.find((entry) => entry.id === id)?.thread.name.text ?? null;
      return name === null ? copy.family.THREAD : `${copy.family.THREAD} · ${name}`;
    },
  }, rtl);

  return {
    ...owner,
    dispose() {
      unsubscribe();
      owner.dispose();
      changes.clear();
    },
  };
}
