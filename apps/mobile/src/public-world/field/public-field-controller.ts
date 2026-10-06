/**
 * S5-03B — the Public semantic field controller: the viewer-local state of «العالم العام» / Public World as a World.
 *
 * What it holds is the Public field's own and nothing else: the Experiences the server served inside the World, the
 * Public camera (`./public-field-camera`), the one focused Experience and its contextual panel, and the search over the
 * same field. It reads and writes nothing of the Personal world (no Session, store, camera, focus, Thread or time) and
 * nothing of the Shared area, so entering Public inherits nothing and leaving it overwrites nothing. Every entry starts
 * again from the World as a whole.
 *
 * Nothing here is authority. Every Experience on the glass was served by the server for this viewer, now; a focused
 * Experience the server no longer serves is removed from the field at once, without a tombstone; a search result is
 * a place in the same field the camera is guided to, never a separate feed. Nothing ranks, counts views, draws a
 * relation or publishes.
 *
 * Back is local: it closes the panel (releasing focus), then the search, before anything else — and at the World's
 * own root nothing is registered, so Back never silently leaves Public World (S5-01).
 */
import type { CanonicalWorldAddress } from '../../map/world';
import type { PublicAuthoringAnswer, PublicFieldEntry, PublicFieldExperience, PublicFieldPanel, PublicFieldRectangle } from '../../runtime-entry';
import {
  PUBLIC_FIELD_MAX_COORD, PUBLIC_FIELD_MIN_COORD, fieldFootprint, fittedCamera, focusField, isFieldSize, nearestTo, panField, projectToField, zoomField,
  type PublicFieldCamera, type PublicFieldSize,
} from './public-field-camera';

export interface PublicFieldTransport {
  field(rectangle: PublicFieldRectangle): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicFieldEntry>>>;
  search(query: string): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicFieldEntry>>>;
  experience(experienceId: string): Promise<PublicAuthoringAnswer<PublicFieldPanel>>;
}

export type PublicFieldPanelState =
  | { readonly status: 'LOADING' }
  | { readonly status: 'SERVED'; readonly experience: PublicFieldExperience }
  | { readonly status: 'ABSENT' }
  | { readonly status: 'UNAVAILABLE' };

export interface PublicFieldSearchState {
  readonly open: boolean;
  readonly status: 'IDLE' | 'SEARCHING' | 'RESULTS' | 'NONE' | 'UNAVAILABLE';
  readonly results: ReadonlyArray<PublicFieldEntry>;
}

export interface PublicFieldState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  /** Every Experience currently served in the field, by id. */
  readonly entries: ReadonlyArray<PublicFieldEntry>;
  readonly camera: PublicFieldCamera | null;
  /** The focused Experience (NEAR) and its panel, or null. */
  readonly focus: { readonly id: string; readonly panel: PublicFieldPanelState } | null;
  readonly search: PublicFieldSearchState;
}

export interface PublicFieldController {
  getState(): PublicFieldState;
  subscribe(listener: () => void): () => void;
  /** Enter the field: the World as a whole, fetched now. Nothing is carried over from a previous visit. */
  enter(): void;
  /** The field's presentation size (Class D). The first one frames the World. */
  setSize(width: number, height: number): void;
  /** One completed drag, in points of content translation. */
  pan(translationX: number, translationY: number): void;
  /** Semantic Zoom in: FAR → MID → NEAR (NEAR focuses the place nearest the centre of the glass). */
  closer(): void;
  /** Semantic Zoom out: NEAR → MID (focus released) → FAR. */
  farther(): void;
  /** Back to the World as a whole, at FAR, nothing focused. */
  wholeWorld(): void;
  /** A tap on the field at a screen point: at FAR it discloses that place at MID. */
  tapField(x: number, y: number): void;
  /** Focus one Experience the field (or search) showed: the camera lands on it at NEAR and the panel opens. */
  focus(experienceId: string): void;
  openSearch(): void;
  search(query: string): void;
  closeSearch(): void;
  /** Local Back. True when it did something inside Public World; false at the root. */
  back(): boolean;
  retire(): void;
}

export interface PublicFieldControllerOptions {
  readonly transport: PublicFieldTransport | null;
  readonly isCurrent: () => boolean;
}

