import { createClient } from 'redis';
import { RedisStreamsTransport } from './redis-streams.transport';

jest.mock('redis',()=>({createClient:jest.fn()}));

type FakeClient={
 isOpen:boolean;isReady:boolean;
 handlers:Record<string,(...args:unknown[])=>void>;
 on:jest.Mock;connect:jest.Mock;quit:jest.Mock;destroy:jest.Mock;xAdd:jest.Mock;
};
const fakeClient=(behavior:'succeed'|'fail')=>{
 const client:FakeClient={
  isOpen:false,isReady:false,handlers:{},
  on:jest.fn((name:string,handler:(...args:unknown[])=>void)=>{client.handlers[name]=handler;return client;}),
  connect:jest.fn(async()=>{if(behavior==='fail'){client.handlers.error?.(new Error('ECONNREFUSED'));throw new Error('ECONNREFUSED');}client.isOpen=true;client.isReady=true;}),
  quit:jest.fn(async()=>{client.isOpen=false;client.isReady=false;}),
  destroy:jest.fn(()=>{client.isOpen=false;client.isReady=false;}),
  xAdd:jest.fn(async()=>'1-0'),
 };
 return client;
};
const envelope={event_id:'10000000-0000-4000-8000-000000000001'} as never;

describe('RedisStreamsTransport lifecycle (retryable connect)',()=>{
 const savedRedis=process.env.REDIS_URL;
 const mockedCreateClient=createClient as jest.Mock;
 beforeEach(()=>{mockedCreateClient.mockReset();process.env.REDIS_URL='redis://configured';});
 afterEach(()=>{if(savedRedis===undefined)delete process.env.REDIS_URL;else process.env.REDIS_URL=savedRedis;});

 it('starts not_configured without REDIS_URL: connect throws, publish refuses, close is safe',async()=>{
  delete process.env.REDIS_URL;
  const transport=new RedisStreamsTransport();
  expect(transport.readinessStatus).toBe('not_configured');
  await expect(transport.connect()).rejects.toThrow('REDIS_DISABLED');
  await expect(transport.publish(envelope)).rejects.toThrow('TRANSPORT_UNAVAILABLE');
  await expect(transport.close()).resolves.toBeUndefined();
  expect(transport.readinessStatus).toBe('not_configured');
  expect(mockedCreateClient).not.toHaveBeenCalled();
 });

 it('connects with a bounded single-shot attempt (library reconnect disabled) and becomes available',async()=>{
  const client=fakeClient('succeed');mockedCreateClient.mockReturnValue(client);
  const transport=new RedisStreamsTransport();
  expect(transport.readinessStatus).toBe('degraded');
  await transport.connect();
  expect(transport.readinessStatus).toBe('available');
  // The redis library owns no retry loop: the publisher supervision cadence
  // is the only reconnect owner.
  expect(mockedCreateClient).toHaveBeenCalledWith({url:'redis://configured',socket:{reconnectStrategy:false}});
 });

 it('treats connect() as a no-op success when the client is already ready',async()=>{
  const client=fakeClient('succeed');mockedCreateClient.mockReturnValue(client);
  const transport=new RedisStreamsTransport();
  await transport.connect();
  await transport.connect();
  expect(mockedCreateClient).toHaveBeenCalledTimes(1);
  expect(client.connect).toHaveBeenCalledTimes(1);
  expect(transport.readinessStatus).toBe('available');
 });

 it('is retryable on the SAME instance after a failed connect: the stale failed client never stays authoritative',async()=>{
  const failed=fakeClient('fail'),healthy=fakeClient('succeed');
  mockedCreateClient.mockReturnValueOnce(failed).mockReturnValueOnce(healthy);
  const transport=new RedisStreamsTransport();
  await expect(transport.connect()).rejects.toThrow('ECONNREFUSED');
  expect(transport.readinessStatus).toBe('degraded');
  expect(failed.destroy).toHaveBeenCalledTimes(1);
  await expect(transport.publish(envelope)).rejects.toThrow('TRANSPORT_UNAVAILABLE');
  await transport.connect();
  expect(transport.readinessStatus).toBe('available');
  await expect(transport.publish(envelope)).resolves.toBe('1-0');
  expect(healthy.xAdd).toHaveBeenCalledTimes(1);
  expect(failed.xAdd).not.toHaveBeenCalled();
  expect(mockedCreateClient).toHaveBeenCalledTimes(2);
 });

 it('degrades on a runtime error event and a later connect uses a fresh client',async()=>{
  const first=fakeClient('succeed'),second=fakeClient('succeed');
  mockedCreateClient.mockReturnValueOnce(first).mockReturnValueOnce(second);
  const transport=new RedisStreamsTransport();
  await transport.connect();
  first.handlers.error?.(new Error('connection lost'));first.isReady=false;first.isOpen=false;
  expect(transport.readinessStatus).toBe('degraded');
  await transport.connect();
  expect(transport.readinessStatus).toBe('available');
  expect(first.destroy).toHaveBeenCalledTimes(1);
  await expect(transport.publish(envelope)).resolves.toBe('1-0');
  expect(second.xAdd).toHaveBeenCalledTimes(1);
 });

 it('close is safe and idempotent across never-connected, failed, connected, and already-closed states',async()=>{
  const failed=fakeClient('fail'),healthy=fakeClient('succeed');
  mockedCreateClient.mockReturnValueOnce(failed).mockReturnValueOnce(healthy);
  const transport=new RedisStreamsTransport();
  await expect(transport.close()).resolves.toBeUndefined();
  await expect(transport.connect()).rejects.toThrow('ECONNREFUSED');
  await expect(transport.close()).resolves.toBeUndefined();
  await transport.connect();
  await expect(transport.close()).resolves.toBeUndefined();
  expect(healthy.quit).toHaveBeenCalledTimes(1);
  await expect(transport.close()).resolves.toBeUndefined();
  expect(transport.readinessStatus).toBe('degraded');
  await expect(transport.publish(envelope)).rejects.toThrow('TRANSPORT_UNAVAILABLE');
 });
});
