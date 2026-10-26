// S8A-04 CP3 — the two model-facing texts of Personal Knowledge in a Shared World, verbatim as they run. No person sees them.
//
// COPY GATE. CG-6a / CG-6b were APPROVED 6/6 by the Product Owner on 2026-10-25 (amendment §7, §10.5); they are kept below
// as `_V1`, the record CP3-D V1 ran with, and no longer run. Controlled Amendment R4 (§11, 2026-10-26) replaces them with
// CG-6a′ / CG-6b′ for the claim spans: PROPOSED — NOT APPROVED. They are wired here so the free tests exercise the exact
// bytes; no paid call runs with them before the Product Owner approves them and a budget. A linguistic correction at the
// gate replaces these strings only.

import { escapeDeepSeekData } from '../model-router/providers/deepseek/deepseek-client';

/** CG-6a (APPROVED 2026-10-25; the V1 record, no longer sent). */
export const SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS_V1 = 'MEMBER KNOWLEDGE. Each item below belongs to the member named by its token, who allowed QANDEEL to use it in this World and to mention it as theirs. Use an item only when it genuinely helps this turn. You may mention it naturally as that member\'s own, in your own words. Never say or imply that the member told you anything privately or gave you permission, never refer to any conversation, memory or record of yours about them, and never say when or where you learned it. Never quote them. Never add anything the item does not say. Never apply an item to anyone other than its owner. If no item helps, ignore them all.';

/** CG-6b (APPROVED 2026-10-25; the V1 record, no longer sent). */
export const SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS_V1 = 'You check one reply written by QANDEEL in a group. You are given that reply and the private items of ONE member (OWNER). For each item, report only what the reply does with it. findings: any of DIRECT_PROTECTED_SOURCE_FACT (the reply states the item\'s content), SOURCE_SPECIFIC_ATTRIBUTION (the reply ties it to a person), PRIVATE_QUOTE (the reply presents words as the owner\'s own words), SEALED_PROVENANCE_DISCLOSURE (the reply says or implies how, when or where QANDEEL learned it, that it was told privately, that permission was given, or that QANDEEL has a conversation, memory or record about the owner). attributedTo: OWNER, OTHER (said of anyone else), NONE (not tied to anyone) or UNCLEAR. unsupportedOwnerClaim: true if the reply states anything about the owner that the item does not say (advice and suggestions are not claims). When unsure, choose the stricter answer. Answer only the JSON object of the schema.';

/** CG-6a′ (PROPOSED — R4-5), to the reply generator, before the item block. */
export const SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS = 'MEMBER KNOWLEDGE. Each item below belongs to the member named with it, who allowed QANDEEL to use it in this World and to mention it as theirs. Use any item freely whenever it helps you think, choose or suggest; using an item needs no mark. Only when you STATE an item as a fact about its owner, write that statement inside its span, in your own words and without their name, which QANDEEL adds: ⟦REF: what is true of them⟧, or ⟦REF@: you …⟧ to say it to them. One span per item; nothing about anyone else inside a span; nothing the item does not say. Never state an item\'s content about anyone else, about "someone here", or to the person you are talking to, except inside its own span. An item shown without REF may only shape your reply; never state it. Never say or imply that the member told you anything privately or gave you permission, never refer to any conversation, memory or record of yours about them, never say when or where you learned it, and never quote them. If no item helps, ignore them all.';

/** CG-6b′ (PROPOSED — R4-5), the checker's system text; the reply and the items follow as data. */
export const SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS = 'You check one reply written by QANDEEL in a group, for private items only. A span ⟦Kn: …⟧ is a statement about the owner of item Kn; who that owner is does not matter to you. For each span answer ENTAILED (it says only what item Kn says, about its subject alone), ADDS (it adds a personal fact the item does not say), OTHER_ITEM (it states another item\'s content), OTHER_PERSON (it is also about someone else, e.g. "and she too") or UNCLEAR. Then list every passage OUTSIDE the spans that states or clearly implies an item\'s content as true of any person, of the person addressed, of "someone" or of the group; copy each passage exactly. Suggestions, plans and questions shaped by an item are not statements. Then list every passage, anywhere, that quotes the owner or says or implies how, when or where QANDEEL learned an item, that it was told privately, or that permission was given. Answer only the JSON object of the schema.';

/**
 * The reply's member-knowledge block: CG-6a′, then the escaped items in their container, each with its owner's label and,
 * only when it may be stated, its REF. Null without items.
 */
export function sharedMemberKnowledgeBlock(items: ReadonlyArray<{ readonly owner: string; readonly ref: string | null; readonly item: string }>): string | null {
  if (items.length === 0) return null;
  const data = items.map((entry) => (entry.ref === null ? { member: entry.owner, item: entry.item } : { member: entry.owner, ref: entry.ref, item: entry.item }));
  return `${SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS}\n<member_knowledge>${escapeDeepSeekData(data)}</member_knowledge>`;
}
