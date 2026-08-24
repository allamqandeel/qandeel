import type { PostResponseIntelligenceDispatcherService } from './post-response-intelligence-dispatcher.service';
import { PostResponseIntelligenceConsumerService } from './post-response-intelligence-consumer.service';
import type { PostResponseRedisConsumer } from './post-response-intelligence.types';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('PostResponseIntelligenceConsumerService', () => {
  const setup = () => {
    let rejectBlockedRead: ((reason?: unknown) => void) | undefined;
    const redis = {
      enabled: true,
      connect: jest.fn().mockResolvedValue(undefined),
      read: jest.fn().mockImplementation(() => new Promise((_resolve, reject) => { rejectBlockedRead = reject; })),
      reclaim: jest.fn().mockResolvedValue([]),
      ack: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockImplementation(async () => { const reject = rejectBlockedRead; rejectBlockedRead = undefined; reject?.(new Error('connection closed')); }),
    } as unknown as jest.Mocked<PostResponseRedisConsumer>;
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<PostResponseIntelligenceDispatcherService>;
    const service = new PostResponseIntelligenceConsumerService(redis, dispatcher);
    return {
      redis, dispatcher, service,
      cycle: () => (service as unknown as { cycle(): Promise<void> }).cycle(),
      run: () => (service as unknown as { run(): Promise<void> }).run(),
    };
  };

  beforeEach(() => { jest.useFakeTimers(); process.env.POST_RESPONSE_REDIS_RETRY_MS = '100'; });
  afterEach(() => { jest.useRealTimers(); delete process.env.POST_RESPONSE_REDIS_RETRY_MS; });

  it('recovers from initial connect failure and later processes work', async () => {
    const s = setup();
    s.redis.connect.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined);
    s.redis.read.mockResolvedValueOnce([{ id: 'new', envelope: 'new' }]);
    const run = s.run();
    await flush();
    expect(s.redis.connect).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    await flush();
    expect(s.redis.connect).toHaveBeenCalledTimes(2);
    expect(s.dispatcher.dispatch).toHaveBeenCalledWith('new');
    await s.service.onModuleDestroy();
    await run;
  });

  it('recovers from one reclaim failure and continues future cycles', async () => {
    const s = setup();
    s.redis.reclaim.mockRejectedValueOnce(new Error('transient')).mockResolvedValue([]);
    s.redis.read.mockResolvedValueOnce([{ id: 'after-reconnect', envelope: 'after-reconnect' }]);
    const run = s.run();
    await flush();
    expect(s.redis.connect).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    await flush();
    expect(s.redis.connect).toHaveBeenCalledTimes(2);
    expect(s.dispatcher.dispatch).toHaveBeenCalledWith('after-reconnect');
    await s.service.onModuleDestroy();
    await run;
  });

  it('uses one bounded timer instead of a busy reconnect loop', async () => {
    const s = setup();
    s.redis.connect.mockRejectedValue(new Error('unavailable'));
    const run = s.run();
    await flush();
    expect(s.redis.connect).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(99);
    expect(s.redis.connect).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await flush();
    expect(s.redis.connect).toHaveBeenCalledTimes(2);
    await s.service.onModuleDestroy();
    await run;
  });

  it('interrupts retry delay and closes cleanly on shutdown', async () => {
    const s = setup();
    s.redis.connect.mockRejectedValue(new Error('unavailable'));
    const run = s.run();
    await flush();
    await s.service.onModuleDestroy();
    await expect(run).resolves.toBeUndefined();
    expect(s.redis.connect).toHaveBeenCalledTimes(1);
    expect(s.redis.close).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reclaims pending work before new work and ACKs only terminal handling', async () => {
    const s = setup();
    s.redis.reclaim.mockResolvedValueOnce([{ id: 'pending', envelope: 'pending' }]);
    s.redis.read.mockResolvedValueOnce([{ id: 'new', envelope: 'new' }]);
    await s.cycle();
    expect(s.dispatcher.dispatch.mock.calls.map(call => call[0])).toEqual(['pending', 'new']);
    expect(s.redis.ack.mock.calls.map(call => call[0])).toEqual(['pending', 'new']);
  });

  it('leaves dispatch and ACK failures pending for reclaim', async () => {
    const s = setup();
    s.redis.reclaim.mockResolvedValueOnce([{ id: 'dispatch-failed', envelope: 'dispatch-failed' }]);
    s.redis.read.mockResolvedValueOnce([{ id: 'ack-failed', envelope: 'ack-failed' }]);
    s.dispatcher.dispatch.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    s.redis.ack.mockRejectedValueOnce(new Error('ack unavailable'));
    await s.cycle();
    expect(s.redis.ack).toHaveBeenCalledTimes(1);
    expect(s.redis.ack).toHaveBeenCalledWith('ack-failed');
  });
});
