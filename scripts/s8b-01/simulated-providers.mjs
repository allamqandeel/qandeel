// S8B-01 — deterministic SIMULATED providers for the zero-cost benchmark rehearsal. They stand in for ASR, TTS and the
// DeepSeek Chat Completions stream so the scoring path can be proven end to end without a key or a network call. Their
// numbers are synthetic by construction and are never reported as provider evidence.
import { createServer } from 'node:http';

/** A small deterministic hash, so each (provider, item) pair always gets the same simulated behaviour. */
function hash(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** Drops one word from roughly one utterance in `every`, so WER is non-zero and provider-dependent. */
function simulatedTranscript(provider, reference) {
  const h = hash(`${provider}|${reference}`);
  const words = reference.split(/\s+/u);
  if (h % 4 === 0 && words.length > 3) words.splice(h % words.length, 1);
  return words.join(' ');
}

export async function createSimulatedProviders() {
  // A local SSE server shaped like Chat Completions with stream: true (headers, then deltas, then usage, then [DONE]).
  const reply = 'تمام، فاهمك. تحب نبدأ بأكتر حاجة شاغلة بالك النهارده؟ ممكن نمشي فيها خطوة خطوة.';
  const chunks = reply.match(/.{1,6}/gsu);
  const server = createServer((request, response) => {
    const n = Number(new URL(request.url, 'http://127.0.0.1').searchParams.get('n') ?? 0);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    let i = 0;
    const firstDelay = 20 + (n % 5) * 5;
    const send = () => {
      if (i < chunks.length) {
        response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: chunks[i] } }] })}\n\n`);
        i += 1;
        // Back-to-back deltas: Windows timers have a ~15 ms floor, which would make the rehearsal slow for no information.
        setImmediate(send);
        return;
      }
      response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 40 } })}\n\n`);
      response.end('data: [DONE]\n\n');
    };
    setTimeout(send, firstDelay);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  // A synthetic server guidance, shaped like the S8A-01 guard's input (prose sentences plus a data container), so the VA-2
  // GUIDANCE_ECHO holdback is exercised. CP2 measures with the REALTIME spoken guidance the Orchestrator composes.
  const serverGuidance = 'Reply in short spoken sentences that the listener can follow without seeing any text at all.\n'
    + 'Never read lists, markdown, links or symbols aloud; say what matters in plain natural speech.\n'
    + '<user_memory_context>synthetic data that a reply may say back</user_memory_context>';

  return {
    serverGuidance,
    async transcribe(provider, dialect, reference) {
      const h = hash(`${provider}|${dialect}|${reference}`);
      return { text: simulatedTranscript(provider, reference), finalLatencyMs: 120 + (h % 200) };
    },
    async synthesize(provider, arm, text) {
      const h = hash(`${provider}|${arm}|${text}`);
      return { ttfbMs: 150 + (h % 180), characters: [...text].length };
    },
    async streamCompletion(n) {
      return fetch(`http://127.0.0.1:${port}/chat/completions?n=${n}`, { method: 'POST', body: '{}' });
    },
    simulatedStage(symbol) {
      return { E: 500, P: 180, R: 15 }[symbol];
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
