/**
 * S4-02 — the ONE server-owned Shared model-input assembler (S4-02 §7).
 *
 * It turns the exact-World conversation the Connected Worlds composition handed over — already reduced to what every
 * current recipient may see, hidden and deleted material excluded — into one provider-neutral Model Router request:
 *
 *   - the frozen Behavioral Response Policy (TEXT_V1), unchanged, plus a short STRUCTURAL frame that tells the model
 *     the truth about where it is: a Shared World conversation between named people and QANDEEL, with nothing known
 *     about them beyond what is written there (CW2-03 §41, §43; Product definition §10). It adds no new behaviour law;
 *   - after that unchanged prefix, the ONE QANDEEL personality in its world-neutral form, and on a Safety GUIDED turn
 *     the approved humour suspension (the ACE-SP-01 controlled amendment). It reads no Personal preference, person or
 *     state, so the requester gains no authority over the others and nothing about anyone is kept;
 *   - the Safety Response Gate's guidance when it guided this turn;
 *   - producer attribution by legitimate visible Name only — no internal identifier, audience, authority or provenance
 *     reaches the provider;
 *   - the current message always, and older history newest-first within the frozen QIR-004 history budget.
 *
 * It never adds Memory, Human Intelligence, Hypothesis, Recommendation or Question context: Personal intelligence is
 * not Shared context (S4-02 §1.3). Pure; no I/O.
 */
import { TEXT_V1_BEHAVIORAL_GUIDANCE, withWorldNeutralPersonality } from '../conversation/behavioral-response-policy.service';
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
 * The bounded context with one provider message per turn: the current (last) message always; earlier messages
 * newest-first while they fit the history budget; leading QANDEEL lines dropped so the provider context opens with a
 * person.
 *
 * S8A-02 (Product Owner Shared Attribution Engineering Decision, 2026-10-21): this is the EXPERIMENTAL candidate (a-1) —
 * each person's message stays its own message under the same visible Name, and no identifier is added. Production does
 * not send it: `assembleSharedConversationRequest` still sends `boundedSharedContext`, which is exactly this output with
 * consecutive same-role messages merged, so the two can differ only in where one provider message ends.
 */
export function separatedSharedContext(conversation: ReadonlyArray<SharedConversationTurn>): ModelRouterContextMessage[] {
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
  const messages = kept.map(render);
  while (messages.length > 0 && messages[0].role === 'ASSISTANT') messages.shift();
  return messages;
}

/** Consecutive same-role messages joined into one with a blank line between them (several people may speak before QANDEEL). */
export function mergeConsecutiveSameRole(messages: ReadonlyArray<ModelRouterContextMessage>): ModelRouterContextMessage[] {
  const merged: ModelRouterContextMessage[] = [];
  for (const message of messages) {
    const last = merged.at(-1);
    if (last !== undefined && last.role === message.role) merged[merged.length - 1] = { role: last.role, content: `${last.content}\n\n${message.content}` };
    else merged.push(message);
  }
  return merged;
}

/**
 * The bounded context production sends: the separated context with consecutive same-role messages merged. Leading
 * QANDEEL lines are dropped before the merge, which leaves the same result as dropping them after it.
 */
export function boundedSharedContext(conversation: ReadonlyArray<SharedConversationTurn>): ModelRouterContextMessage[] {
  return mergeConsecutiveSameRole(separatedSharedContext(conversation));
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
    behavioralGuidance: withWorldNeutralPersonality(`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${SHARED_CONVERSATION_FRAME}`, Boolean(safetyGuidance)),
    ...(safetyGuidance === undefined ? {} : { safetyGuidance }),
    context,
    locale: 'und',
    modality: 'TEXT',
    latencyBudgetMs: path === 'DEEP' ? 10000 : 3000,
    costBudget: 'LOW',
    safetyLevel: 'STANDARD',
  };
}
