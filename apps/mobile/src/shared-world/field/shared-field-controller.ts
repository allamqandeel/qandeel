/**
 * SHARED-VIS-01 — the Shared World's Living Analysis field: the viewer-local state of ONE open Shared World as a World.
 *
 * What it holds is the Shared World's own and nothing else: the places the server served for the reader in the exact open
 * World, that World's camera (the ONE semantic-field camera policy, `./shared-field-camera`), the one focused place and
 * its contextual panel. It reads and writes nothing of the Personal world (no Session, store, camera, focus, Thread or
 * time) and nothing of the Public field, so entering a Shared World inherits nothing and leaving it overwrites nothing
 * (CW2-07 §5, §21, §47).
 *
 * Each World keeps its own anchor — its camera (anchor, scale, FAR / MID / NEAR) and its focused place — so that coming
 * back to the SAME World (from its conversation, its Manage World, the Shared root or another area) returns the reader
 * where they were in it. World A's anchor is never World B's. Restoration follows CW2-07 §43, in order: the World's
 * authority is resolved by the Shared area BEFORE `open` is called; the field is then read fresh; only then is the anchor
 * restored, and a focus whose place the server no longer serves is dropped — never shown as a ghost (§44). A World the
 * reader left, was removed from or can no longer enter has its anchor forgotten.
 *
 * Nothing here is authority, and no cache is a source of display: every open, every return to the foreground and every
 * explicit revalidation reads again; an answer for another World, or for an earlier open of the same World, is dropped
 * (the World identity and the read tickets); a denial is handed to the Shared area, which owns what the reader sees next.
 *
 * Back is local: it releases the focused place (back to MID) before anything else, and at the field's own root it does
 * nothing, so the Shared area decides (I-08A4 §4).
 */
import { envelopeCenter, projectAddress, visibleFootprint, type SemanticZoomDirection, type ViewportEnvelope } from '../../map/camera';
import type { ForegroundSignal, SharedFieldEntry, SharedFieldPlace, SharedFieldResult, SharedPlaceResult } from '../../runtime-entry';
import { focusField, nearestTo, panField, wholeWorldCamera, zoomField, type SharedFieldCamera } from './shared-field-camera';

export interface SharedFieldTransport {
  field(worldId: string): Promise<SharedFieldResult>;
  place(worldId: string, placeId: string): Promise<SharedPlaceResult>;
}

export type SharedFieldPanelState =
  | { readonly status: 'LOADING' }
  | { readonly status: 'SERVED'; readonly place: SharedFieldPlace }
  | { readonly status: 'ABSENT' }
  | { readonly status: 'UNAVAILABLE' };

export interface SharedFieldState {
  /** The World this field belongs to; null when no World is open. */
  readonly worldId: string | null;
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  /** Every place the latest read served for this World. */
  readonly entries: readonly SharedFieldEntry[];
  readonly camera: SharedFieldCamera | null;
  /** The focused place (NEAR) and its panel, or null. */
  readonly focus: { readonly id: string; readonly panel: SharedFieldPanelState } | null;
}

/** What one act on the Shared camera did. The shared world view reads only whether it was `APPLIED`. */
export interface SharedFieldOutcome {
  readonly outcome: 'APPLIED' | 'NO_MOVEMENT' | 'AT_BOUNDARY' | 'BEYOND_CANONICAL_BOUND' | 'INVALID_INPUT' | 'NOT_READY';
}

export interface SharedFieldController {
  getState(): SharedFieldState;
  subscribe(listener: () => void): () => void;
  /** Open the field of ONE World whose entry verdict is ALLOW now: read it fresh, then restore that World's own anchor. */
  open(worldId: string): void;
  /** Leave the open World's field: keep its anchor for a later return, and hold nothing on screen. */
  close(): void;
  /** Forget a World's anchor (it is no longer the reader's to return to). Closes it when it is the open one. */
  forget(worldId: string): void;
  setEnvelope(envelope: ViewportEnvelope): void;
  /** One completed drag (the shared world view's ONE drag). */
  pan(translationX: number, translationY: number): SharedFieldOutcome;
  /** One Semantic Zoom step: IN is FAR → MID → NEAR (NEAR focuses the place nearest the centre); OUT releases focus. */
  step(direction: SemanticZoomDirection): SharedFieldOutcome;
  /** A tap on the field at FAR: discloses that part of the World at MID. */
  tapField(x: number, y: number): void;
  /** Focus one place the field showed: the camera lands on it at NEAR and its panel is read. */
  focus(placeId: string): void;
  /** Ask the server again for everything on display (the field and the focused panel), keeping the camera. */
  revalidate(): void;
  /** Local Back. True when it did something inside the field; false at the field's root. */
  back(): boolean;
  retire(): void;
}

