/**
 * S7-02 — test doubles for the Replay entry: a Replay transport whose every answer the test decides, a conversation
 * source, and committed-unit events built the way the frozen T-03A2 coordinator commits them (one batch per turn's
 * commitment, positions dense from 1, the reader's turn before QANDEEL's reply).
 */
import type { ConversationalUnitsCommittedWireEvent } from '@qandeel/runtime';
import { CONVERSATIONAL_UNITS_COMMITTED } from '../../temporal';

import type {
  CommittedEventsResult,
  ConversationExchangeView,
  ReplayCapabilityResult,
  ReplayCommandResult,
  ReplayDraftView,
  ReplayListResult,
  ReplayRange,
  ReplayReadResult,
  TemporalHeadResult,
} from '../../runtime-entry';
import type { ReplayConversationSource, ReplayEntryTransport } from '../replay-entry-controller';

export const SESSION = '11111111-1111-4111-8111-111111111111';
export const OTHER_SESSION = '22222222-2222-4222-8222-222222222222';
export const REPLAY_ID = '33333333-3333-4333-8333-333333333333';

/** One committed-unit batch of one turn. */
export function turnEvent(turnId: string, firstSp: number, lastSp: number, sessionId = SESSION): ConversationalUnitsCommittedWireEvent {
  return {
    type: CONVERSATIONAL_UNITS_COMMITTED,
    version: 1,
    sessionId,
    batchId: `batch-${firstSp}-${lastSp}`,
    sourceTurnId: turnId,
    firstSp,
    lastSp,
    unitCount: lastSp - firstSp + 1,
  };
}

/**
 * The committed events of a conversation: each exchange's own turn, then its reply when it completed. A turn's size is
 * `units(turnId)` (default 2). `skip` names turns that have no committed units (an exchange whose reply failed).
 */
export function timeline(
  exchanges: readonly ConversationExchangeView[],
  options: { readonly units?: (turnId: string) => number; readonly skip?: ReadonlySet<string>; readonly from?: number } = {},
): ConversationalUnitsCommittedWireEvent[] {
  const units = options.units ?? (() => 2);
  const events: ConversationalUnitsCommittedWireEvent[] = [];
  let next = options.from ?? 1;
  const add = (id: string) => {
    if (options.skip?.has(id)) return;
    const n = units(id);
    events.push(turnEvent(id, next, next + n - 1));
    next += n;
  };
  for (const exchange of exchanges) {
    add(exchange.userTurn.id);
    if (exchange.reply !== null) add(exchange.reply.id);
  }
  return events;
}

export const headOf = (events: readonly ConversationalUnitsCommittedWireEvent[]): number | null =>
  events.length === 0 ? null : events[events.length - 1].lastSp;

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export interface CommandCall {
  readonly kind: 'CREATE' | 'REVISE';
  readonly commandId: string;
  readonly sessionId?: string;
  readonly replayId?: string;
  readonly expectedDraftRevision?: number;
  readonly range: ReplayRange;
  answer(result: ReplayCommandResult): void;
}

export interface FakeReplayTransport extends ReplayEntryTransport {
  /** What the server holds: the committed events and the Live Head (reads answer from these immediately). */
  events: ConversationalUnitsCommittedWireEvent[];
  head: number | null;
  capabilityAnswer: ReplayCapabilityResult;
  listAnswer: ReplayListResult;
  readAnswer: ReplayReadResult;
  eventsAvailable: boolean;
  /** Called once after the events are read and before the head is read (a commit landing in between). */
  betweenEventsAndHead: (() => void) | null;
  readonly commands: CommandCall[];
  readonly calls: string[];
}

export function fakeReplayTransport(initial: { events?: ConversationalUnitsCommittedWireEvent[]; open?: boolean } = {}): FakeReplayTransport {
  const commands: CommandCall[] = [];
  const calls: string[] = [];
  const command = (call: Omit<CommandCall, 'answer'>): Promise<ReplayCommandResult> => {
    const answer = deferred<ReplayCommandResult>();
    commands.push({ ...call, answer: answer.resolve });
    return answer.promise;
  };
  const events = initial.events ?? [];
  const fake: FakeReplayTransport = {
    events,
    head: headOf(events),
    capabilityAnswer: { kind: 'READ', creationAvailable: initial.open ?? true },
    listAnswer: { kind: 'READ', replays: [] },
    readAnswer: { kind: 'NOT_FOUND' },
    eventsAvailable: true,
    betweenEventsAndHead: null,
    commands,
    calls,
    async capability() {
      calls.push('capability');
      return fake.capabilityAnswer;
    },
    async conversationReplays(sessionId) {
      calls.push(`list:${sessionId}`);
      return fake.listAnswer;
    },
    async replay(replayId) {
      calls.push(`read:${replayId}`);
      return fake.readAnswer;
    },
    createDraft(commandId, sessionId, range) {
      calls.push(`create:${commandId}`);
      return command({ kind: 'CREATE', commandId, sessionId, range });
    },
    reviseDraft(commandId, replayId, expectedDraftRevision, range) {
      calls.push(`revise:${commandId}`);
      return command({ kind: 'REVISE', commandId, replayId, expectedDraftRevision, range });
    },
    async liveHead(sessionId): Promise<TemporalHeadResult> {
      calls.push(`head:${sessionId}`);
      return { kind: 'READ', liveHead: fake.head };
    },
    async committedEvents(sessionId, afterSp): Promise<CommittedEventsResult> {
      calls.push(`events:${afterSp ?? 0}`);
      if (!fake.eventsAvailable) return { kind: 'UNAVAILABLE' };
      const page = fake.events.filter((e) => e.firstSp > (afterSp ?? 0)).slice(0, 256);
      const between = fake.betweenEventsAndHead;
      if (between !== null) {
        fake.betweenEventsAndHead = null;
        between();
      }
      return { kind: 'READ', events: page };
    },
  };
  return fake;
}

export interface FakeConversation extends ReplayConversationSource {
  set(exchanges: readonly ConversationExchangeView[]): void;
}

export function fakeConversation(exchanges: readonly ConversationExchangeView[]): FakeConversation {
  let state = { exchanges };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      state = { exchanges: next };
      for (const listener of Array.from(listeners)) listener();
    },
  };
}

export function draftView(overrides: Partial<ReplayDraftView> = {}): ReplayDraftView {
  return { replayId: REPLAY_ID, lifecycle: 'DRAFT', revision: 2, coverage: 'SELECTED_EXCERPT', firstTc: 3, lastTc: 6, sourceState: 'CURRENT', currentVersion: null, ...overrides };
}

/** Let every queued promise continuation run. */
export const flush = async (): Promise<void> => {
  for (let index = 0; index < 30; index += 1) await Promise.resolve();
};
