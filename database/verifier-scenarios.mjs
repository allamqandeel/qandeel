// The permanent result contract for real-PostgreSQL verifiers: independent
// scenarios run in isolation, each reports its own outcome, and the run fails
// once at the end with all of them named.
//
// ## Why this exists
//
// A verifier is a program, and a program written against a database this host
// cannot run is written blind. Every defect in it is found by CI, and a verifier
// that stops at its FIRST failure turns N latent defects into N full CI rounds -
// twenty minutes each, one finding each. I-06A spent six rounds that way, and
// every one of the six was a defect in the verifier rather than in the migration
// it was proving.
//
// Aggregation collapses that: eight independent forward-safety probes that each
// might be wrong cost ONE round instead of eight, because the first round names
// all eight outcomes. This is not a weakening. The run still fails, still exits
// non-zero, and still refuses to call a failed probe a pass; it only declines to
// throw away the information it already has.
//
// ## What may and may not be aggregated
//
// ONLY independent scenarios. Where a later scenario consumes state a previous
// one committed - a fixture built in stages, a lifecycle walked forwards - a
// failure genuinely invalidates everything after it, and running on would report
// a cascade of consequences as if they were findings. Those sections keep
// failing fast; they simply do not come through here.
//
// ## Mutation probes
//
// A probe that weakens the schema and then requires the canonical check to
// refuse the weakening has a silent failure mode that reads as success in the
// direction that matters: if the mutation matches NOTHING, the tree is
// unchanged, the canonical check passes, and "the contract accepted a weakening"
// is reported for a weakening that was never made. So `probe` refuses to accept
// a transform that produced identical text, and refuses to accept a rejection it
// did not actually observe.
import assert from 'node:assert/strict';

/** One scenario's recorded outcome. `detail` is one line, not a stack. */
const firstLine = (error) => String(error?.message ?? error).split('\n')[0].trim();

/**
 * Creates one report for one verifier section.
 *
 * `query` is the verifier's own `q`; it is required only by the isolating
 * helpers, so a section that isolates some other way can omit it. `restore`
 * runs after EVERY scenario, passed or failed, and is where a caller puts the
 * session state a probe may have changed - the role, the claims, a GUC. Without
 * it a probe that failed half way through leaks its session into the next one,
 * and the aggregate stops being a set of independent results.
 */
export function createScenarioReport(label, { query = null, restore = null } = {}) {
  const results = [];
  let counter = 0;

  const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${label} ${name} ${ok ? 'pass' : 'FAIL'}${detail ? `: ${detail}` : ''}`);
    return ok;
  };

  /** A savepoint name PostgreSQL will accept, derived from the scenario name. */
  const savepointFor = (name) => {
    counter += 1;
    return `scenario_${counter}_${name.replace(/[^a-zA-Z0-9]+/gu, '_').slice(0, 24).toLowerCase()}`;
  };

  /**
   * Runs one independent scenario, records its outcome and NEVER rethrows.
   *
   * This is the plain form, for a scenario that needs no database isolation
   * because it writes nothing - a catalog read, a posture assertion, a static
   * comparison of two definitions.
   */
  async function section(name, body) {
    try {
      await body();
      return record(name, true, '');
    } catch (error) {
      return record(name, false, firstLine(error));
    } finally {
      if (restore) await restore();
    }
  }

  /**
   * Runs one independent scenario inside its own SAVEPOINT, and rolls it back
   * whatever happened.
   *
   * The caller must already be inside a transaction: PostgreSQL refuses
   * SAVEPOINT in autocommit with 25P01, and a helper that quietly opened its own
   * transaction would commit a scenario's writes the moment it returned. That
   * mistake cost I-06A a CI round on its own, so it is named rather than
   * papered over.
   */
  async function isolated(name, body) {
    assert.ok(query, `${label} ${name}: isolated scenarios need the verifier's query function`);
    const savepoint = savepointFor(name);
    let opened = false;
    try {
      await query(`SAVEPOINT ${savepoint}`);
      opened = true;
      await body();
      return record(name, true, '');
    } catch (error) {
      // 25P01 is PostgreSQL saying there is no transaction block. It arrives as
      // a code rather than as recognisable prose, and the prose it does carry
      // talks about savepoints - so the caller is told what is actually wrong.
      const noTransaction = error?.code === '25P01' || /25P01|no transaction in progress/iu.test(String(error?.message ?? ''));
      const detail = noTransaction
        ? `${firstLine(error)} - an isolated scenario must run inside an open transaction; wrap this section in BEGIN / ROLLBACK`
        : firstLine(error);
      return record(name, false, detail);
    } finally {
      if (opened) {
        await query(`ROLLBACK TO SAVEPOINT ${savepoint}`).catch(() => undefined);
        await query(`RELEASE SAVEPOINT ${savepoint}`).catch(() => undefined);
      }
      if (restore) await restore();
    }
  }

  /**
   * Runs one forward-safety / weakening probe, isolated, with BOTH halves proven.
   *
   * `pristine`   the canonical text the probe weakens - for a function, exactly
   *              what `pg_get_functiondef` emitted, never the migration source.
   *              PostgreSQL regenerates a signature in its own canonical form,
   *              so an anchor taken from the migration's line wrapping matches
   *              nothing and the probe silently tests the unmutated tree.
   * `mutate`     produces the weakened text. Required to CHANGE it.
   * `marker`     optional: text the weakening must have introduced.
   * `apply`      installs the weakened text.
   * `reject`     the canonical check. Required to THROW.
   */
  async function probe(name, { pristine, mutate, marker = null, apply, reject }) {
    return isolated(name, async () => {
      const weakened = mutate(pristine);
      assert.notEqual(weakened, pristine, 'the weakening matched nothing, so nothing was proven');
      if (marker) assert.ok(weakened.includes(marker), `the weakening did not introduce ${marker}`);
      await apply(weakened);
      let rejected = false;
      try {
        await reject();
      } catch {
        rejected = true;
      }
      assert.ok(rejected, 'the canonical check ACCEPTED the weakened state');
    });
  }

  /**
   * The summary, printed on EVERY run rather than only on failure.
   *
   * A run that prints nothing when it passes cannot be read back later to see
   * WHICH scenarios a green build actually exercised, and a probe that silently
   * stopped running would look exactly like a probe that passed.
   */
  function print() {
    const width = Math.max(8, ...results.map((r) => r.name.length));
    console.log(`\n${label} scenario summary`);
    for (const result of results) {
      console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${result.name.padEnd(width)}  ${result.detail}`);
    }
    const failed = results.filter((r) => !r.ok);
    console.log(`  ${results.length} scenario(s), ${results.length - failed.length} passed, ${failed.length} failed\n`);
    return { total: results.length, failed: failed.length };
  }

  /** Fails ONCE, naming every scenario that failed. */
  function assertAllPassed() {
    const failed = results.filter((r) => !r.ok);
    assert.deepEqual(failed.map((r) => r.name), [],
      `${label}: ${failed.length} of ${results.length} scenario(s) failed:\n  - ${failed.map((r) => `${r.name}: ${r.detail}`).join('\n  - ')}`);
  }

  const toJSON = () => ({ label, results: results.map((r) => ({ ...r })) });

  return { record, section, isolated, probe, print, assertAllPassed, toJSON, get results() { return [...results]; } };
}
