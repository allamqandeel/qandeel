import { HimRepository } from './him.repository';

describe('HimRepository current reads',()=>{
  it('uses the supersession-aware view only for conversation-scoped Energy',async()=>{
    const dataApi={request:jest.fn().mockResolvedValue([])};
    const repository=new HimRepository(dataApi as never);
    await repository.getLatest('token','user','hse.energy','CONVERSATION_SESSION','session');
    expect(dataApi.request.mock.calls[0][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hse.motivation','GOAL','00000000-0000-4000-8000-000000000010');
    expect(dataApi.request.mock.calls[1][1]).toMatch(/^him_current_structured_measurements\?/);
    await repository.getLatest('token','user','hse.stress','SITUATION','situation');
    expect(dataApi.request.mock.calls[2][1]).toMatch(/^him_metric_snapshots\?/);
  });
});

