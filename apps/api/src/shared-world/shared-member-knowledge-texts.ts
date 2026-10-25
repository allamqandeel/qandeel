// S8A-04 CP3 — the two model-facing texts of Personal Knowledge in a Shared World (amendment §7, CG-6a / CG-6b), verbatim
// as they will run. No person sees them.
//
// COPY GATE: PROPOSED — NOT APPROVED. The Product Owner's authorization of 2026-10-25 leaves all six CP3 texts unapproved
// until the Copy Gate before CP3-C; they are wired here so the free tests exercise the exact bytes, and no paid call runs
// with them before the gate and a budget approval. A linguistic correction at the gate replaces these strings only.

import { escapeDeepSeekData } from '../model-router/providers/deepseek/deepseek-client';

/** CG-6a (PROPOSED), to the reply generator, before the item block. */
export const SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS = 'MEMBER KNOWLEDGE. Each item below belongs to the member named by its token, who allowed QANDEEL to use it in this World and to mention it as theirs. Use an item only when it genuinely helps this turn. You may mention it naturally as that member\'s own, in your own words. Never say or imply that the member told you anything privately or gave you permission, never refer to any conversation, memory or record of yours about them, and never say when or where you learned it. Never quote them. Never add anything the item does not say. Never apply an item to anyone other than its owner. If no item helps, ignore them all.';

/** CG-6b (PROPOSED), the judge's system text; the reply, the owner's token, the other members' tokens and the items follow as data. */
export const SHARED_DISCLOSURE_JUDGE_INSTRUCTIONS = 'You check one reply written by QANDEEL in a group. You are given that reply and the private items of ONE member (OWNER). For each item, report only what the reply does with it. findings: any of DIRECT_PROTECTED_SOURCE_FACT (the reply states the item\'s content), SOURCE_SPECIFIC_ATTRIBUTION (the reply ties it to a person), PRIVATE_QUOTE (the reply presents words as the owner\'s own words), SEALED_PROVENANCE_DISCLOSURE (the reply says or implies how, when or where QANDEEL learned it, that it was told privately, that permission was given, or that QANDEEL has a conversation, memory or record about the owner). attributedTo: OWNER, OTHER (said of anyone else), NONE (not tied to anyone) or UNCLEAR. unsupportedOwnerClaim: true if the reply states anything about the owner that the item does not say (advice and suggestions are not claims). When unsure, choose the stricter answer. Answer only the JSON object of the schema.';

/** The reply's member-knowledge block: CG-6a, then the escaped items in their container. Null without items. */
export function sharedMemberKnowledgeBlock(items: ReadonlyArray<{ readonly owner: string; readonly item: string }>): string | null {
  if (items.length === 0) return null;
  return `${SHARED_MEMBER_KNOWLEDGE_INSTRUCTIONS}\n<member_knowledge>${escapeDeepSeekData(items.map((entry) => ({ member: entry.owner, item: entry.item })))}</member_knowledge>`;
}
