/**
 * S8B-04 (CP1, VA-11R "What reaches Google", I-3 / I-4, AC-10) — the request body, a CLOSED allowlist. Exactly:
 *
 *   { contents: [{ role: 'user', parts: [{ text, speechMetadata: { style } }] }],
 *     generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: 'Achird' } } } }
 *
 * `text` is the speech-only rendering of QANDEEL's own reply segment; `style` is one approved sentence (S-01 … S-06) and
 * rides only in `speechMetadata`, never inside `text`. Nothing else is ever added: no user identifier, user recording,
 * user message, Memory, guidance, `labels`, `systemInstruction`, `tools`, `safetySettings`, `temperature`, `topP`,
 * `topK` or `candidateCount` (the 3.8 TTS models reject the sampling fields and require the others absent).
 */
import { VERTEX_SPEECH_VOICE } from './vertex-speech.config';

export interface VertexSpeechRequestBody {
  readonly contents: readonly [{ readonly role: 'user'; readonly parts: readonly [{ readonly text: string; readonly speechMetadata: { readonly style: string } }] }];
  readonly generationConfig: {
    readonly responseModalities: readonly ['AUDIO'];
    readonly speechConfig: { readonly voiceConfig: { readonly voice: typeof VERTEX_SPEECH_VOICE } };
  };
}

/** Every JSON path the body may hold, and nothing else (the contract test walks a built body against it). */
export const VERTEX_SPEECH_REQUEST_PATHS: readonly string[] = Object.freeze([
  'contents', 'contents[]', 'contents[].role', 'contents[].parts', 'contents[].parts[]', 'contents[].parts[].text',
  'contents[].parts[].speechMetadata', 'contents[].parts[].speechMetadata.style',
  'generationConfig', 'generationConfig.responseModalities', 'generationConfig.responseModalities[]',
  'generationConfig.speechConfig', 'generationConfig.speechConfig.voiceConfig', 'generationConfig.speechConfig.voiceConfig.voice',
]);

export function vertexSpeechRequestBody(text: string, style: string): VertexSpeechRequestBody {
  if (text.trim() === '' || style.trim() === '') throw new Error('VERTEX_SPEECH_REQUEST_INVALID');
  return {
    contents: [{ role: 'user', parts: [{ text, speechMetadata: { style } }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: VERTEX_SPEECH_VOICE } } },
  };
}

/** The JSON paths a value holds (arrays as `[]`), for the allowlist proof. */
export function jsonPaths(value: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, path: string): void => {
    if (path) out.add(path);
    if (Array.isArray(v)) for (const item of v) walk(item, `${path}[]`);
    else if (v !== null && typeof v === 'object') for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k);
  };
  walk(value, '');
  return [...out];
}
