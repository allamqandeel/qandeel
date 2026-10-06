/**
 * S4-03 (E2E-G-18) — the reader's OWN words in Shared Worlds they no longer belong to, for ONE runtime generation: the
 * OWN_MATERIAL_CONTROL of CW2-03 §24 / C21, reached through General Settings → «الخصوصية والبيانات» / Privacy & Data and
 * never through the World. It holds only the reader's own words and their instant (and the opaque World identity the
 * owner deletion needs): no surrounding material, member, Name, topic, count or World state is ever read here, and nothing
 * here opens a World or restores membership.
 *
 *   - read on the page's opening, then one bounded older page at a time on the reader's request;
 *   - deletion reuses the owner's deletion authority (S4-02's ungated privacy mutation), ONE command per material until
 *     the server answers it, and the list is read again afterwards — never edited optimistically;
 *   - one act at a time: a second act while one is in flight is refused;
 *   - material authority survives membership (CW2-03 §24; 0119): a history package that needs the reader's approval of
 *     their OWN earlier words is shown here — exactly those words, no grantee and nothing of the World — and approving
 *     it (ONE command per package until answered) brings the reader back into nothing.
 */
import type {
  SharedDeleteResult, SharedFormerHistoryRequest, SharedFormerHistoryResult, SharedHistoryApproveResult, SharedMaterialCursor, SharedOwnMaterial,
  SharedOwnMaterialResult,
} from '../runtime-entry';

export interface FormerSharedMaterialTransport {
  ownMaterial(before?: SharedMaterialCursor | null): Promise<SharedOwnMaterialResult>;
  deleteOwnMaterial(worldId: string, materialId: string, commandId: string): Promise<SharedDeleteResult>;
  formerHistoryRequests(): Promise<SharedFormerHistoryResult>;
  approveFormerHistoryShare(worldId: string, packageId: string, commandId: string): Promise<SharedHistoryApproveResult>;
}

export type FormerSharedMaterialNotice = 'DELETED' | 'DELETE_FAILED' | 'LOAD_FAILED' | 'APPROVED' | 'GRANTED' | 'STALE' | 'APPROVE_FAILED' | null;

export interface FormerSharedMaterialState {
  readonly status: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
  /** Newest first, as the server returned them. */
  readonly materials: readonly SharedOwnMaterial[];
  readonly hasOlder: boolean;
  readonly loadingOlder: boolean;
  readonly deleting: string | null;
  /** The packages waiting on the reader's surviving material authority (own words only). */
  readonly requests: readonly SharedFormerHistoryRequest[];
  readonly approving: string | null;
  readonly notice: FormerSharedMaterialNotice;
}

export interface FormerSharedMaterialController {
  getState(): FormerSharedMaterialState;
  subscribe(listener: () => void): () => void;
  /** The page opened: read the newest page. */
  open(): void;
  loadOlder(): void;
  deleteMaterial(materialId: string): Promise<void>;
  /** Approve sharing the reader's own words in one package of a World they left. */
  approveRequest(packageId: string): Promise<void>;
  retire(): void;
}

export interface FormerSharedMaterialControllerOptions {
  readonly transport: FormerSharedMaterialTransport;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

const IDLE: FormerSharedMaterialState = Object.freeze<FormerSharedMaterialState>({
  status: 'IDLE', materials: [], hasOlder: false, loadingOlder: false, deleting: null, requests: [], approving: null, notice: null,
});

/** A v4-shaped command identity. */
function mintCommandId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) => Array.from({ length: n }, hex).join('');
  return `${block(8)}-${block(4)}-4${block(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${block(3)}-${block(12)}`;
}

export function createFormerSharedMaterialController({ transport, isCurrent, newCommandId = mintCommandId }: FormerSharedMaterialControllerOptions): FormerSharedMaterialController {
  let state: FormerSharedMaterialState = IDLE;
  let retired = false;
  let read = 0;
  const commands = new Map<string, string>();
  const approvals = new Map<string, string>();
  let requestRead = 0;
  const listeners = new Set<() => void>();
  const publish = (next: FormerSharedMaterialState) => {
    if (retired || !isCurrent()) return;
    state = next;
    for (const listener of Array.from(listeners)) listener();
  };

  async function readNewest(): Promise<void> {
    const ticket = ++read;
    publish({ ...state, status: state.status === 'READY' ? 'READY' : 'LOADING' });
    const result = await transport.ownMaterial(null);
    if (ticket !== read) return;
    if (result.kind === 'READ') publish({ ...state, status: 'READY', materials: result.materials, hasOlder: result.hasOlder, loadingOlder: false });
    else publish({ ...state, status: state.status === 'READY' ? 'READY' : 'UNAVAILABLE', notice: 'LOAD_FAILED' });
  }

  async function readRequests(): Promise<void> {
    const ticket = ++requestRead;
    const result = await transport.formerHistoryRequests();
    if (ticket !== requestRead) return;
    // An unanswered read keeps what is held: nothing is guessed, and the page is read again on the next opening.
    if (result.kind === 'READ') publish({ ...state, requests: result.requests });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open() {
      publish({ ...state, notice: null });
      void readNewest();
      void readRequests();
    },
    loadOlder() {
      const oldest = state.materials[state.materials.length - 1];
      if (state.status !== 'READY' || !state.hasOlder || state.loadingOlder || oldest === undefined) return;
      const ticket = ++read;
      publish({ ...state, loadingOlder: true });
      void transport.ownMaterial({ materialId: oldest.materialId, establishedAt: oldest.establishedAt }).then((result) => {
        if (ticket !== read) return;
        if (result.kind !== 'READ') {
          publish({ ...state, loadingOlder: false });
          return;
        }
        const held = new Set(state.materials.map((m) => m.materialId));
        publish({ ...state, loadingOlder: false, hasOlder: result.hasOlder, materials: [...state.materials, ...result.materials.filter((m) => !held.has(m.materialId))] });
      });
    },
    async deleteMaterial(materialId) {
      const own = state.materials.find((m) => m.materialId === materialId);
      if (own === undefined || state.deleting !== null) return;
      const commandId = commands.get(materialId) ?? newCommandId();
      commands.set(materialId, commandId);
      publish({ ...state, deleting: materialId, notice: null });
      const result = await transport.deleteOwnMaterial(own.worldId, materialId, commandId);
      if (result.kind !== 'UNAVAILABLE') commands.delete(materialId);
      publish({ ...state, deleting: null, notice: result.kind === 'DELETED' ? 'DELETED' : 'DELETE_FAILED' });
      await readNewest();
    },
    async approveRequest(packageId) {
      const request = state.requests.find((r) => r.packageId === packageId);
      if (request === undefined || request.approvedBySelf || state.approving !== null) return;
      const commandId = approvals.get(packageId) ?? newCommandId();
      approvals.set(packageId, commandId);
      publish({ ...state, approving: packageId, notice: null });
      const result = await transport.approveFormerHistoryShare(request.worldId, packageId, commandId);
      if (result.kind !== 'UNAVAILABLE') approvals.delete(packageId);
      publish({ ...state, approving: null,
        notice: result.kind === 'APPROVED' || result.kind === 'GRANTED' || result.kind === 'STALE' ? result.kind : 'APPROVE_FAILED' });
      await readRequests();
    },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