const WHOLE_WORLD: PublicFieldRectangle = Object.freeze({ minX: PUBLIC_FIELD_MIN_COORD, minY: PUBLIC_FIELD_MIN_COORD, maxX: PUBLIC_FIELD_MAX_COORD, maxY: PUBLIC_FIELD_MAX_COORD });
const NO_SEARCH: PublicFieldSearchState = Object.freeze({ open: false, status: 'IDLE', results: [] });
const INITIAL: PublicFieldState = Object.freeze({ status: 'IDLE', entries: [], camera: null, focus: null, search: NO_SEARCH });
export const PUBLIC_SEARCH_QUERY_MAX = 120;

const within = (r: PublicFieldRectangle, a: CanonicalWorldAddress): boolean => a.x >= r.minX && a.x <= r.maxX && a.y >= r.minY && a.y <= r.maxY;

export function createPublicFieldController({ transport, isCurrent }: PublicFieldControllerOptions): PublicFieldController {
  const listeners = new Set<() => void>();
  let state: PublicFieldState = INITIAL;
  let size: PublicFieldSize | null = null;
  let retired = false;
  let visit = 0;
  let searchTicket = 0;
  let panelTicket = 0;
  let viewportTicket = 0;
  const live = () => !retired && isCurrent();
  const publish = (next: Partial<PublicFieldState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of Array.from(listeners)) listener();
  };

  /** Replace what the server served inside a rectangle with exactly what it serves there now; keep the rest. */
  const mergeServed = (rectangle: PublicFieldRectangle, served: ReadonlyArray<PublicFieldEntry>): ReadonlyArray<PublicFieldEntry> => {
    const kept = state.entries.filter((entry) => !within(rectangle, entry.address));
    const byId = new Map<string, PublicFieldEntry>(kept.map((entry) => [entry.id, entry]));
    for (const entry of served) byId.set(entry.id, entry);
    return [...byId.values()];
  };
  const homeCamera = (): PublicFieldCamera | null => (isFieldSize(size) ? fittedCamera(state.entries.map((entry) => entry.address), size) : null);
  const forget = (experienceId: string) => {
    publish({
      entries: state.entries.filter((entry) => entry.id !== experienceId),
      search: { ...state.search, results: state.search.results.filter((entry) => entry.id !== experienceId) },
    });
  };

  async function load(): Promise<void> {
    const mine = ++visit;
    publish({ ...INITIAL, status: 'LOADING' });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const answer = await transport.field(WHOLE_WORLD).catch(() => ({ kind: 'NO_ANSWER' as const }));
    if (mine !== visit) return;
    if (answer.kind !== 'ANSWER') { publish({ status: 'UNAVAILABLE' }); return; }
    publish({ status: 'READY', entries: answer.value,
      camera: isFieldSize(size) ? fittedCamera(answer.value.map((entry) => entry.address), size) : null });
  }

  /** At MID and NEAR, ask the server what it serves exactly inside the glass, so a dense World fills in where the reader is. */
  async function refreshViewport(): Promise<void> {
    if (!transport || !state.camera || state.camera.depth === 'FAR' || !isFieldSize(size)) return;
    const mine = ++viewportTicket;
    const rectangle = fieldFootprint(state.camera, size);
    const answer = await transport.field(rectangle).catch(() => ({ kind: 'NO_ANSWER' as const }));
    if (mine !== viewportTicket || answer.kind !== 'ANSWER') return;
    publish({ entries: mergeServed(rectangle, answer.value) });
  }

  async function openPanel(experienceId: string): Promise<void> {
    const mine = ++panelTicket;
    if (!transport) { publish({ focus: { id: experienceId, panel: { status: 'UNAVAILABLE' } } }); return; }
    const answer = await transport.experience(experienceId).catch(() => ({ kind: 'NO_ANSWER' as const }));
    if (mine !== panelTicket || state.focus?.id !== experienceId) return;
    if (answer.kind !== 'ANSWER') { publish({ focus: { id: experienceId, panel: { status: 'UNAVAILABLE' } } }); return; }
    if (answer.value.kind === 'ABSENT') {
      // No longer served: gone from the field at once — no tombstone, no reason.
      forget(experienceId);
      publish({ focus: { id: experienceId, panel: { status: 'ABSENT' } } });
      return;
    }
    const served = answer.value.experience;
    // The panel's nearby context is served too: let the field show it.
    const known = new Set(state.entries.map((entry) => entry.id));
    publish({
      entries: [...state.entries.filter((entry) => entry.id !== served.entry.id), served.entry, ...served.nearby.filter((near) => !known.has(near.id))],
      focus: { id: experienceId, panel: { status: 'SERVED', experience: served } },
    });
  }

  const setCamera = (camera: PublicFieldCamera) => {
    publish({ camera });
    void refreshViewport();
  };

  const releaseFocus = () => {
    panelTicket += 1;
    publish({ focus: null });
  };

  const focusOn = (experienceId: string) => {
    const target = [...state.entries, ...state.search.results].find((entry) => entry.id === experienceId);
    if (!target || !state.camera) return;
    setCamera(focusField(state.camera, target.address));
    publish({ focus: { id: experienceId, panel: { status: 'LOADING' } } });
    void openPanel(experienceId);
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    enter() {
      panelTicket += 1; searchTicket += 1; viewportTicket += 1;
      void load();
    },
    setSize(width, height) {
      const next = { width, height };
      if (!isFieldSize(next)) return;
      const first = !isFieldSize(size);
      size = next;
      if (first && state.status === 'READY') publish({ camera: homeCamera() });
    },
    pan(translationX, translationY) {
      if (!state.camera) return;
      const moved = panField(state.camera, translationX, translationY);
      if (moved.outcome === 'MOVED') setCamera(moved.camera);
    },
    closer() {
      const camera = state.camera;
      if (!camera || !isFieldSize(size)) return;
      if (camera.depth === 'MID') {
        // NEAR is focus: the place nearest the centre of the glass, among those the field shows there.
        const footprint = fieldFootprint(camera, size);
        const shown = state.entries.filter((entry) => within(footprint, entry.address) && projectToField(camera, size!, entry.address) !== null);
        const nearest = nearestTo(camera.anchor, shown);
        if (nearest !== null) focusOn(nearest);
        return;
      }
      const moved = zoomField(camera, 'IN');
      if (moved.outcome === 'MOVED') setCamera(moved.camera);
    },
    farther() {
      const camera = state.camera;
      if (!camera) return;
      const moved = zoomField(camera, 'OUT');
      if (moved.outcome !== 'MOVED') return;
      if (camera.depth === 'NEAR') releaseFocus();
      setCamera(moved.camera);
    },
    wholeWorld() {
      releaseFocus();
      const home = homeCamera();
      if (home) publish({ camera: home });
    },
    tapField(x, y) {
      const camera = state.camera;
      if (!camera || camera.depth !== 'FAR' || !isFieldSize(size)) return;
      const halfWidth = size.width / 2; const halfHeight = size.height / 2;
      const recentred = panField(camera, halfWidth - x, halfHeight - y);
      const base = recentred.outcome === 'MOVED' ? recentred.camera : camera;
      const moved = zoomField(base, 'IN');
      if (moved.outcome === 'MOVED') setCamera(moved.camera);
    },
    focus(experienceId) {
      focusOn(experienceId);
    },
    openSearch() {
      publish({ search: { ...state.search, open: true } });
    },
    search(query) {
      const q = query.replace(/\s+/gu, ' ').trim();
      if (q.length === 0 || q.length > PUBLIC_SEARCH_QUERY_MAX || !transport) return;
      const mine = ++searchTicket;
      publish({ search: { open: true, status: 'SEARCHING', results: [] } });
      void transport.search(q).catch(() => ({ kind: 'NO_ANSWER' as const })).then((answer) => {
        if (mine !== searchTicket) return;
        if (answer.kind !== 'ANSWER') { publish({ search: { open: true, status: 'UNAVAILABLE', results: [] } }); return; }
        publish({ search: { open: true, status: answer.value.length === 0 ? 'NONE' : 'RESULTS', results: answer.value } });
      });
    },
    closeSearch() {
      searchTicket += 1;
      publish({ search: NO_SEARCH });
    },
    back() {
      if (state.focus !== null) {
        releaseFocus();
        const camera = state.camera;
        if (camera && camera.depth === 'NEAR') {
          const moved = zoomField(camera, 'OUT');
          if (moved.outcome === 'MOVED') setCamera(moved.camera);
        }
        return true;
      }
      if (state.search.open) {
        searchTicket += 1;
        publish({ search: NO_SEARCH });
        return true;
      }
      return false;
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
