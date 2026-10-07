/**
 * S5-02 — the Public authoring controller: the controlled publication workspace inside «العالم العام» / Public World.
 *
 *   WORKSPACE  the reader's own non-public Drafts, and the requests that wait on THEIR content approval
 *   CHOOSE     choose existing QANDEEL material for one Draft — never free text: a Public Experience originates in QANDEEL
 *   REVIEW     exactly what would become public, the CURRENT public display, bounded approval progress, the reader's own
 *              approval, and DRAFT → READY_FOR_REVIEW when every current approval is effective
 *
 * Nothing here is authority: every screen asks the server again, and every act is decided by the database from the
 * reader's own token. A package that is no longer whole is one explicit stale state and is never drawn partially. The
 * lifecycle ends at READY_FOR_REVIEW, which is not public: no state here can say "published".
 *
 * S5-03A adds the semantic stage to REVIEW, once the Experience is READY_FOR_REVIEW: QANDEEL's proposed understanding
 * (meaning, main and other meanings, why), the publisher's acceptance of exactly the revision seen, or their correction
 * of the MEANING in their own words — never a place, a neighbour or a rank. The lifecycle stays READY_FOR_REVIEW.
 *
 * S5-03B adds, once that understanding is ready, the stable place: whether QANDEEL has prepared the Experience's place
 * in the Public field, and the request to prepare it. The reader can never choose, see or move the place itself.
 *
 * S5-03C adds explicit relations, managed here and nowhere else (no second destination, no graph screen):
 *
 *   WORKSPACE  also the reader's own Experiences that are in Public World now, and the relation requests that wait on
 *              THEIR acceptance (accept / decline)
 *   RELATIONS  one own served Experience: its current relations (remove), its own waiting requests (cancel), requests
 *              received for it (accept / decline), and asking for a relation to another Experience found by the SAME
 *              Public search. A relation exists only once the other side accepts it; nothing here suggests one.
 *
 * Every relation state is re-read from the server after every act and on every screen: nothing is kept to be shown again.
 *
 * Its state is viewer-local and its own: nothing of the Personal world or the Shared area is held or written.
 */
import type {
  PublicAuthoringAnswer, PublicApprovalRequest, PublicApproveOutcome, PublicAuthoringDraft, PublicAuthoringReview, PublicAuthoringSources,
  PublicPackageOutcome, PublicReadyOutcome, PublicSemanticAcceptOutcome, PublicSemanticCorrectionInput, PublicSemanticCorrectionOutcome,
  PublicSemanticProposalOutcome, PublicSemanticReview, PublicSpatialPreparation, PublicSpatialPrepareOutcome, PublicWithdrawOutcome,
  PublicFieldEntry, PublicRelation, PublicRelationAct, PublicRelationActOutcome, PublicRelationExperience, PublicRelationRequestOutcome,
  PublicRelations,
} from '../runtime-entry';

