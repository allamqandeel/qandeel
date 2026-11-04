import { ConversationRepository } from './conversation.repository';
import { ConversationService } from './conversation.service';
import type { ConversationSession, ConversationTurn } from './conversation.types';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { ConversationSemanticEstablishmentService } from '../live-focus/conversation-semantic-establishment.service';
import { CorrelationService } from '../observability/correlation.service';
import { SupabaseServiceRoleApiService } from './supabase-service-role-api.service';
import { VoiceNotesRepository } from '../voice-media/voice-notes.repository';

// S8B-06 CP3 R3 (the Product Owner's CP3 Review R1 decision, option A; migration 0193) — the history page carries the
// Session's finished calls from the server's durable call record, additively: a call's length survives a restart of the
// phone, and a call that left no committed turn still has its record. The instants and the end reason are the server's.
// Every finished call is on exactly one page: the page's window is [its oldest user turn, the cursor), each end open when
// there is no older page or no cursor. migration 0193's verifier proves the read itself (ENDED after ACTIVE only, the
// person and the Session, the window, no client role).

const SESSION_ID = '4f1c9a52-7c1e-4d4b-9a51-8c2d1e3f4a50';
const USER_ID = 'owner-a';
const TOKEN = 'caller-token';
const session: ConversationSession = {
  id: SESSION_ID, status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now', last_activity_at: 'now', closed_at: null,
};

let sequence = 0;
function turn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    session_id: SESSION_ID, role: 'USER', status: 'COMPLETED', content: `words ${sequence}`,
    processing_path: 'FAST', routing_reason: 'RUNTIME_ROUTING_V2_FAST_DEFAULT', source_turn_id: null,
    idempotency_key: `key-${sequence}`, created_at: `2026-11-04T10:00:${String(sequence).padStart(2, '0')}.000000+00:00`,
    updated_at: 'now', completed_at: 'now', ...overrides,
  };
}
const row = (id: string, started: string, ended: string, reason = 'USER_ENDED') =>
  ({ call_id: id, started_at: started, ended_at: ended, end_reason: reason });

