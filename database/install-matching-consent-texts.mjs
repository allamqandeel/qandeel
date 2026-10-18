// S6-07 (CP3) — the governed installer of the approved Matching enrollment consent texts (version 1). OPERATOR TOOLING.
//
//   node database/install-matching-consent-texts.mjs --database-url <url> --confirm MATCHING_CONSENT_TEXTS_V1
//
// What it does, in ONE transaction, and nothing else:
//   * installs each text of `matching-consent-texts-v1.mjs` through the 0165 operator function
//     `matching_enrollment_private.install_consent_text_v1` — the only way a text enters the catalogue;
//   * is idempotent: a version already installed with exactly the approved text (both digests) and still current is left
//     as it is; the same version with any other text, a version that is no longer current, or a current text of the same
//     purpose that is NOT an approved text is refused, and nothing is written (it never supersedes an unknown text);
//   * proves before it commits that the ENROLLMENT gate is exactly as it found it: it never calls set_gate_v1, never
//     writes a gate row, and the gate stays closed — installing texts is NOT opening enrollment.
//
// Bounds (the Product Owner's decision of 2026-10-18: approving the texts authorizes neither opening ENROLLMENT nor
// installing the texts on the hosted environment): the target must be a loopback database (localhost, 127.0.0.1, ::1).
// Any other host is refused before connecting; installing on a hosted environment is a separate, later authorization.
// No CI workflow and no migration runs this against anything but the CI's own throw-away PostgreSQL.
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { MATCHING_CONSENT_TEXTS_V1 } from './matching-consent-texts-v1.mjs';

export const CONFIRMATION = 'MATCHING_CONSENT_TEXTS_V1';
const S = 'matching_enrollment_private';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class ConsentInstallRefused extends Error {}

/** The host of a PostgreSQL connection string, refused unless it is a loopback host. */
export function assertLoopbackDatabase(databaseUrl) {
  let host;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new ConsentInstallRefused('refused: the database URL cannot be parsed');
  }
  if (!LOOPBACK.has(host)) {
    throw new ConsentInstallRefused(`refused: ${host || '(no host)'} is not a loopback database. Installing the consent texts on a hosted environment is not authorized.`);
  }
}

const gateSnapshot = async (client) => (await client.query(
  `SELECT (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.scope), '[]'::jsonb) FROM ${S}.gate_states g) AS states,
          (SELECT count(*) FROM ${S}.gate_events) AS events,
          ${S}.gate_open_v1() AS open`)).rows[0];

/**
 * Install (or confirm) the approved texts on an already-connected client, as the database owner. Returns, per text,
 * INSTALLED or ALREADY_INSTALLED. Throws ConsentInstallRefused (nothing written) on any departure from the approved texts.
 *
 * `inTransaction`: run inside the caller's open transaction (a savepoint undoes this call alone on a refusal) instead of
 * one of its own — what the verifier uses, so its proof rolls back and the catalogue is left empty.
 */
export async function installMatchingConsentTextsV1(client, { inTransaction = false } = {}) {
  try {
    await client.query(inTransaction ? 'SAVEPOINT install_matching_consent_texts' : 'BEGIN');
  } catch (error) {
    // 25P01: a SAVEPOINT outside a transaction block. inTransaction needs the caller's OPEN transaction (BEGIN first).
    if (error?.code === '25P01') {
      throw new Error('installMatchingConsentTextsV1({ inTransaction: true }) needs an open transaction: call it after BEGIN, or omit inTransaction', { cause: error });
    }
    throw error;
  }
  try {
    const before = await gateSnapshot(client);
    const results = [];
    for (const text of MATCHING_CONSENT_TEXTS_V1) {
      const [existing] = (await client.query(
        `SELECT purpose, text_ar, text_en, sha256_ar, sha256_en, is_current FROM ${S}.consent_texts WHERE consent_version = $1`, [text.version])).rows;
      if (existing !== undefined) {
        if (existing.purpose !== text.purpose || existing.text_ar !== text.textAr || existing.text_en !== text.textEn
            || existing.sha256_ar !== text.sha256Ar || existing.sha256_en !== text.sha256En) {
          throw new ConsentInstallRefused(`refused: ${text.version} is installed with another text; an installed version is never rewritten`);
        }
        if (!existing.is_current) throw new ConsentInstallRefused(`refused: ${text.version} is installed but no longer current`);
        results.push({ version: text.version, result: 'ALREADY_INSTALLED' });
        continue;
      }
      const current = (await client.query(
        `SELECT consent_version FROM ${S}.consent_texts WHERE purpose = $1 AND is_current FOR UPDATE`, [text.purpose])).rows;
      if (current.length > 0) {
        throw new ConsentInstallRefused(`refused: ${text.purpose} already has a current text (${current[0].consent_version}) that is not an approved one`);
      }
      const installed = (await client.query(`SELECT ${S}.install_consent_text_v1($1, $2, $3, $4) AS v`,
        [text.version, text.purpose, text.textAr, text.textEn])).rows[0].v;
      const [row] = (await client.query(`SELECT sha256_ar, sha256_en, is_current FROM ${S}.consent_texts WHERE consent_version = $1`, [installed])).rows;
      if (installed !== text.version || row.sha256_ar !== text.sha256Ar || row.sha256_en !== text.sha256En || !row.is_current) {
        throw new ConsentInstallRefused(`refused: ${text.version} was not installed exactly as approved`);
      }
      results.push({ version: text.version, result: 'INSTALLED' });
    }
    const after = await gateSnapshot(client);
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new ConsentInstallRefused('refused: the ENROLLMENT gate changed during the install');
    await client.query(inTransaction ? 'RELEASE SAVEPOINT install_matching_consent_texts' : 'COMMIT');
    return { results, gateOpen: after.open };
  } catch (error) {
    await client.query(inTransaction ? 'ROLLBACK TO SAVEPOINT install_matching_consent_texts' : 'ROLLBACK');
    throw error;
  }
}

async function main(argv) {
  const at = (flag) => { const i = argv.indexOf(flag); return i === -1 ? undefined : argv[i + 1]; };
  const databaseUrl = at('--database-url');
  if (!databaseUrl || at('--confirm') !== CONFIRMATION) {
    throw new ConsentInstallRefused(`usage: node database/install-matching-consent-texts.mjs --database-url <loopback url> --confirm ${CONFIRMATION}`);
  }
  assertLoopbackDatabase(databaseUrl);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { results, gateOpen } = await installMatchingConsentTextsV1(client);
    for (const r of results) console.log(`${r.version}: ${r.result}`);
    console.log(`ENROLLMENT gate unchanged (${gateOpen ? 'open' : 'closed'}); no gate was touched`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof ConsentInstallRefused ? error.message : error);
    process.exitCode = 1;
  });
}
