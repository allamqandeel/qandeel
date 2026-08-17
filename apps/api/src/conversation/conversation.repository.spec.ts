import { ConversationRepository } from './conversation.repository';
import { SupabaseDataApiService } from './supabase-data-api.service';

describe('ConversationRepository context history', () => {
  it('loads only a bounded authoritative history under the caller user/session scope', async () => {
    const dataApi = { request: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<SupabaseDataApiService>;
    const repository = new ConversationRepository(dataApi);

    await repository.findRecentAuthoritativeTurns('caller-token', 'session-a', 'user-a', 'source-a', 8);

    expect(dataApi.request).toHaveBeenCalledTimes(1);
    const [token, path] = dataApi.request.mock.calls[0];
    expect(token).toBe('caller-token');
    const query = new URL(`https://local/${path}`).searchParams;
    expect(query.get('session_id')).toBe('eq.session-a');
    expect(query.get('user_id')).toBe('eq.user-a');
    expect(query.get('id')).toBe('neq.source-a');
    expect(query.get('status')).toBe('eq.COMPLETED');
    expect(query.get('role')).toBe('in.(USER,ASSISTANT)');
    expect(query.get('or')).toBe('(role.eq.USER,source_turn_id.not.is.null)');
    expect(query.get('order')).toBe('created_at.desc,id.desc');
    expect(query.get('limit')).toBe('8');
  });
});
