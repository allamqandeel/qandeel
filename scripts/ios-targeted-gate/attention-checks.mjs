// INTEL-LIVE-01 CP2 — the iOS Targeted Gate's v3 attention checks over the proof server's content-free evidence (and the
// same checks over the local Android emulator evidence). VALIDATION ONLY. Each check prints what it found and exits 0
// (met) or 1 (not met); it never waits and never repeats: the runner's wait loops call it again.
//
// usage: node attention-checks.mjs <server-events.jsonl> <attention.json> <check> [args]
//   (<attention.json>: a `/proof/attention` read, used by the checks that compare with the database)
//   v3 <epoch>                 an ATTENTION_STATE the lane SENT on the call's connection at <epoch> (only a v3 phone whose
//                              call is ACTIVE on that connection is ever sent one: the connection says NOT_LISTENING otherwise)
//   noclock                    the phone answered v2's clock marks inside v3 with null (NOCLOCK), and only so
//   applied                    the phone applied the database's latest event (a probe `applied` or `tick` row at or past `lastSeq`)
//                              and then holds exactly the open subjects (`open`, both tracks)
//   behind                     the phone has NOT applied the latest event (frames withheld)
//   restored <epoch> <sinceAt>
//                              after <sinceAt>: an ATTENTION_STATE SENT on a connection later than <epoch>, and the phone
//                              then applied the latest event and holds exactly the open subjects
//   cosmos <sinceAt>           after <sinceAt>: the production Personal owner (the probe's mirror) compiled a stage with a mark
//                              whose digest differs from the last stage it compiled without one
//   cleanup <sinceAt>          the phone holds no mark and its latest stage has none; its last mark left either with the
//                              database's latest event (open set empty) or, after <sinceAt> (the end), with the call no
//                              longer ACTIVE - never dropped while ACTIVE without that event
import { readFileSync } from 'node:fs';

const [file, attentionFile, check, ...args] = process.argv.slice(2);
const lines = readFileSync(file, 'utf8').split('\n').flatMap((l) => { try { return l ? [JSON.parse(l)] : []; } catch { return []; } });
const sent = (frame) => lines.filter((e) => e.kind === 'attention-sent' && e.frame === frame && e.delivery === 'SENT');
const probe = (row) => lines.filter((e) => e.kind === 'probe' && e.row === row);
// What the phone's layer held, in order: each change its owner announced, and its seq every 2 s while a call runs (a
// snapshot that changes no mark still advances the seq).
const held = () => lines.filter((e) => e.kind === 'probe' && (e.row === 'applied' || e.row === 'tick'));
const attention = () => JSON.parse(readFileSync(attentionFile, 'utf8'));
const openTotal = (a) => (a.open ?? []).reduce((n, r) => n + r.n, 0);
const done = (ok, detail) => { process.stdout.write(`${detail}\n`); process.exit(ok ? 0 : 1); };

/** What the phone's layer held last (after sinceAt), and whether it is the database's open set at lastSeq. */
function holdsOpen(a, sinceAt = 0) {
  const rows = held().filter((r) => r.at > sinceAt);
  const latest = rows[rows.length - 1] ?? null;
  const ok = latest !== null && latest.seq >= a.lastSeq && latest.marks === openTotal(a);
  return { ok, detail: `database lastSeq ${a.lastSeq}, open ${openTotal(a)}; phone ${latest === null ? 'applied nothing' : `at seq ${latest.seq} holds ${latest.marks} (${rows.length} rows)`}` };
}

