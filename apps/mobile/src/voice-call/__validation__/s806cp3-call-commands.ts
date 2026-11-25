/**
 * INTEL-LIVE-01 CP1 — the iOS Targeted Gate's call commands (PO, 2026-11-25, the final functional validation approach).
 * VALIDATION ONLY: the S8B-06 CP3 proof root (`S806Cp3ProofRoot.tsx`) follows them; no Product module imports this file,
 * and only the proof build (`select-s806cp3-proof-entry.mjs`) mounts that root.
 *
 * The simulator's synthetic touch delivery dropped the call-entry tap (runs 45612961224, 45630621237, 45659136860), so the
 * gate's functional cases start and end the call through the proof server (`s8b-06-cp3-device-proof-server.ts`): it
 * queues ONE command, this follower takes it once (`GET /proof/call/next`, which the server holds until a command is
 * queued or 20 s pass: one open request, no continuous polling) and calls exactly what the Conversation's controls call
 * on the session's own CallOwner — the call entry's `if (!preparing) void owner.start()`, the call line's End
 * `owner.end()` — then tells the server what it did and the owner's stage just after (`POST /proof/call/ack`). Everything
 * else of the call is the owner's own: capability, the server's truth, the microphone, consent, the platform call, the
 * engine and the socket. It proves the call, never a touch: the gate reports its UI touch checks separately.
 */
import type { CallOwner } from '../../call';

/** The proof server on the simulator's own loopback; nothing else is ever asked. */
export const PROOF_CALL_COMMANDS_BASE = 'http://127.0.0.1:8806';

export type ProofCallCommand = 'start' | 'end';
export type ProofCallOutcome = 'STARTED' | 'BUSY' | 'ENDED' | 'NO_SESSION';

/** What the call entry (start) and the call line's End (end) do, on the given owner. */
export function executeProofCallCommand(command: ProofCallCommand, owner: CallOwner | null): ProofCallOutcome {
  if (owner === null) return 'NO_SESSION';
  if (command === 'end') {
    owner.end();
    return 'ENDED';
  }
  if (owner.getState().stage === 'PREPARING') return 'BUSY';
  void owner.start();
  return 'STARTED';
}

export interface ProofCallCommandOptions {
  /** The current session's CallOwner, read at each command (null when no session runtime is READY). */
  readonly owner: () => CallOwner | null;
  readonly fetch?: (url: string, init?: { method: string }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  /** The pause after a refused or failed request, or an answer the server did not hold. */
  readonly pauseMs?: number;
  readonly now?: () => number;
}

/** Follows the proof server's call commands until the returned stop is called. */
export function followProofCallCommands(options: ProofCallCommandOptions): () => void {
  const fetch: NonNullable<ProofCallCommandOptions['fetch']> = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const pauseMs = options.pauseMs ?? 2000;
  const now = options.now ?? Date.now;
  let stopped = false;
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, pauseMs));
  const follow = async () => {
    while (!stopped) {
      const asked = now();
      try {
        const response = await fetch(`${PROOF_CALL_COMMANDS_BASE}/proof/call/next`);
        const body = (response.ok ? await response.json() : null) as { id?: unknown; op?: unknown } | null;
        if (stopped) return;
        if (body !== null && Number.isInteger(body.id) && (body.op === 'start' || body.op === 'end')) {
          const outcome = executeProofCallCommand(body.op, options.owner());
          const stage = options.owner()?.getState().stage ?? 'NONE';
          await fetch(`${PROOF_CALL_COMMANDS_BASE}/proof/call/ack?id=${String(body.id)}&outcome=${outcome}&stage=${stage}`, { method: 'POST' });
        } else if (body === null || now() - asked < 1000) {
          await pause();
        }
      } catch {
        if (!stopped) await pause();
      }
    }
  };
  void follow();
  return () => {
    stopped = true;
  };
}
