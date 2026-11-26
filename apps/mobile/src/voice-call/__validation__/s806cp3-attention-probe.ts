/**
 * INTEL-LIVE-01 CP2 — the Android emulator evidence's attention probe (B5′ / B6′). VALIDATION ONLY: the S8B-06 CP3 proof
 * root (`S806Cp3ProofRoot.tsx`) mounts it; no Product module imports this file, and only the proof build
 * (`select-s806cp3-proof-entry.mjs`) mounts that root.
 *
 * It is OFF unless the proof server asks for it (`GET /proof/probe` answers `{ on: true, language }`, only with
 * `PROOF_PROBE=ON`): the iOS Targeted Gate's server never does, so that gate's app does nothing here. When on, it only
 * WATCHES what the production code already did, and reports the instants:
 * - `applied`: the session's own CallOwner told its listeners the call's provisional attention changed (the layer the
 *   client built from the REAL v3 frames; nothing is injected, nothing is fed to it from here);
 * - `digest`: a MIRROR of the Personal COSMOS owner (`createPersonalCosmosOwner`, the production owner, over the same
 *   runtime) recompiled its stage and the stage's digest changed — the A1 table's T4 end point. The visible map's owner
 *   is notified by the same emission; the mirror shows when the stage could first be drawn, the screenshot what was drawn.
 *   The mirror is a second compile of the same stage on the phone (a proof cost, never present in a Product build).
 * Each instant is put on the server's clock by the offset of the fastest of five `GET /proof/clock` round trips, and
 * reported with `POST /proof/probe/report` (numbers, the layer's seq and the stage's digest; never a label or a word).
 */
import type { CallOwner } from '../../call';
import { createPersonalCosmosOwner } from '../../cosmos/product';
import { PROOF_CALL_COMMANDS_BASE } from './s806cp3-call-commands';

type ProbeFetch = (url: string, init?: { method: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
/** The session runtime the Personal COSMOS owner takes (the proof root passes it once READY). */
type ReadyRuntime = Parameters<typeof createPersonalCosmosOwner>[0]['runtime'];

export interface ProbeRow {
  readonly kind: 'applied' | 'digest' | 'tick';
  /** The phone's instant on the server's clock (ms). */
  readonly at: number;
  /** The call layer's seq at that instant (the highest event_seq the phone applied). */
  readonly seq: number;
  readonly marks: number;
  readonly digest: string | null;
  readonly stage: string;
}

export interface AttentionProbeOptions {
  /** The current session's runtime, when READY. */
  readonly runtime: () => ReadyRuntime | null;
  readonly fetch?: ProbeFetch;
  readonly now?: () => number;
}

/** The offset that puts a phone instant on the server's clock: the fastest round trip's midpoint. */
export function clockOffset(samples: readonly { readonly sent: number; readonly server: number; readonly received: number }[]): number | null {
  let best: { rtt: number; offset: number } | null = null;
  for (const s of samples) {
    const rtt = s.received - s.sent;
    if (rtt < 0) continue;
    const offset = s.server - (s.sent + s.received) / 2;
    if (best === null || rtt < best.rtt) best = { rtt, offset };
  }
  return best === null ? null : Math.round(best.offset);
}

/** Starts the probe if the proof server asks for it; returns its stop. */
export function followAttentionProbe(options: AttentionProbeOptions): () => void {
  const fetch: ProbeFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const now = options.now ?? Date.now;
  let stopped = false;
  const undo: (() => void)[] = [];
  const pending: ProbeRow[] = [];
  let flushing = false;

  const flush = async () => {
    if (flushing || pending.length === 0 || stopped) return;
    flushing = true;
    const rows = pending.splice(0, pending.length);
    try {
      await fetch(`${PROOF_CALL_COMMANDS_BASE}/proof/probe/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows }) });
    } catch {
      // A lost report is a gap in the evidence, never a retry loop.
    }
    flushing = false;
    if (pending.length > 0) void flush();
  };

  const start = async () => {
    let language: 'ar' | 'en' = 'ar';
    try {
      const response = await fetch(`${PROOF_CALL_COMMANDS_BASE}/proof/probe`);
      const body = (response.ok ? await response.json() : null) as { on?: unknown; language?: unknown } | null;
      if (body?.on !== true) return;
      if (body.language === 'en') language = 'en';
    } catch {
      return;
    }
    const samples: { sent: number; server: number; received: number }[] = [];
    for (let i = 0; i < 5 && !stopped; i += 1) {
      try {
        const sent = now();
        const response = await fetch(`${PROOF_CALL_COMMANDS_BASE}/proof/clock`);
        const body = (await response.json()) as { at?: unknown };
        const received = now();
        if (typeof body.at === 'number') samples.push({ sent, server: body.at, received });
      } catch {
        // counted by its absence
      }
    }
    const offset = clockOffset(samples);
    if (offset === null || stopped) return;

    // The session runtime is READY once the proof world's auth resolved; wait for it without a busy loop.
    let ready = options.runtime();
    while (ready === null && !stopped) {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      ready = options.runtime();
    }
    if (ready === null || stopped) return;
    const runtime = ready;
    const call: CallOwner = runtime.call;
    const mirror = createPersonalCosmosOwner({ runtime, language });
    const row = (kind: ProbeRow['kind'], digest: string | null): void => {
      const layer = call.getAttention();
      pending.push({ kind, at: now() + offset, seq: layer.seq, marks: layer.marks.length, digest, stage: call.getState().stage });
      void flush();
    };
    let lastDigest: string | null = null;
    const watchDigest = () => {
      const snapshot = mirror.getSnapshot();
      const digest = snapshot.list.digest;
      if (digest !== lastDigest) {
        lastDigest = digest;
        row('digest', digest);
      }
    };
    undo.push(call.subscribeAttention(() => row('applied', null)));
    undo.push(mirror.subscribe(watchDigest));
    undo.push(() => mirror.dispose());
    // While a call runs, the layer's seq every 2 s: a snapshot that changes no mark still advances it (a restore whose
    // state the phone already showed is otherwise invisible to the owner's listeners).
    const ticker = setInterval(() => { if (call.getState().stage !== 'IDLE') row('tick', null); }, 2000);
    undo.push(() => clearInterval(ticker));
    watchDigest();
  };
  void start();
  return () => {
    stopped = true;
    for (const u of undo.splice(0)) u();
  };
}