switch (check) {
  case 'v3': {
    const epoch = Number(args[0]);
    const hit = sent('STATE').find((e) => e.epoch === epoch);
    done(hit !== undefined, hit ? `ATTENTION_STATE seq ${hit.seq} (${hit.entries} entries) SENT on epoch ${epoch}` : `no ATTENTION_STATE was SENT on epoch ${epoch}`);
    break;
  }
  case 'noclock': {
    const echoes = lines.filter((e) => e.kind === 'clock-signal' && e.operation === 'clock_echo');
    const noclock = echoes.filter((e) => e.outcome === 'noclock').length;
    done(noclock > 0 && noclock === echoes.length, `clock echoes: ${noclock} NOCLOCK of ${echoes.length}`);
    break;
  }
  case 'applied': {
    const r = holdsOpen(attention());
    done(r.ok, r.detail);
    break;
  }
  case 'behind': {
    const a = attention();
    const rows = held();
    const latest = rows[rows.length - 1] ?? null;
    done(latest === null || latest.seq < a.lastSeq, `database lastSeq ${a.lastSeq}; phone ${latest === null ? 'applied nothing' : `at seq ${latest.seq}`}`);
    break;
  }
  case 'restored': {
    const a = attention();
    const epoch = Number(args[0]);
    const sinceAt = Number(args[1]);
    const state = sent('STATE').find((e) => e.epoch > epoch && e.at > sinceAt);
    const r = holdsOpen(a, sinceAt);
    done(state !== undefined && r.ok, `${state ? `ATTENTION_STATE seq ${state.seq} (${state.entries} entries) SENT on epoch ${state.epoch}` : `no ATTENTION_STATE SENT on a connection after epoch ${epoch}`}; ${r.detail}`);
    break;
  }
  case 'cosmos': {
    const sinceAt = Number(args[0]);
    const rows = probe('digest');
    let lastBare = null;
    let hit = null;
    for (const r of rows) {
      if (r.marks === 0) lastBare = r;
      else if (r.at > sinceAt && lastBare !== null && r.digest !== lastBare.digest) { hit = r; break; }
    }
    done(hit !== null, hit ? `stage digest ${lastBare.digest} without a mark -> ${hit.digest} with ${hit.marks} (seq ${hit.seq})` : `no stage with a mark compiled after ${sinceAt} (${rows.length} digest rows)`);
    break;
  }
  case 'cleanup': {
    // CALL-ATTR-01 CI R1: the check correlates the phone's actual mark REMOVAL (the held row after the last one holding a
    // mark), at the phone's own instant (`phoneAt`, on the server's clock), never the first `applied` row the server
    // happened to receive after <sinceAt>. A removal is accepted only as the database's own latest event (the phone
    // applied a new seq, the database's lastSeq, whose open set is empty) or as the end's cleanup (the call no longer
    // ACTIVE, after <sinceAt>). A drop while ACTIVE without that event, or a mark kept, fails.
    const sinceAt = Number(args[0]);
    const a = attention();
    const digests = probe('digest');
    const rows = held();
    const when = (r) => r.phoneAt ?? r.at;
    const fromEnd = (r) => (when(r) < sinceAt ? `${sinceAt - when(r)} ms before the end` : `${when(r) - sinceAt} ms after the end`);
    const last = rows[rows.length - 1] ?? null;
    const stage = digests[digests.length - 1] ?? null;
    const lastHolding = rows.findLastIndex((r) => r.marks > 0);
    const removal = lastHolding < 0 ? null : rows[lastHolding + 1] ?? null;
    const byDatabase = removal !== null && removal.row === 'applied' && removal.seq > rows[lastHolding].seq
      && removal.seq === a.lastSeq && openTotal(a) === 0;
    const byEnd = removal !== null && removal.stage !== 'ACTIVE' && when(removal) > sinceAt;
    const how = lastHolding < 0 ? 'never held a mark'
      : removal === null ? `still holds the mark(s) seen at seq ${rows[lastHolding].seq}`
        : byDatabase ? `its last mark left with the database's latest event (seq ${removal.seq}, open ${openTotal(a)}) at the call's ${removal.stage}, ${fromEnd(removal)}`
          : byEnd ? `its last mark was dropped at the call's ${removal.stage}, ${fromEnd(removal)}`
            : `its last mark was dropped at the call's ${removal.stage} at seq ${removal.seq} (${removal.row}) without the database's latest event (lastSeq ${a.lastSeq}, open ${openTotal(a)})`;
    const phone = last === null ? 'applied nothing' : `holds ${last.marks} mark(s), ${how}`;
    done(last !== null && last.marks === 0 && stage !== null && stage.marks === 0 && (lastHolding < 0 || byDatabase || byEnd),
      `phone: ${phone}; stage: ${stage === null ? 'never compiled' : `${stage.digest} with ${stage.marks} mark(s)`}`);
    break;
  }
  default:
    done(false, `unknown check ${check}`);
}