export interface SharedFieldControllerOptions {
  readonly transport: SharedFieldTransport | null;
  readonly isCurrent: () => boolean;
  readonly foreground?: ForegroundSignal;
  /** The exact World's authority was lost: the Shared area decides what the reader sees next. */
  readonly onDenied?: (worldId: string) => void;
}

interface Anchor { readonly camera: SharedFieldCamera; readonly focusId: string | null }

const CLOSED: SharedFieldState = Object.freeze({ worldId: null, status: 'IDLE', entries: [], camera: null, focus: null });
const APPLIED: SharedFieldOutcome = Object.freeze({ outcome: 'APPLIED' });
const NOT_READY: SharedFieldOutcome = Object.freeze({ outcome: 'NOT_READY' });

export function createSharedFieldController({ transport, isCurrent, foreground, onDenied }: SharedFieldControllerOptions): SharedFieldController {
  const listeners = new Set<() => void>();
  let state: SharedFieldState = CLOSED;
  let envelope: ViewportEnvelope | null = null;
  let retired = false;
  // Every open (of any World) is a new visit; an answer belongs to the visit that asked.
  let visit = 0;
  let panelTicket = 0;
  const anchors = new Map<string, Anchor>();
  const live = () => !retired && isCurrent();
  const publish = (next: Partial<SharedFieldState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of Array.from(listeners)) listener();
  };

  const denied = (worldId: string) => {
    anchors.delete(worldId);
    visit += 1;
    panelTicket += 1;
    publish(CLOSED);
    onDenied?.(worldId);
  };

  async function readPanel(worldId: string, placeId: string): Promise<void> {
    if (!transport) { publish({ focus: { id: placeId, panel: { status: 'UNAVAILABLE' } } }); return; }
    const mine = ++panelTicket;
    const ofVisit = visit;
    const answer = await transport.place(worldId, placeId).catch((): SharedPlaceResult => ({ kind: 'UNAVAILABLE' }));
    if (mine !== panelTicket || ofVisit !== visit || state.worldId !== worldId || state.focus?.id !== placeId) return;
    if (answer.kind === 'DENIED') { denied(worldId); return; }
    if (answer.kind === 'ABSENT') {
      // Not served now: gone from the field at once — no tombstone, no reason.
      publish({ entries: state.entries.filter((entry) => entry.id !== placeId), focus: { id: placeId, panel: { status: 'ABSENT' } } });
      return;
    }
    if (answer.kind !== 'READ') { publish({ focus: { id: placeId, panel: { status: 'UNAVAILABLE' } } }); return; }
    publish({ focus: { id: placeId, panel: { status: 'SERVED', place: answer.place } } });
  }

  /** Read the open World's field; on the first read of a visit, restore the World's own anchor (CW2-07 §43 order). */
  async function readField(worldId: string, restore: boolean): Promise<void> {
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const ofVisit = visit;
    const answer = await transport.field(worldId).catch((): SharedFieldResult => ({ kind: 'UNAVAILABLE' }));
    if (ofVisit !== visit || state.worldId !== worldId) return;
    if (answer.kind === 'DENIED') { denied(worldId); return; }
    if (answer.kind !== 'READ') {
      // The one honest unavailable state, holding nothing that could be shown again.
      panelTicket += 1;
      publish({ status: 'UNAVAILABLE', entries: [], focus: null });
      return;
    }
    const served = new Set(answer.entries.map((entry) => entry.id));
    if (restore) {
      const anchor = anchors.get(worldId);
      const focusId = anchor?.focusId !== null && anchor?.focusId !== undefined && served.has(anchor.focusId) ? anchor.focusId : null;
      // A remembered focus whose place is no longer served is not restored: the camera steps back to MID around it.
      const camera = anchor === undefined ? wholeWorldCamera()
        : focusId === null && anchor.camera.depth === 'NEAR' ? (zoomFieldOrSelf(anchor.camera)) : anchor.camera;
      publish({ status: 'READY', entries: answer.entries, camera, focus: focusId === null ? null : { id: focusId, panel: { status: 'LOADING' } } });
      if (focusId !== null) void readPanel(worldId, focusId);
      return;
    }
    // A revalidation: the field becomes exactly what it served; a focused place no longer served leaves with it.
    const focus = state.focus;
    if (focus !== null && !served.has(focus.id)) {
      panelTicket += 1;
      publish({ entries: answer.entries, focus: { id: focus.id, panel: { status: 'ABSENT' } } });
      return;
    }
    publish({ status: 'READY', entries: answer.entries });
    if (focus !== null) void readPanel(worldId, focus.id);
  }

  const zoomFieldOrSelf = (camera: SharedFieldCamera): SharedFieldCamera => {
    const moved = zoomField(camera, 'OUT');
    return moved.outcome === 'MOVED' ? moved.camera : camera;
  };

  const saveAnchor = () => {
    if (state.worldId !== null && state.camera !== null) {
      anchors.set(state.worldId, { camera: state.camera, focusId: state.focus?.panel.status === 'ABSENT' ? null : state.focus?.id ?? null });
    }
  };

  const focusOn = (placeId: string) => {
    const worldId = state.worldId;
    const target = state.entries.find((entry) => entry.id === placeId);
    if (worldId === null || !target) return;
    publish({ camera: focusField(target.address), focus: { id: placeId, panel: { status: 'LOADING' } } });
    void readPanel(worldId, placeId);
  };

  const releaseFocus = () => {
    panelTicket += 1;
    publish({ focus: null });
  };

  let controller: SharedFieldController | null = null;
  const unsubscribeForeground = foreground?.subscribe((next) => { if (next === 'ACTIVE') controller?.revalidate(); });

  controller = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(worldId) {
      if (state.worldId !== null && state.worldId !== worldId) saveAnchor();
      visit += 1;
      panelTicket += 1;
      publish({ ...CLOSED, worldId, status: 'LOADING' });
      void readField(worldId, true);
    },
    close() {
      saveAnchor();
      visit += 1;
      panelTicket += 1;
      publish(CLOSED);
    },
    forget(worldId) {
      anchors.delete(worldId);
      if (state.worldId === worldId) {
        visit += 1;
        panelTicket += 1;
        publish(CLOSED);
      }
    },
    setEnvelope(next) {
      envelope = next;
    },
    pan(translationX, translationY) {
      if (!state.camera || state.status !== 'READY') return NOT_READY;
      const moved = panField(state.camera, translationX, translationY);
      if (moved.outcome !== 'MOVED') return { outcome: moved.outcome };
      publish({ camera: moved.camera });
      return APPLIED;
    },
    step(direction) {
      const camera = state.camera;
      if (!camera || state.status !== 'READY' || envelope === null) return NOT_READY;
      if (direction === 'IN' && camera.depth === 'MID') {
        // NEAR is focus: the place nearest the centre of the glass, among those the field shows there.
        const glass = envelope;
        const footprint = visibleFootprint(camera, glass);
        const shown = state.entries.filter((entry) => entry.address.x >= footprint.minX && entry.address.x <= footprint.maxX
          && entry.address.y >= footprint.minY && entry.address.y <= footprint.maxY && projectAddress(camera, glass, entry.address) !== null);
        const nearest = nearestTo(camera.anchor, shown);
        if (nearest === null) return { outcome: 'AT_BOUNDARY' };
        focusOn(nearest);
        return APPLIED;
      }
      const moved = zoomField(camera, direction);
      if (moved.outcome !== 'MOVED') return { outcome: moved.outcome };
      if (camera.depth === 'NEAR') releaseFocus();
      publish({ camera: moved.camera });
      return APPLIED;
    },
    tapField(x, y) {
      const camera = state.camera;
      if (!camera || camera.depth !== 'FAR' || envelope === null) return;
      const center = envelopeCenter(envelope);
      const recentred = panField(camera, center.x - x, center.y - y);
      const base = recentred.outcome === 'MOVED' ? recentred.camera : camera;
      const moved = zoomField(base, 'IN');
      if (moved.outcome === 'MOVED') publish({ camera: moved.camera });
    },
    focus(placeId) {
      focusOn(placeId);
    },
    revalidate() {
      const worldId = state.worldId;
      if (worldId === null || state.status === 'LOADING') return;
      if (state.status === 'UNAVAILABLE' || state.camera === null) {
        visit += 1;
        publish({ ...CLOSED, worldId, status: 'LOADING' });
        void readField(worldId, true);
        return;
      }
      void readField(worldId, false);
    },
    back() {
      if (state.focus === null) return false;
      releaseFocus();
      const camera = state.camera;
      if (camera && camera.depth === 'NEAR') {
        const moved = zoomField(camera, 'OUT');
        if (moved.outcome === 'MOVED') publish({ camera: moved.camera });
      }
      return true;
    },
    retire() {
      retired = true;
      unsubscribeForeground?.();
      listeners.clear();
      anchors.clear();
    },
  };
  return controller;
}
