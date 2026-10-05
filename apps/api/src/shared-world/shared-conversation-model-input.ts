/**
 * S4-02 — the ONE server-owned Shared model-input assembler (S4-02 §7).
 *
 * It turns the exact-World conversation the Connected Worlds composition handed over — already reduced to what every
 * current recipient may see, hidden and deleted material excluded — into one provider-neutral Model Router request:
 *
 *   - the frozen Behavioral Response Policy (TEXT_V1), unchanged, plus a short STRUCTURAL frame that tells the model
 *     the truth about where it is: a Shared World conversation between named people and QANDEEL, with nothing known
 *     about them beyond what is written there (CW2-03 §41, §43; Product definition §10). It adds no new behaviour law;
 *   - the Safety Response Gate's guidance when it guided this turn;
 *   - producer attribution by legitimate visible Name only — no internal identifier, audience, authority or provenance
 *     reaches the provider;
 *   - the current message always, and older history newest-first within the frozen QIR-004 history budget.
 *
 * It never adds Memory, Human Intelligence, Hypothesis, Recommendation or Question context: Personal intelligence is
 * not Shared context (S4-02 §1.3). Pure; no I/O.
 */
import { TEXT_V1_BEHAVIORAL_GUIDANCE } from '../conversation/behavioral-response-policy.service';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { HISTORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import type { ModelRouterContextMessage, ModelRouterRequest } from '../model-router/model-router.types';

export interface SharedConversationTurn {
  readonly producer: 'HUMAN' | 'QANDEEL';
  readonly authorName: string | null;
  readonly text: string;
}

export const SHARED_CONVERSATION_FRAME = [
  'This is a Shared World conversation between the people named below and you, QANDEEL. You take part in it as one participant.',
  'Each person\'s message begins with their name. Address the people present; do not take one person\'s side by default.',
  'Only what is written in this conversation is shared here. You know nothing else about these people, and you never imply otherwise.',
].join('\n');

/** The label a human message carries for the model: the person's legitimate Name, never an identifier. */
export const UNNAMED_PARTICIPANT = 'A participant';

const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

function render(turn: SharedConversationTurn): ModelRouterContextMessage {
  return turn.producer === 'QANDEEL'
    ? { role: 'ASSISTANT', content: turn.text }
    : { role: 'USER', content: `${turn.authorName ?? UNNAMED_PARTICIPANT}: ${turn.text}` };
}

/**
 * The bounded context: the current (last) message always; earlier messages newest-first while they fit the history
 * budget; consecutive same-role messages merged (several people may speak before QANDEEL); leading QANDEEL lines dropped
 * so the provider context opens with a person.
 */
export function boundedSharedContext(conversation: ReadonlyArray<SharedConversationTurn>): ModelRouterContextMessage[] {
  const current = conversation.at(-1);
  if (current === undefined || current.producer !== 'HUMAN') return [];
  const kept: SharedConversationTurn[] = [current];
  let used = 0;
  for (let index = conversation.length - 2; index >= 0; index -= 1) {
    const size = bytes(render(conversation[index]).content);
    if (used + size > HISTORY_BUDGET_BYTES) break;
    used += size;
    kept.unshift(conversation[index]);
  }
  const merged: ModelRouterContextMessage[] = [];
  for (const message of kept.map(render)) {
    const last = merged.at(-1);
    if (last !== undefined && last.role === message.role) merged[merged.length - 1] = { role: last.role, content: `${last.content}\n\n${message.content}` };
    else merged.push(message);
  }
  while (merged.length > 0 && merged[0].role === 'ASSISTANT') merged.shift();
  return merged;
}

export function assembleSharedConversationRequest(
  conversation: ReadonlyArray<SharedConversationTurn>,
  safetyGuidance?: string,
): ModelRouterRequest | null {
  const context = boundedSharedContext(conversation);
  const current = conversation.at(-1);
  if (context.length === 0 || current === undefined) return null;
  const path = decideFastDeepRoute(current.text).path;
  return {
    task: 'CONVERSATIONAL_RESPONSE',
    path,
    complexity: path === 'DEEP' ? 'HIGH' : 'LOW',
    behavioralGuidance: `${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${SHARED_CONVERSATION_FRAME}`,
    ...(safetyGuidance === undefined ? {} : { safetyGuidance }),
    context,
    locale: 'und',
    modality: 'TEXT',
    latencyBudgetMs: path === 'DEEP' ? 10000 : 3000,
    costBudget: 'LOW',
    safetyLevel: 'STANDARD',
  };
}