describe('ConversationService.listTurns — the finished calls of the Session (S8B-06 CP3 R3, 0193)', () => {
  let repository: jest.Mocked<ConversationRepository>;
  let voiceNotes: { sessionVoiceTurns: jest.Mock; callReplyDelivery: jest.Mock; sessionFinishedCalls: jest.Mock };
  let service: ConversationService;

  beforeEach(() => {
    sequence = 0;
    repository = {
      findSession: jest.fn().mockResolvedValue(session),
      findTurn: jest.fn(),
      findUserTurnsPage: jest.fn().mockResolvedValue([]),
      findCompletedAssistantsForSources: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ConversationRepository>;
    voiceNotes = {
      sessionVoiceTurns: jest.fn().mockResolvedValue([]),
      callReplyDelivery: jest.fn().mockResolvedValue([]),
      sessionFinishedCalls: jest.fn().mockResolvedValue([]),
    };
    const semantic = { establish: jest.fn() } as unknown as jest.Mocked<ConversationSemanticEstablishmentService>;
    service = new ConversationService(repository, { orchestrate: jest.fn() } as unknown as ConversationOrchestratorService,
      new CorrelationService(), semantic, {} as never, voiceNotes as unknown as VoiceNotesRepository);
  });

  it('a Session whose only call left no turn still carries its record: the server\'s instants and end reason', async () => {
    voiceNotes.sessionFinishedCalls.mockResolvedValue([row('call-1', '2026-11-04T10:00:00.250000+00:00', '2026-11-04T10:01:05.750000+00:00', 'PEER_LOST_AFTER_GRACE')]);
    const page = await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});
    expect(page).toEqual({
      exchanges: [], hasOlder: false,
      calls: [{ callId: 'call-1', startedAt: '2026-11-04T10:00:00.250Z', endedAt: '2026-11-04T10:01:05.750Z', endReason: 'PEER_LOST_AFTER_GRACE' }],
    });
    // The newest (and only) page: both ends open. The caller's own identity, never one from the query.
    expect(voiceNotes.sessionFinishedCalls).toHaveBeenCalledWith(USER_ID, SESSION_ID, null, null);
  });

  it('the calls come oldest to newest by their end, beside the exchanges, which are unchanged', async () => {
    const turns = [turn(), turn()];
    repository.findUserTurnsPage.mockResolvedValue([...turns].reverse());
    // The read answers the newest first (0193); the page orders them like its exchanges.
    voiceNotes.sessionFinishedCalls.mockResolvedValue([
      row('call-new', '2026-11-04T10:05:00Z', '2026-11-04T10:06:00Z', 'SERVER_ENDED'),
      row('call-old', '2026-11-04T09:00:00Z', '2026-11-04T09:10:00Z'),
    ]);
    const page = await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});
    expect(page.calls?.map((c) => [c.callId, c.endReason])).toEqual([['call-old', 'USER_ENDED'], ['call-new', 'SERVER_ENDED']]);
    expect(page.exchanges.map((e) => e.userTurn.id)).toEqual([turns[0].id, turns[1].id]);
  });

  it('a page with no finished call carries no calls field: the page an older phone reads is the same as before', async () => {
    repository.findUserTurnsPage.mockResolvedValue([turn()]);
    const page = await service.listTurns(USER_ID, TOKEN, SESSION_ID, {});
    expect(Object.keys(page).sort()).toEqual(['exchanges', 'hasOlder']);
  });

  it('every finished call is on exactly one page: [the page\'s oldest user turn, the cursor), each end open at the edges', async () => {
    const turns = [turn(), turn(), turn()];
    repository.findUserTurnsPage.mockResolvedValue([...turns].reverse());
    await service.listTurns(USER_ID, TOKEN, SESSION_ID, { limit: '2' });
    // The newest page has an older one: its window starts at its own oldest turn, and is open at the newest end.
    expect(voiceNotes.sessionFinishedCalls).toHaveBeenLastCalledWith(USER_ID, SESSION_ID, turns[1].created_at, null);
    repository.findTurn.mockResolvedValue(turns[1]);
    repository.findUserTurnsPage.mockResolvedValue([turns[0]]);
    await service.listTurns(USER_ID, TOKEN, SESSION_ID, { limit: '2', before: turns[1].id });
    // The oldest page: open at its old end, and it stops where the newer page began (the cursor's own instant).
    expect(voiceNotes.sessionFinishedCalls).toHaveBeenLastCalledWith(USER_ID, SESSION_ID, null, turns[1].created_at);
  });

  it('without the voice repository (an instance without voice) the page is exactly the text page', async () => {
    const text = new ConversationService(repository, { orchestrate: jest.fn() } as unknown as ConversationOrchestratorService,
      new CorrelationService(), { establish: jest.fn() } as never, {} as never);
    await expect(text.listTurns(USER_ID, TOKEN, SESSION_ID, {})).resolves.toEqual({ exchanges: [], hasOlder: false });
  });

  it('a Session the caller does not own reads no call at all', async () => {
    repository.findSession.mockResolvedValue(undefined);
    await expect(service.listTurns(USER_ID, TOKEN, SESSION_ID, {})).rejects.toThrow();
    expect(voiceNotes.sessionFinishedCalls).not.toHaveBeenCalled();
  });
});

describe('VoiceNotesRepository.sessionFinishedCalls — the one 0193 read', () => {
  it('calls server_read_session_finished_calls_v1 with the person, the Session and the window, and nothing else', async () => {
    const rpc = jest.fn().mockResolvedValue([row('call-1', 'a', 'b')]);
    const repo = new VoiceNotesRepository({ rpc } as unknown as SupabaseServiceRoleApiService);
    await expect(repo.sessionFinishedCalls('owner-a', SESSION_ID, null, '2026-11-04T10:00:00Z')).resolves.toEqual([row('call-1', 'a', 'b')]);
    expect(rpc).toHaveBeenCalledWith('server_read_session_finished_calls_v1',
      { p_user_id: 'owner-a', p_session_id: SESSION_ID, p_ended_from: null, p_ended_before: '2026-11-04T10:00:00Z' });
  });
});