export interface PublicAuthoringTransport {
  drafts(): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicAuthoringDraft>>>;
  sources(): Promise<PublicAuthoringAnswer<PublicAuthoringSources>>;
  startDraft(commandId: string): Promise<PublicAuthoringAnswer<{ readonly outcome: 'CREATED' | 'ALREADY_CREATED'; readonly experienceId: string }>>;
  preparePackage(experienceId: string, commandId: string, personal: readonly string[],
    shared: ReadonlyArray<{ readonly worldId: string; readonly materialId: string }>): Promise<PublicAuthoringAnswer<PublicPackageOutcome>>;
  review(experienceId: string): Promise<PublicAuthoringAnswer<PublicAuthoringReview>>;
  approvalRequests(): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicApprovalRequest>>>;
  approve(manifestId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicApproveOutcome>>;
  withdraw(manifestId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicWithdrawOutcome>>;
  ready(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicReadyOutcome>>;
}

/** S5-03A — the semantic review of a READY_FOR_REVIEW Experience (the same Public authoring client implements it). */
export interface PublicSemanticTransport {
  semanticReview(experienceId: string): Promise<PublicAuthoringAnswer<PublicSemanticReview>>;
  proposeSemantic(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicSemanticProposalOutcome>>;
  acceptSemantic(experienceId: string, commandId: string, interpretationId: string): Promise<PublicAuthoringAnswer<PublicSemanticAcceptOutcome>>;
  correctSemantic(experienceId: string, commandId: string, interpretationId: string,
    correction: PublicSemanticCorrectionInput): Promise<PublicAuthoringAnswer<PublicSemanticCorrectionOutcome>>;
}

/** S5-03B — preparing the stable place of a semantically ready Experience (the same Public client implements it). */
export interface PublicSpatialTransport {
  preparation(experienceId: string): Promise<PublicAuthoringAnswer<PublicSpatialPreparation>>;
  prepare(experienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicSpatialPrepareOutcome>>;
}

/** S5-03C — explicit relations of the reader's own served Experiences (the same Public client implements it). */
export interface PublicRelationTransport {
  relations(): Promise<PublicAuthoringAnswer<PublicRelations>>;
  request(experienceId: string, otherExperienceId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicRelationRequestOutcome>>;
  act(act: PublicRelationAct, relationId: string, commandId: string): Promise<PublicAuthoringAnswer<PublicRelationActOutcome>>;
}

/** S5-03C — finding the other Experience: the SAME Public field search (S5-03B), nothing of its own. */
export interface PublicRelationSearchTransport {
  search(query: string): Promise<PublicAuthoringAnswer<ReadonlyArray<PublicFieldEntry>>>;
}

export interface PublicRelationSearchState {
  readonly status: 'IDLE' | 'SEARCHING' | 'RESULTS' | 'NONE' | 'UNAVAILABLE';
  readonly results: ReadonlyArray<PublicFieldEntry>;
}

export type PublicAuthoringScreen = 'CLOSED' | 'WORKSPACE' | 'CHOOSE' | 'REVIEW' | 'RELATIONS';
export type PublicAuthoringNotice = 'NONE' | 'ACTION_UNAVAILABLE' | 'NOT_PUBLISHABLE' | 'APPROVALS_INCOMPLETE' | 'APPROVED' | 'WITHDRAWN'
  // S5-03A
  | 'INTERPRETATION_UNAVAILABLE' | 'NOT_SUPPORTED' | 'UNCHANGED' | 'CORRECTION_INVALID' | 'LIMITED'
  // S5-03B
  | 'PLACE_UNAVAILABLE';

export interface PublicAuthoringState {
  readonly screen: PublicAuthoringScreen;
  /** Whether the current screen's data has arrived: LOADING until it has, UNAVAILABLE if it could not. */
  readonly status: 'LOADING' | 'READY' | 'UNAVAILABLE';
  readonly drafts: ReadonlyArray<PublicAuthoringDraft>;
  readonly requests: ReadonlyArray<PublicApprovalRequest>;
  readonly sources: PublicAuthoringSources | null;
  /** Selected sources, by key: `P:<unit>` or `S:<world>:<material>`. */
  readonly selected: ReadonlyArray<string>;
  readonly experienceId: string | null;
  readonly review: PublicAuthoringReview | null;
  /** S5-03A: QANDEEL's understanding of the reviewed Experience — only once it is READY_FOR_REVIEW. */
  readonly semantic: PublicSemanticReview | null;
  /** S5-03A: the correction form is open. */
  readonly correcting: boolean;
  /** S5-03B: whether the stable place exists — only once the understanding is ready; never where it is. */
  readonly place: PublicSpatialPreparation | null;
  /** S5-03C: the reader's own Experiences in Public World now — exactly what the server served on the last read. */
  readonly relationExperiences: ReadonlyArray<PublicRelationExperience>;
  /** S5-03C: every current relation from the reader's side — exactly what the server served on the last read. */
  readonly relations: ReadonlyArray<PublicRelation>;
  /** S5-03C: the search for another Experience to relate to, on the RELATIONS screen. */
  readonly relationSearch: PublicRelationSearchState;
  readonly busy: boolean;
  readonly notice: PublicAuthoringNotice;
}

export interface PublicAuthoringController {
  getState(): PublicAuthoringState;
  subscribe(listener: () => void): () => void;
  open(): void;
  close(): void;
  back(): void;
  /** Ask the current screen's data again. */
  refresh(): void;
  startDraft(): void;
  openDraft(experienceId: string): void;
  toggle(key: string): void;
  prepare(): void;
  approve(manifestId: string): void;
  withdraw(manifestId: string): void;
  markReady(): void;
  /** S5-03A: ask QANDEEL to propose its understanding of the reviewed Experience. */
  requestUnderstanding(): void;
  /** S5-03A: accept exactly the understanding shown. */
  acceptUnderstanding(): void;
  openCorrection(): void;
  cancelCorrection(): void;
  /** S5-03A: correct the meaning — a line of meaning, and comma-separated main and other meanings. */
  submitCorrection(meaning: string, primaryThemes: string, secondaryThemes: string): void;
  /** S5-03B: ask QANDEEL to prepare the Experience's stable place in the Public field, from its meaning alone. */
  preparePlace(): void;
  /** S5-03C: open the relations of one of the reader's own served Experiences. */
  openRelations(experienceId: string): void;
  /** S5-03C: search the Public World for the other Experience (the same search as the field). */
  searchRelation(query: string): void;
  /** S5-03C: ask for a relation from the open Experience to one the search found. */
  requestRelation(otherExperienceId: string): void;
  /** S5-03C: the four acts, each allowed by the server only to its side. */
  acceptRelation(relationId: string): void;
  declineRelation(relationId: string): void;
  cancelRelation(relationId: string): void;
  removeRelation(relationId: string): void;
  retire(): void;
}

export interface PublicAuthoringControllerOptions {
  readonly transport: PublicAuthoringTransport | null;
  /** S5-03A: the semantic review transport; without it the semantic stage is not drawn. */
  readonly semantic?: PublicSemanticTransport | null;
  /** S5-03B: the place-preparation transport; without it the place stage is not drawn. */
  readonly spatial?: PublicSpatialTransport | null;
  /** S5-03C: the relation transport; without it no relation is drawn or asked for. */
  readonly relation?: PublicRelationTransport | null;
  /** S5-03C: the Public field search, to find the other Experience. */
  readonly relationSearch?: PublicRelationSearchTransport | null;
  readonly isCurrent: () => boolean;
  readonly newCommandId?: () => string;
}

/** One package: the 0143 bound (1–20 exact sources). */
export const PUBLIC_PACKAGE_MAX_SOURCES = 20;

export const personalKey = (sourceId: string): string => `P:${sourceId}`;
export const sharedKey = (worldId: string, materialId: string): string => `S:${worldId}:${materialId}`;

/** S5-03C: the search query bound — exactly the field search's. */
export const PUBLIC_RELATION_SEARCH_MAX = 120;

/** S5-03A: the semantic bounds — exactly the server's (one line of meaning ≤ 120; 1–3 main and 0–3 other meanings ≤ 40). */
export const SEMANTIC_MEANING_MAX = 120;
export const SEMANTIC_THEME_MAX = 40;
const IDENTIFIER = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const oneLine = (text: string): string => text.replace(/\s+/gu, ' ').trim();

/** The publisher's words, normalized; null when they cannot be a correction. Themes are separated by a comma (, or ،). */
export function semanticCorrectionOf(meaning: string, primaryThemes: string, secondaryThemes: string): PublicSemanticCorrectionInput | null {
  const line = oneLine(meaning);
  const themes = (text: string) => text.split(/[,،]/u).map(oneLine).filter((theme) => theme.length > 0);
  const primary = themes(primaryThemes);
  const secondary = themes(secondaryThemes);
  const all = [...primary, ...secondary];
  const valid = (text: string, max: number) => text.length >= 1 && text.length <= max && !IDENTIFIER.test(text);
  if (!valid(line, SEMANTIC_MEANING_MAX) || primary.length < 1 || primary.length > 3 || secondary.length > 3
    || !all.every((theme) => valid(theme, SEMANTIC_THEME_MAX)) || new Set(all.map((theme) => theme.toLowerCase())).size !== all.length) return null;
  return { meaning: line, primaryThemes: primary, secondaryThemes: secondary };
}

export function mintPublicCommandId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) => Array.from({ length: n }, hex).join('');
  return `${block(8)}-${block(4)}-4${block(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${block(3)}-${block(12)}`;
}

const NO_RELATION_SEARCH: PublicRelationSearchState = Object.freeze({ status: 'IDLE', results: [] });
const CLOSED: PublicAuthoringState = Object.freeze<PublicAuthoringState>({
  screen: 'CLOSED', status: 'READY', drafts: [], requests: [], sources: null, selected: [], experienceId: null, review: null,
  semantic: null, correcting: false, place: null, relationExperiences: [], relations: [], relationSearch: NO_RELATION_SEARCH,
  busy: false, notice: 'NONE',
});
const DONE: Readonly<Record<PublicRelationAct, PublicRelationActOutcome>> = Object.freeze({
  accept: 'ACCEPTED', decline: 'DECLINED', cancel: 'CANCELLED', remove: 'REMOVED',
});

export function createPublicAuthoringController({
  transport, semantic = null, spatial = null, relation = null, relationSearch = null, isCurrent, newCommandId = mintPublicCommandId,
}: PublicAuthoringControllerOptions): PublicAuthoringController {
  const listeners = new Set<() => void>();
  let state: PublicAuthoringState = CLOSED;
  let retired = false;
  let ticket = 0;
  let searchTicket = 0;
  // One command per act and target until a definite answer: a retry after a lost answer is the SAME command.
  const commands = new Map<string, string>();
  const commandFor = (act: string) => {
    const existing = commands.get(act);
    if (existing) return existing;
    const fresh = newCommandId();
    commands.set(act, fresh);
    return fresh;
  };
  const settle = (act: string) => { commands.delete(act); };

  const live = () => !retired && isCurrent();
  const publish = (next: Partial<PublicAuthoringState>) => {
    if (!live()) return;
    state = Object.freeze({ ...state, ...next });
    for (const listener of Array.from(listeners)) listener();
  };

  /** S5-03C: the relation truth now, or nothing — a read that could not be made never leaves an older answer showing. */
  async function readRelations(): Promise<PublicRelations | null> {
    if (!relation) return { experiences: [], relations: [] };
    const answer = await relation.relations().catch(() => ({ kind: 'NO_ANSWER' as const }));
    return answer.kind === 'ANSWER' ? answer.value : null;
  }

  async function loadWorkspace(): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'WORKSPACE', status: 'LOADING', experienceId: null, review: null, semantic: null, correcting: false, place: null, sources: null, selected: [],
      relationExperiences: [], relations: [], relationSearch: NO_RELATION_SEARCH });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const [drafts, requests, relations] = await Promise.all([transport.drafts(), transport.approvalRequests(), readRelations()]);
    if (mine !== ticket) return;
    if (drafts.kind !== 'ANSWER' || requests.kind !== 'ANSWER') { publish({ status: 'UNAVAILABLE' }); return; }
    // A relation read that failed shows no relation section (fail closed) and leaves the rest of the workspace usable.
    publish({ status: 'READY', drafts: drafts.value, requests: requests.value,
      relationExperiences: relations?.experiences ?? [], relations: relations?.relations ?? [] });
  }

  /** S5-03C: one own served Experience's relations, re-read now. It must still be one the server serves. */
  async function loadRelations(experienceId: string): Promise<void> {
    const mine = ++ticket;
    searchTicket += 1;
    publish({ screen: 'RELATIONS', status: 'LOADING', experienceId, review: null, semantic: null, correcting: false, place: null, sources: null, selected: [],
      relationSearch: NO_RELATION_SEARCH });
    if (!relation) { publish({ status: 'UNAVAILABLE' }); return; }
    const relations = await readRelations();
    if (mine !== ticket) return;
    if (relations === null || !relations.experiences.some((e) => e.id === experienceId)) {
      publish({ status: 'UNAVAILABLE', relationExperiences: relations?.experiences ?? [], relations: relations?.relations ?? [] });
      return;
    }
    publish({ status: 'READY', relationExperiences: relations.experiences, relations: relations.relations });
  }

  async function loadSources(experienceId: string): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'CHOOSE', status: 'LOADING', experienceId, review: null, semantic: null, correcting: false, place: null, selected: [] });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const sources = await transport.sources();
    if (mine !== ticket) return;
    if (sources.kind !== 'ANSWER') { publish({ status: 'UNAVAILABLE' }); return; }
    publish({ status: 'READY', sources: sources.value });
  }

  async function loadReview(experienceId: string): Promise<void> {
    const mine = ++ticket;
    publish({ screen: 'REVIEW', status: 'LOADING', experienceId });
    if (!transport) { publish({ status: 'UNAVAILABLE' }); return; }
    const review = await transport.review(experienceId);
    if (mine !== ticket) return;
    if (review.kind !== 'ANSWER') { publish({ status: 'UNAVAILABLE' }); return; }
    // A Draft that has no package yet goes straight to choosing its material.
    if (review.value.state === 'NO_PACKAGE' && review.value.lifecycle === 'DRAFT') { await loadSources(experienceId); return; }
    // S5-03A: the semantic stage exists only for a whole package that is READY_FOR_REVIEW.
    let understanding: PublicSemanticReview | null = null;
    if (semantic && review.value.state === 'CURRENT' && review.value.lifecycle === 'READY_FOR_REVIEW') {
      const answer = await semantic.semanticReview(experienceId);
      if (mine !== ticket) return;
      understanding = answer.kind === 'ANSWER' ? answer.value : { state: 'UNAVAILABLE', ready: false };
    }
    // S5-03B: the place stage exists only once the understanding of this exact version is ready.
    let place: PublicSpatialPreparation | null = null;
    if (spatial && understanding !== null && understanding.ready) {
      const answer = await spatial.preparation(experienceId);
      if (mine !== ticket) return;
      place = answer.kind === 'ANSWER' ? answer.value : 'UNAVAILABLE';
    }
    publish({ status: 'READY', review: review.value, semantic: understanding, place });
  }

  async function act(work: () => Promise<void>): Promise<void> {
    if (state.busy || !transport) return;
    publish({ busy: true, notice: 'NONE' });
    try {
      await work();
    } finally {
      publish({ busy: false });
    }
  }

  const reloadCurrent = () => {
    if (state.screen === 'RELATIONS' && state.experienceId) return loadRelations(state.experienceId);
    if (state.screen === 'REVIEW' && state.experienceId) return loadReview(state.experienceId);
    if (state.screen === 'CHOOSE' && state.experienceId) return loadSources(state.experienceId);
    return loadWorkspace();
  };

  /** S5-03C: one act on a relation the reader can see now; the server decides whether their side may make it. */
  function relationAct(kind: PublicRelationAct, relationId: string): void {
    if ((state.screen !== 'WORKSPACE' && state.screen !== 'RELATIONS') || !relation || !state.relations.some((r) => r.relationId === relationId)) return;
    const transportOfRelations = relation;
    void act(async () => {
      const key = `RELATION_${kind}:${relationId}`;
      const answer = await transportOfRelations.act(kind, relationId, commandFor(key));
      if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
      settle(key);
      await reloadCurrent();
      publish({ notice: answer.value === DONE[kind] ? 'NONE' : 'ACTION_UNAVAILABLE' });
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open() { void loadWorkspace(); },
    close() { ticket += 1; publish({ ...CLOSED }); },
    back() {
      if (state.screen === 'WORKSPACE') { ticket += 1; publish({ ...CLOSED }); return; }
      void loadWorkspace();
    },
    refresh() { void reloadCurrent(); },
    startDraft() {
      void act(async () => {
        const key = 'START';
        const answer = await transport!.startDraft(commandFor(key));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        await loadSources(answer.value.experienceId);
      });
    },
    openDraft(experienceId) { void loadReview(experienceId); },
    toggle(key) {
      if (state.screen !== 'CHOOSE' || state.busy) return;
      const has = state.selected.includes(key);
      if (!has && state.selected.length >= PUBLIC_PACKAGE_MAX_SOURCES) return;
      publish({ selected: has ? state.selected.filter((k) => k !== key) : [...state.selected, key], notice: 'NONE' });
    },
    prepare() {
      const experienceId = state.experienceId;
      if (state.screen !== 'CHOOSE' || !experienceId || state.selected.length === 0) return;
      const selected = [...state.selected];
      void act(async () => {
        const personal = selected.filter((k) => k.startsWith('P:')).map((k) => k.slice(2));
        const shared = selected.filter((k) => k.startsWith('S:')).map((k) => {
          const [, worldId, materialId] = k.split(':');
          return { worldId, materialId };
        });
        const key = `PREPARE:${experienceId}:${selected.slice().sort().join(',')}`;
        const answer = await transport!.preparePackage(experienceId, commandFor(key), personal, shared);
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        switch (answer.value) {
          case 'PREPARED':
          case 'ALREADY_PREPARED':
          case 'NOT_DRAFT':
            await loadReview(experienceId);
            return;
          case 'NOT_PUBLISHABLE':
            publish({ notice: 'NOT_PUBLISHABLE' });
            return;
          default:
            // UNAVAILABLE / STALE: what was chosen is no longer there to choose. Ask again.
            await loadSources(experienceId);
            publish({ notice: 'ACTION_UNAVAILABLE' });
        }
      });
    },
    approve(manifestId) {
      void act(async () => {
        const key = `APPROVE:${manifestId}`;
        const answer = await transport!.approve(manifestId, commandFor(key));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        await reloadCurrent();
        publish({ notice: answer.value === 'APPROVED' ? 'APPROVED' : answer.value === 'ALREADY_DECIDED' ? 'NONE' : 'ACTION_UNAVAILABLE' });
      });
    },
    withdraw(manifestId) {
      void act(async () => {
        const key = `WITHDRAW:${manifestId}`;
        const answer = await transport!.withdraw(manifestId, commandFor(key));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        await reloadCurrent();
        publish({ notice: answer.value === 'UNAVAILABLE' ? 'ACTION_UNAVAILABLE' : 'WITHDRAWN' });
      });
    },
    markReady() {
      const experienceId = state.experienceId;
      if (state.screen !== 'REVIEW' || !experienceId) return;
      void act(async () => {
        const key = `READY:${experienceId}`;
        const answer = await transport!.ready(experienceId, commandFor(key));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        await loadReview(experienceId);
        publish({
          notice: answer.value === 'READY_FOR_REVIEW' || answer.value === 'ALREADY_READY' ? 'NONE'
            : answer.value === 'APPROVALS_INCOMPLETE' ? 'APPROVALS_INCOMPLETE' : 'ACTION_UNAVAILABLE',
        });
      });
    },
    requestUnderstanding() {
      const experienceId = state.experienceId;
      if (state.screen !== 'REVIEW' || !experienceId || !semantic || state.semantic?.state !== 'NO_PROPOSAL') return;
      void act(async () => {
        const key = `SEMANTIC_PROPOSE:${experienceId}`;
        const answer = await semantic.proposeSemantic(experienceId, commandFor(key));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        // An interpretation QANDEEL could not produce keeps the SAME command: a retry resumes the same request.
        if (answer.value !== 'INTERPRETATION_UNAVAILABLE') settle(key);
        await loadReview(experienceId);
        publish({
          notice: answer.value === 'PROPOSED' || answer.value === 'ALREADY_INTERPRETED' ? 'NONE'
            : answer.value === 'INTERPRETATION_UNAVAILABLE' ? 'INTERPRETATION_UNAVAILABLE' : answer.value === 'LIMITED' ? 'LIMITED' : 'ACTION_UNAVAILABLE',
        });
      });
    },
    acceptUnderstanding() {
      const experienceId = state.experienceId;
      const understanding = state.semantic;
      if (state.screen !== 'REVIEW' || !experienceId || !semantic || understanding?.state !== 'AWAITING_REVIEW') return;
      void act(async () => {
        const key = `SEMANTIC_ACCEPT:${understanding.interpretationId}`;
        const answer = await semantic.acceptSemantic(experienceId, commandFor(key), understanding.interpretationId);
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        await loadReview(experienceId);
        publish({ notice: answer.value === 'ACCEPTED' || answer.value === 'ALREADY_ACCEPTED' || answer.value === 'ALREADY_REVIEWED' ? 'NONE' : 'ACTION_UNAVAILABLE' });
      });
    },
    openCorrection() {
      const understanding = state.semantic;
      if (state.busy || (understanding?.state !== 'AWAITING_REVIEW' && understanding?.state !== 'REVIEWED')) return;
      publish({ correcting: true, notice: 'NONE' });
    },
    cancelCorrection() {
      if (state.busy) return;
      publish({ correcting: false, notice: 'NONE' });
    },
    submitCorrection(meaning, primaryThemes, secondaryThemes) {
      const experienceId = state.experienceId;
      const understanding = state.semantic;
      if (state.screen !== 'REVIEW' || !experienceId || !semantic || !state.correcting
        || (understanding?.state !== 'AWAITING_REVIEW' && understanding?.state !== 'REVIEWED')) return;
      const correction = semanticCorrectionOf(meaning, primaryThemes, secondaryThemes);
      if (correction === null) { publish({ notice: 'CORRECTION_INVALID' }); return; }
      void act(async () => {
        const key = `SEMANTIC_CORRECT:${understanding.interpretationId}:${correction.meaning}|${correction.primaryThemes.join(',')}|${correction.secondaryThemes.join(',')}`;
        const answer = await semantic.correctSemantic(experienceId, commandFor(key), understanding.interpretationId, correction);
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        if (answer.value !== 'INTERPRETATION_UNAVAILABLE') settle(key);
        switch (answer.value) {
          case 'CORRECTED':
            await loadReview(experienceId);
            publish({ correcting: false, notice: 'NONE' });
            return;
          case 'NOT_SUPPORTED': case 'UNCHANGED': case 'INTERPRETATION_UNAVAILABLE': case 'LIMITED':
            // The form stays open with the publisher's words: they can rephrase.
            publish({ notice: answer.value });
            return;
          default:
            // STALE / UNAVAILABLE / NO_PROPOSAL / NOT_READY_FOR_REVIEW: what was corrected is no longer current. Ask again.
            await loadReview(experienceId);
            publish({ correcting: false, notice: 'ACTION_UNAVAILABLE' });
        }
      });
    },
    preparePlace() {
      const experienceId = state.experienceId;
      if (state.screen !== 'REVIEW' || !experienceId || !spatial || state.place !== 'NOT_PLACED') return;
      void act(async () => {
        const key = `PLACE:${experienceId}`;
        const answer = await spatial.prepare(experienceId, commandFor(key));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        // A place QANDEEL could not prepare keeps the SAME command: a retry resumes the same request.
        if (answer.value !== 'PLACEMENT_UNAVAILABLE') settle(key);
        await loadReview(experienceId);
        publish({
          notice: answer.value === 'PLACED' || answer.value === 'ALREADY_PLACED' ? 'NONE'
            : answer.value === 'PLACEMENT_UNAVAILABLE' ? 'PLACE_UNAVAILABLE' : 'ACTION_UNAVAILABLE',
        });
      });
    },
    openRelations(experienceId) { if (relation) void loadRelations(experienceId); },
    searchRelation(query) {
      const experienceId = state.experienceId;
      const q = oneLine(query);
      if (state.screen !== 'RELATIONS' || !experienceId || !relationSearch || q.length === 0 || q.length > PUBLIC_RELATION_SEARCH_MAX) return;
      const mine = ++searchTicket;
      publish({ relationSearch: { status: 'SEARCHING', results: [] }, notice: 'NONE' });
      void relationSearch.search(q).catch(() => ({ kind: 'NO_ANSWER' as const })).then((answer) => {
        if (mine !== searchTicket || state.screen !== 'RELATIONS' || state.experienceId !== experienceId) return;
        if (answer.kind !== 'ANSWER') { publish({ relationSearch: { status: 'UNAVAILABLE', results: [] } }); return; }
        // The open Experience cannot be related to itself; everything else the search served may be asked for.
        const results = answer.value.filter((entry) => entry.id !== experienceId);
        publish({ relationSearch: { status: results.length === 0 ? 'NONE' : 'RESULTS', results } });
      });
    },
    requestRelation(otherExperienceId) {
      const experienceId = state.experienceId;
      if (state.screen !== 'RELATIONS' || !experienceId || !relation || !state.relationSearch.results.some((entry) => entry.id === otherExperienceId)) return;
      const transportOfRelations = relation;
      void act(async () => {
        const key = `RELATION_REQUEST:${experienceId}:${otherExperienceId}`;
        const answer = await transportOfRelations.request(experienceId, otherExperienceId, commandFor(key));
        if (answer.kind !== 'ANSWER') { publish({ notice: 'ACTION_UNAVAILABLE' }); return; }
        settle(key);
        await loadRelations(experienceId);
        publish({ notice: answer.value === 'UNAVAILABLE' ? 'ACTION_UNAVAILABLE' : 'NONE' });
      });
    },
    acceptRelation(relationId) { relationAct('accept', relationId); },
    declineRelation(relationId) { relationAct('decline', relationId); },
    cancelRelation(relationId) { relationAct('cancel', relationId); },
    removeRelation(relationId) { relationAct('remove', relationId); },
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
