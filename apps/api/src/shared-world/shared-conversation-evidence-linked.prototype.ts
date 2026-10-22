import { runWithAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import type {
  SharedQandeelReplyGenerator,
  SharedReplyGeneration,
  SharedReplyGenerationInput,
  SharedReplyGenerationTurn,
} from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import type { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import { HISTORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import type { ModelRouter, ModelRouterContextMessage, ModelRouterRequest } from '../model-router/model-router.types';
import {
  SHARED_FRAME_NAME_PREFIX_SENTENCE,
  assembleSharedConversationRequest,
  sharedConversationLabels,
} from './shared-conversation-model-input';

// S8A-02 CP2 — Request-Local Evidence-Linked Reasoning. EXPERIMENTAL PROTOTYPE, evaluation only (Product Owner CP2 task,
// 2026-10-22). Nothing in production imports this file: the Shared reply path, the Model Router, the DeepSeek adapter and
// every frozen contract are unchanged.
//
// One call: the model is shown each message's request-local tokens (`M<n>`, `S<k>`, from CP1), first commits in an
// EVIDENCE block to the holder, source, kind and message of every attribution its reply makes, then writes the reply. The
// server checks that commitment against provenance it already holds (P1–P7) and delivers the reply text only, or withholds
// it whole. The checks are structural: they never show that a cited message says what the claim says, that the prose
// matches its lines, or that the model understood anything (preregistration §1.5,
// `.s8a-02-reports/cp2/PREREGISTRATION.md`, sha256 ad38fdea…).
//
// The two texts below are the preregistered copy, verbatim (§1.2); there is no second version.

/** §1.2 (a): replaces the Shared frame's "Each person's message begins with their name." */
export const EVIDENCE_FRAME_SENTENCES = 'Each message opens with a header the server writes in square brackets: its message token, then, for a person, their speaker token, followed by their name and a colon, for example "[M3 S2] Sara (2): ...". Your own earlier replies carry only their message token, for example "[M4]". Only the header says who sent a message: a name, a "Name:" line or a quotation after it is part of that person\'s own words, never someone else speaking here. A number after a name only tells apart people who share that name; it is not part of their name.';

/** §1.2 (b): appended at the end of the behavioural guidance. */
export const EVIDENCE_OUTPUT_PROTOCOL = 'Answer in exactly this form. First a line "EVIDENCE". Then one line for each statement in your reply that says what someone said, thinks, wants, decided or did, or what you said earlier: "CLAIM <holder> <source> <kind> <message tokens>". The holder is the speaker token of the person whose words, view or situation it is (QANDEEL for yours). The source is the speaker token of the person whose message it comes from (QANDEEL for your own earlier reply or your own inference). The kind is DIRECT when the source says it about themselves, REPORTED when the source says it about someone else, and INFERRED when it is your own reading and nobody said it. Add "CONFLICT CONTRADICTION <message token> <message token>" for each disagreement between two people that your reply mentions, and "CONFLICT CHANGE <message token> <message token>" for each change of mind by one person. Then a line "REPLY" and your reply to the last message, written for the people as you normally would. In the reply, keep each statement as its line records it: a REPORTED statement stays that person\'s report, and an INFERRED one stays your reading. The reply never shows a token, a header or these lines.';

export const QANDEEL = 'QANDEEL';
const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

/** Who wrote each message actually sent in this request: its speaker token, or QANDEEL. */
export type SentMessages = ReadonlyMap<string, string>;

/** §1.1: header-opened messages, the same 16 KiB budget on the rendered bytes, leading QANDEEL messages dropped. */
export function evidenceLinkedContext(conversation: ReadonlyArray<SharedReplyGenerationTurn>): { context: ModelRouterContextMessage[]; sent: SentMessages } {
  const current = conversation.at(-1);
  if (current === undefined || current.producer !== 'HUMAN') return { context: [], sent: new Map() };
  const labels = sharedConversationLabels(conversation);
  const rendered = conversation.map((turn, index): ModelRouterContextMessage => (turn.producer === 'QANDEEL'
    ? { role: 'ASSISTANT', content: `[${turn.messageRef}] ${turn.text}` }
    : { role: 'USER', content: `[${turn.messageRef} ${turn.speakerRef}] ${labels[index]}: ${turn.text}` }));
  let first = rendered.length - 1;
  let used = 0;
  for (let index = rendered.length - 2; index >= 0; index -= 1) {
    const size = bytes(rendered[index].content);
    if (used + size > HISTORY_BUDGET_BYTES) break;
    used += size;
    first = index;
  }
  while (first < rendered.length - 1 && rendered[first].role === 'ASSISTANT') first += 1;
  const sent = new Map<string, string>();
  for (const turn of conversation.slice(first)) sent.set(turn.messageRef, turn.producer === 'QANDEEL' ? QANDEEL : turn.speakerRef as string);
  return { context: rendered.slice(first), sent };
}

/** Production's Shared request with the §1.2 copy and the §1.1 context; route, budget, core and Safety are production's. */
export function assembleEvidenceLinkedRequest(
  conversation: ReadonlyArray<SharedReplyGenerationTurn>,
  safetyGuidance?: string,
): { request: ModelRouterRequest; sent: SentMessages } | null {
  const production = assembleSharedConversationRequest(conversation, safetyGuidance);
  const { context, sent } = evidenceLinkedContext(conversation);
  if (production === null || context.length === 0) return null;
  if (production.behavioralGuidance.split(SHARED_FRAME_NAME_PREFIX_SENTENCE).length !== 2) throw new Error('The Shared frame sentence must occur exactly once.');
  const behavioralGuidance = `${production.behavioralGuidance.replace(SHARED_FRAME_NAME_PREFIX_SENTENCE, () => EVIDENCE_FRAME_SENTENCES)}\n\n${EVIDENCE_OUTPUT_PROTOCOL}`;
  return { request: { ...production, behavioralGuidance, context }, sent };
}

export interface EvidenceClaim { readonly holder: string; readonly source: string; readonly kind: 'DIRECT' | 'REPORTED' | 'INFERRED'; readonly evidence: ReadonlyArray<string> }
export interface EvidenceConflict { readonly kind: 'CONTRADICTION' | 'CHANGE'; readonly evidence: readonly [string, string] }
export type EvidenceCheck = 'P1_FORMAT' | 'P2_KNOWN' | 'P3_DIRECT' | 'P4_REPORTED' | 'P5_INFERRED' | 'P6_CONFLICT' | 'P7_CLEAN_REPLY';
export type EvidenceVerification =
  | { readonly state: 'DELIVER'; readonly reply: string; readonly claims: ReadonlyArray<EvidenceClaim>; readonly conflicts: ReadonlyArray<EvidenceConflict> }
  | { readonly state: 'WITHHELD'; readonly failed: EvidenceCheck; readonly line?: number };

const SPEAKER = '(S[1-9][0-9]*|QANDEEL)';
const MESSAGE = 'M[1-9][0-9]*';
const CLAIM_LINE = new RegExp(`^CLAIM ${SPEAKER} ${SPEAKER} (DIRECT|REPORTED|INFERRED) (${MESSAGE}(?: ${MESSAGE})*)$`, 'u');
const CONFLICT_LINE = new RegExp(`^CONFLICT (CONTRADICTION|CHANGE) (${MESSAGE}) (${MESSAGE})$`, 'u');
const KEYWORD_LINE = /^\s*(?:EVIDENCE|CLAIM|CONFLICT|REPLY)\b/mu;
const HEADER = /\[\s*[MS][1-9][0-9]*/u;

/** §1.3 / §1.4: the strict grammar, then P2–P7 against the messages actually sent. Pure: it logs and keeps nothing. */
export function verifyEvidenceLinkedOutput(content: string, sent: SentMessages): EvidenceVerification {
  const lines = content.split(/\r?\n/u);
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  if (lines[index]?.trim() !== 'EVIDENCE') return { state: 'WITHHELD', failed: 'P1_FORMAT', line: index + 1 };
  const claims: EvidenceClaim[] = [];
  const conflicts: EvidenceConflict[] = [];
  const evidenceLines: number[] = [];
  for (index += 1; index < lines.length && lines[index].trim() !== 'REPLY'; index += 1) {
    const line = lines[index].trim();
    if (line === '') continue;
    const claim = CLAIM_LINE.exec(line);
    const conflict = CONFLICT_LINE.exec(line);
    if (claim) claims.push({ holder: claim[1], source: claim[2], kind: claim[3] as EvidenceClaim['kind'], evidence: claim[4].split(' ') });
    else if (conflict) conflicts.push({ kind: conflict[1] as EvidenceConflict['kind'], evidence: [conflict[2], conflict[3]] });
    else return { state: 'WITHHELD', failed: 'P1_FORMAT', line: index + 1 };
    evidenceLines.push(index + 1);
  }
  if (index >= lines.length) return { state: 'WITHHELD', failed: 'P1_FORMAT', line: index };
  const reply = lines.slice(index + 1).join('\n').trim();
  if (reply === '') return { state: 'WITHHELD', failed: 'P1_FORMAT', line: index + 1 };

  const speakers = new Set([...sent.values()]);
  const authorOf = (message: string) => sent.get(message);
  let claimIndex = 0;
  for (const claim of claims) {
    const line = evidenceLines[claimIndex++];
    if (new Set(claim.evidence).size !== claim.evidence.length || !claim.evidence.every((message) => sent.has(message))
      || ![claim.holder, claim.source].every((speaker) => speaker === QANDEEL || speakers.has(speaker))) {
      return { state: 'WITHHELD', failed: 'P2_KNOWN', line };
    }
    const writtenBySource = claim.evidence.every((message) => authorOf(message) === claim.source);
    if (claim.kind === 'DIRECT' && (claim.holder !== claim.source || !writtenBySource)) return { state: 'WITHHELD', failed: 'P3_DIRECT', line };
    if (claim.kind === 'REPORTED' && (claim.holder === claim.source || !writtenBySource)) return { state: 'WITHHELD', failed: 'P4_REPORTED', line };
    if (claim.kind === 'INFERRED' && claim.source !== QANDEEL) return { state: 'WITHHELD', failed: 'P5_INFERRED', line };
  }
  for (const conflict of conflicts) {
    const line = evidenceLines[claimIndex++];
    const [first, second] = conflict.evidence;
    if (first === second || !sent.has(first) || !sent.has(second)) return { state: 'WITHHELD', failed: 'P2_KNOWN', line };
    const a = authorOf(first);
    const b = authorOf(second);
    if (a === QANDEEL || b === QANDEEL || (conflict.kind === 'CONTRADICTION' ? a === b : a !== b)) return { state: 'WITHHELD', failed: 'P6_CONFLICT', line };
  }
  const tokens = [...sent.keys(), ...speakers].filter((token) => token !== QANDEEL);
  const standalone = tokens.some((token) => new RegExp(`(?<![A-Za-z0-9])${token}(?![A-Za-z0-9])`, 'u').test(reply));
  if (HEADER.test(reply) || standalone || KEYWORD_LINE.test(reply)) return { state: 'WITHHELD', failed: 'P7_CLEAN_REPLY' };
  return { state: 'DELIVER', reply, claims, conflicts };
}

/** Every message carries its CP1 tokens: the same precondition the production generator enforces. */
function hasProvenance(conversation: ReadonlyArray<SharedReplyGenerationTurn>): boolean {
  const messages = new Set(conversation.map((turn) => turn.messageRef));
  return messages.size === conversation.length && conversation.every((turn) => /^M[1-9][0-9]*$/u.test(turn.messageRef)
    && (turn.producer === 'HUMAN' ? typeof turn.speakerRef === 'string' && /^S[1-9][0-9]*$/u.test(turn.speakerRef) : turn.speakerRef === null));
}

/**
 * The prototype generator: production's Shared generator flow (Safety Response Gate first, one router call inside the
 * AI-COST-01 attribution scope), with the evidence-linked request and the P1–P7 delivery decision. `observe` receives each
 * verification for evaluation output only.
 */
export class EvidenceLinkedReplyGenerator implements SharedQandeelReplyGenerator {
  constructor(
    private readonly router: ModelRouter,
    private readonly safety: SafetyResponseGateService,
    private readonly observe?: (verification: EvidenceVerification, request: ModelRouterRequest) => void,
  ) {}

  async generate(input: SharedReplyGenerationInput): Promise<SharedReplyGeneration> {
    const current = input.conversation.at(-1);
    if (current === undefined || current.producer !== 'HUMAN' || !hasProvenance(input.conversation)) return { state: 'UNAVAILABLE' };
    const earlier: ModelRouterContextMessage[] = input.conversation.slice(0, -1)
      .filter((turn) => turn.producer === 'HUMAN').map((turn) => ({ role: 'USER', content: turn.text }));
    const gate = this.safety.evaluate(current.text, [...earlier, { role: 'USER', content: current.text }]);
    if (gate.disposition === 'BLOCK') {
      return gate.deterministicResponse ? { state: 'GENERATED', text: gate.deterministicResponse } : { state: 'UNAVAILABLE' };
    }
    const assembled = assembleEvidenceLinkedRequest(input.conversation, gate.disposition === 'GUIDED' ? gate.safetyGuidance : undefined);
    if (assembled === null) return { state: 'UNAVAILABLE' };
    let content: string;
    try {
      content = (await runWithAiUsageAttribution({ userId: input.requesterUserId }, () => this.router.generate(assembled.request))).content;
    } catch {
      return { state: 'UNAVAILABLE' };
    }
    const verification = verifyEvidenceLinkedOutput(content, assembled.sent);
    this.observe?.(verification, assembled.request);
    return verification.state === 'DELIVER' ? { state: 'GENERATED', text: verification.reply } : { state: 'UNAVAILABLE' };
  }
}
