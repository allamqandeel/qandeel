// S8A-04 CP3-D V2 — Tier 1: the production steps BEFORE the check, for one fixed case (Controlled Amendment R4, §11.2 steps
// 1–4), shared by the driver (tier1-eval.ts) and the free pre-flight (preflight.ts). Operator-only; never a CI step.
//   prepareSharedClaimTable → parseSharedClaimSpans → renderSharedClaims → sharedClaimCheckerView, exactly as the lane's
//   claim detector composes them (shared-member-knowledge-lane.ts, `SharedClaimDetector`).
// DECLARED TEST SHORTCUTS: the case's keys R<n> become this request's refs; every item is inside the Disclosure Authorization;
// an item marked `claimable: false` is given an owner with no Name in the audience (0178's NULL), so it gets no ref; the
// binding references are synthetic. A case the server would refuse before any check is a set defect: this throws.
import { createHash, randomUUID } from 'node:crypto';
import {
  parseSharedClaimSpans, prepareSharedClaimTable, renderSharedClaims, sharedClaimCheckerView,
  type SharedClaimCheckerView, type SharedClaimParse, type SharedClaimTable,
} from '../../../apps/api/src/connected-worlds/member-knowledge/shared-claim-spans';
import type { SharedDisclosureCheckBinding, SharedDisclosureCheckRequest } from '../../../apps/api/src/connected-worlds/member-knowledge/shared-member-knowledge.types';

export interface Tier1Item { readonly key: string; readonly owner: string; readonly claimable: boolean; readonly text: string }
export interface Tier1Case {
  readonly id: string; readonly expected: 'BLOCK' | 'ALLOW'; readonly category: string; readonly language: string; readonly indirect?: boolean;
  readonly hardNegative?: boolean; readonly members: ReadonlyArray<string>; readonly sender: string; readonly message: string;
  readonly items: ReadonlyArray<Tier1Item>; readonly reply: string;
}
export interface Tier1Prepared {
  readonly table: SharedClaimTable; readonly marked: string; readonly parsed: Extract<SharedClaimParse, { ok: true }>;
  readonly rendered: { readonly text: string; readonly outputDigest: string }; readonly view: SharedClaimCheckerView;
  readonly request: SharedDisclosureCheckRequest; readonly authorized: ReadonlySet<string>;
}

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

export function prepareTier1Case(c: Tier1Case, userIdOf: (name: string) => string): Tier1Prepared {
  if (!c.members.includes(c.sender)) throw new Error(`${c.id}: the sender is not a member`);
  if (new Set(c.members).size !== c.members.length) throw new Error(`${c.id}: two members share a Name`);
  const memoryOf = new Map<string, string>(c.items.map((item) => [item.key, randomUUID()]));
  if (memoryOf.size !== c.items.length) throw new Error(`${c.id}: duplicate item keys`);
  for (const item of c.items) if (!c.members.includes(item.owner)) throw new Error(`${c.id}: item ${item.key} has no member owner`);
  const admitted = c.items.map((item) => ({ ownerUserId: userIdOf(item.owner), memoryId: memoryOf.get(item.key) as string, contentDigest: `sha256:${sha(item.text)}`, content: item.text }));
  const unnamed = new Set(c.items.filter((item) => !item.claimable).map((item) => item.owner));
  const binding = Object.freeze({
    effectiveContextRef: `sha256:${sha(`cp3d-v2:t1:context:${c.id}`)}`, audienceSnapshotRef: `sha256:${sha(`cp3d-v2:t1:audience:${c.id}`)}`,
    disclosureAuthorizationRef: `sha256:${sha(`cp3d-v2:t1:da:${c.id}`)}`,
  });
  const authorized = new Set(admitted.map((item) => item.memoryId));
  const table = prepareSharedClaimTable({
    admitted, authorized,
    audience: c.members.map((name) => ({ userId: userIdOf(name), name: unnamed.has(name) ? null : name })),
    labelOf: new Map(c.members.map((name) => [userIdOf(name), name])),
    otherNames: [...c.members],
    binding,
  });
  const keyOf = new Map([...memoryOf].map(([key, memoryId]) => [memoryId, key]));
  const refOf = new Map([...table.claims.values()].map((entry) => [keyOf.get(entry.memoryId) as string, entry.ref]));
  for (const item of c.items) {
    if (item.claimable !== refOf.has(item.key)) throw new Error(`${c.id}: item ${item.key} is ${item.claimable ? 'claimable but got no ref' : 'not claimable but got a ref'}`);
  }
  const marked = c.reply.replace(/⟦(R[1-9][0-9]*)(@?):/gu, (_whole, key: string, at: string) => {
    const ref = refOf.get(key);
    if (ref === undefined) throw new Error(`${c.id}: span key ${key} has no ref`);
    return `⟦${ref}${at}:`;
  });
  const parsed = parseSharedClaimSpans(marked, table);
  if (!parsed.ok) throw new Error(`${c.id}: the server refuses the text before any check (${parsed.reason})`);
  const rendered = renderSharedClaims(marked, parsed);
  if (!rendered.ok) throw new Error(`${c.id}: the server refuses the rendering (${rendered.reason})`);
  const view = sharedClaimCheckerView(marked, parsed, table);
  const checkBinding: SharedDisclosureCheckBinding = Object.freeze({ ...table.binding, outputDigest: rendered.outputDigest });
  const request: SharedDisclosureCheckRequest = Object.freeze({ binding: checkBinding, reply: view.text, spans: view.spanIds, items: view.items });
  return { table, marked, parsed, rendered: { text: rendered.text, outputDigest: rendered.outputDigest }, view, request, authorized };
}
