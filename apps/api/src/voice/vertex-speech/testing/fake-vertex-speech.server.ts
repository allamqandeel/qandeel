import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * S8B-04 (CP1, §8.4, AC-09) — a FAKE Vertex `streamGenerateContent` server, for tests and the free integration proof only
 * (never composed by a module; it listens on 127.0.0.1). It answers each request with the next scripted behaviour
 * (default `ok`) and COUNTS every request, keeping what arrived (path, whether a bearer token was present, the parsed body)
 * so a test can prove the body allowlist and that no paid call was repeated. It never sends anything anywhere.
 */
export type FakeVertexBehaviour =
  | { readonly kind: 'ok'; readonly chunks?: number; readonly chunkBytes?: number; readonly usage?: 'complete' | 'absent'; readonly delayMs?: number }
  | { readonly kind: 'status'; readonly status: number }
  | { readonly kind: 'hang' }
  | { readonly kind: 'firstByteAfter'; readonly ms: number }
  | { readonly kind: 'dropAfterAudio' }
  | { readonly kind: 'errorAfterAudio' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'gate'; readonly release: Promise<void> };

export interface FakeVertexRequest {
  readonly path: string;
  readonly bearer: boolean;
  readonly body: unknown;
}

export const FAKE_VERTEX_SAMPLE_RATE = 24000;

export class FakeVertexSpeechServer {
  readonly requests: FakeVertexRequest[] = [];
  private readonly script: FakeVertexBehaviour[] = [];
  private readonly open = new Set<ServerResponse>();
  private server: Server | null = null;

  get calls(): number {
    return this.requests.length;
  }

  /** Queues behaviours for the next requests, in order. */
  next(...behaviours: FakeVertexBehaviour[]): this {
    this.script.push(...behaviours);
    return this;
  }

  async start(): Promise<string> {
    this.server = createServer((request, response) => void this.handle(request, response));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    for (const response of this.open) response.destroy();
    this.open.clear();
    if (this.server) await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = null;
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    this.open.add(response);
    response.on('close', () => this.open.delete(response));
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    let body: unknown = null;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      body = null;
    }
    this.requests.push({ path: request.url ?? '', bearer: /^Bearer \S{20,}$/u.test(request.headers.authorization ?? ''), body });
    const behaviour = this.script.shift() ?? { kind: 'ok' };
    const sse = () => response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const audioEvent = (bytes: number, seed: number) => `data: ${JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ inlineData: { mimeType: `audio/L16;codec=pcm;rate=${FAKE_VERTEX_SAMPLE_RATE}`, data: Buffer.alloc(bytes, seed % 251).toString('base64') } }] } }],
    })}\n\n`;
    switch (behaviour.kind) {
      case 'status':
        response.writeHead(behaviour.status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { code: behaviour.status, status: 'FAKE' } }));
        return;
      case 'hang':
        return;
      case 'firstByteAfter':
        sse();
        setTimeout(() => { if (!response.destroyed) response.end(audioEvent(960, 1) + finalEvent('complete')); }, behaviour.ms);
        return;
      case 'dropAfterAudio':
        sse();
        response.write(audioEvent(960, 1));
        setTimeout(() => response.destroy(), 20);
        return;
      case 'errorAfterAudio':
        sse();
        response.write(audioEvent(960, 1));
        response.end(`data: ${JSON.stringify({ error: { code: 500, status: 'INTERNAL' } })}\n\n`);
        return;
      case 'empty':
        sse();
        response.end(finalEvent('complete'));
        return;
      case 'malformed':
        sse();
        response.end('data: {not json\n\n');
        return;
      case 'gate':
        await behaviour.release;
        sse();
        response.end(audioEvent(960, 1) + finalEvent('complete'));
        return;
      case 'ok': {
        sse();
        const count = behaviour.chunks ?? 3;
        for (let i = 0; i < count; i += 1) {
          if (behaviour.delayMs) await new Promise((r) => setTimeout(r, behaviour.delayMs));
          if (response.destroyed) return;
          response.write(audioEvent(behaviour.chunkBytes ?? 960, i));
        }
        response.end(finalEvent(behaviour.usage ?? 'complete'));
        return;
      }
    }
  }
}

function finalEvent(usage: 'complete' | 'absent'): string {
  return `data: ${JSON.stringify({
    candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'STOP' }],
    ...(usage === 'complete' ? { usageMetadata: { promptTokenCount: 41, candidatesTokenCount: 75, candidatesTokensDetails: [{ modality: 'AUDIO', tokenCount: 75 }] } } : {}),
  })}\n\n`;
}
