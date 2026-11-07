import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// S8B-07 CP1-B — V-33 (static): no Replay work on a Live Voice host, and no Voice Gateway on the Replay pool.
// The import graphs are walked from each entry point over the real source files (relative imports, `import` and
// `require`), so a later edit that pulls one graph into the other fails here.
const SRC = resolve(__dirname, '..');
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]|require\(\s*['"](\.[^'"]+)['"]\s*\)/gu;

function resolveFile(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (candidate.endsWith('.ts') && existsSync(candidate)) return candidate;
  }
  return null;
}

function graphOf(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [resolve(SRC, entry)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const next = resolveFile(file, (match[1] ?? match[2] ?? match[3])!);
      if (next !== null && !next.endsWith('.spec.ts')) queue.push(next);
    }
  }
  return new Set([...seen].map((f) => relative(SRC, f).split('\\').join('/')));
}

const api = graphOf('main.ts');
const worker = graphOf('replay-media/media-worker.main.ts');
const watchdog = graphOf('replay-media/replay-watchdog.main.ts');
const service = graphOf('replay-media/replay-media-service.main.ts');
const sourceOf = (files: Set<string>) => [...files].map((f) => [f, readFileSync(join(SRC, f), 'utf8')] as const);

describe('V-33: the API (the Voice Gateway\'s process) holds no Replay work', () => {
  it('the API graph carries the Voice Gateway and, of replay-media, only the role guard', () => {
    expect(api.has('voice/call/gateway/live-call.gateway.ts')).toBe(true);
    expect([...api].filter((f) => f.startsWith('replay-media/'))).toEqual(['replay-media/replay-compute-role.ts']);
  });

  it('no API file spawns ffmpeg, names a processing-file key, calls a transient definer or holds the Replay role', () => {
    for (const [file, text] of sourceOf(api)) {
      expect([file, /FFMPEG_BIN|ffmpeg/u.test(text) && /spawn\(/u.test(text)]).toEqual([file, false]);
      expect([file, /voice-transient\//u.test(text)]).toEqual([file, false]);
      expect([file, /transient_media|server_sweep_transient|MediaWorker|ReplayWatchdog/u.test(text)]).toEqual([file, false]);
      expect([file, /qandeel_replay_media|REPLAY_MEDIA_DATABASE_URL/u.test(text)]).toEqual([file, false]);
    }
  });

  it('the API\'s private audio store still refuses a processing-file key (its key rule is unchanged)', () => {
    const store = readFileSync(join(SRC, 'voice-media/private-audio-object.store.ts'), 'utf8');
    expect(store).toContain("const VOICE_KEY = /^voice-(?:note|call)\\/[0-9a-f-]{36}$/u;");
    expect(store).toContain("export const VOICE_KEY_PREFIXES = ['voice-note/', 'voice-call/'] as const;");
  });
});

describe('V-33: the Replay pool\'s graphs hold no Voice Gateway, no Redis and no API channel', () => {
  for (const [name, graph] of [['media worker', worker], ['watchdog', watchdog], ['Replay Media Service', service]] as const) {
    it(`the ${name} graph`, () => {
      const forbidden = [...graph].filter((f) => f === 'app.module.ts' || f.startsWith('voice/call/gateway/')
        || f.startsWith('conversation/') || f.includes('redis') || f === 'voice-media/voice-media.module.ts');
      expect(forbidden).toEqual([]);
      for (const [file, text] of sourceOf(graph)) {
        expect([file, /from 'redis'|require\('redis'\)|bullmq/u.test(text)]).toEqual([file, false]);
        expect([file, /SupabaseServiceRoleApiService|SUPABASE_SERVICE_ROLE_KEY/u.test(text)]).toEqual([file, false]);
      }
    });
  }

  it('the watchdog mixes nothing: no ffmpeg, no mixer, no worker', () => {
    expect([...watchdog].filter((f) => /replay-ffmpeg|transient-mixer|media-worker/u.test(f))).toEqual([]);
  });

  it('the Replay Media Service streams and mixes nothing: no ffmpeg, no mixer, no worker; the same bearer check as the API', () => {
    expect([...service].filter((f) => /replay-ffmpeg|transient-mixer|media-worker/u.test(f))).toEqual([]);
    expect(service.has('auth/supabase-auth.guard.ts')).toBe(true);
    expect(service.has('replay-media/transient-media.controller.ts')).toBe(true);
    // It reuses the Range parser's leaf, never the Voice Media service or its service-role repository.
    expect(service.has('voice-media/byte-range.ts')).toBe(true);
    expect([...service].filter((f) => /voice-media\/voice-media\.(?:service|repository|controller)|voice-notes/u.test(f))).toEqual([]);
    for (const [file, text] of sourceOf(service)) expect([file, /process\.env\.DATABASE_URL\b|SUPABASE_SECRET_KEY/u.test(text)]).toEqual([file, false]);
  });

  it('the transient routes exist only on the Replay pool: no API file declares them', () => {
    // The route census (http-security) names them as data, to classify them; no API file routes or loads them.
    for (const [file, text] of sourceOf(api)) {
      expect([file, /@(?:Get|Post|Delete)\('(?:voice\/listening|voice\/transient|replay\/:replayId\/versions\/:versionId\/playback)/u.test(text)])
        .toEqual([file, false]);
      expect([file, /TransientMediaController|ReplayMediaServiceModule|transient-media\.controller/u.test(text)]).toEqual([file, false]);
    }
  });

  it('the media worker loads nothing of the call path, not even its codec (no opusscript on the Replay pool)', () => {
    expect([...worker].filter((f) => f.startsWith('voice/call/'))).toEqual([]);
    for (const [file, text] of sourceOf(worker)) expect([file, /opusscript/u.test(text)]).toEqual([file, false]);
  });

  it('V-08: the worker never reads a turn\'s started_at or accepted_at; it places by the plan\'s clock only', () => {
    for (const [file, text] of sourceOf(worker).filter(([f]) => f.startsWith('replay-media/'))) {
      expect([file, /started_at|accepted_at/u.test(text)]).toEqual([file, false]);
    }
  });
});
