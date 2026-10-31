// S8A-03 Living Personal Memory — the knowledge picture, projected at READ time from the user's live Memories.
//
// There is no stored summary: every turn the picture is projected again from the Memories that are eligible right now
// (migration 0172 personal_knowledge_sources_v1), so a correction, a forget, a disable or an expiry is reflected the
// moment it happens and nothing derived from a withdrawn Memory can survive it. Pure: no I/O, no model, no clock.
//
//   CORE     what the user told QANDEEL about who they are, present on every turn, in priority order:
//              1. their current facts with a slot (home, work, employer, study, marital status, smoking) - two or more
//                 in one slot are ONE UNSETTLED unit, served whole or not at all (CP2 R1);
//              2. their family and relationships: their own relationship statements, their own facts that name their
//                 family, and statements about one of their family (OTHER, named in the first person - «مراتي», «ابني»)
//                 which stay about that person (SOMEONE_ELSE) and are never the user's own fact;
//              3. their goals;
//              4. their other stated facts and preferences, slot or not.
//   CURRENT  their stated states, plans and decisions, last stated first, with the date they last stated it. Not
//            mentioning one again never ends it; only the user's explicit ending does (0172 ENDED -> PAST).
//   Never here: anything PAST or ended (still recallable, marked HISTORICAL), an unattributed Memory, someone else's
//   fact that does not name the user's family, an Interaction Preference or a Derived Insight (the read excludes them),
//   and anything not stated or confirmed by the user.
// RECALLED (the existing retrieval) is composed by the retriever around this picture, within the same MEMORY budget.
import type { ModelRouterMemoryContext } from '../model-router/model-router.types';
import { namesFamilyMember, statesPast } from '../personal-understanding/personal-understanding-capture.verifier';
import type { PersonalKnowledgeSource } from './memory.types';

/** The most rows one knowledge read returns (0172 caps it at 120); its order drops the least central rows first. */
export const PERSONAL_KNOWLEDGE_SOURCE_LIMIT = 120;
/** Item bounds of the two always-present tiers. The byte budget may serve fewer; it never serves more. */
export const MAX_CORE_ITEMS = 10;
export const MAX_CURRENT_ITEMS = 6;

export type KnowledgeTier = 'CORE' | 'CURRENT';

/** One served unit: a single item, or a whole UNSETTLED slot. */
export interface KnowledgeUnit {
  readonly tier: KnowledgeTier;
  readonly ids: readonly string[];
  readonly items: readonly ModelRouterMemoryContext[];
}

export interface PersonalKnowledgePicture {
  /** CORE units in priority order, within MAX_CORE_ITEMS. */
  readonly core: readonly KnowledgeUnit[];
  /** CURRENT units, last stated first, within MAX_CURRENT_ITEMS. */
  readonly current: readonly KnowledgeUnit[];
  /** Every read Memory that is PAST or ended: if recalled, it is served as HISTORICAL. */
  readonly historical: ReadonlySet<string>;
}

// S8B-03 (E10): the personal knowledge picture includes what the user said by voice, with its source.
const STATED_SOURCES = new Set(['USER_STATED', 'USER_CONFIRMED', 'MACHINE_ASR']);

/** Whether a Memory is history, not the present: ended by the user, PAST in its index, or said in the past tense. */
export function isHistoricalKnowledge(row: Pick<PersonalKnowledgeSource, 'ended' | 'temporal' | 'content'>): boolean {
  return row.ended || row.temporal === 'PAST' || statesPast(row.content);
}

export function projectPersonalKnowledge(rows: readonly PersonalKnowledgeSource[]): PersonalKnowledgePicture {
  const historical = new Set(rows.filter(isHistoricalKnowledge).map((row) => row.id));
  const live = rows.filter((row) => STATED_SOURCES.has(row.source) && !historical.has(row.id));
  const self = live.filter((row) => row.subject === 'SELF');
  const isCurrentState = (row: PersonalKnowledgeSource) =>
    row.type === 'TEMPORARY_STATE' || row.type === 'DECISION_COMMITMENT' ||
    (row.type !== 'GOAL' && (row.temporal === 'PLANNED' || row.temporal === 'TEMPORARY'));
  const coreSelf = self.filter((row) => !isCurrentState(row));

  const slotted = coreSelf.filter((row) => row.slot !== null && row.temporal === 'CURRENT').sort(byStanding);
  const family = live.filter((row) => !isCurrentState(row) && (
    (row.subject === 'SELF' && (row.type === 'RELATIONSHIP_CONTEXT' || (row.type === 'PERSONAL_FACT' && namesFamilyMember(row.content)))) ||
    // Open Understanding (amendment §10): someone else's fact is placed by its grounded person label, not by a kin-word list.
    (row.subject === 'OTHER' && (personOf(row) !== undefined || ((row.type === 'RELATIONSHIP_CONTEXT' || row.type === 'PERSONAL_FACT') && namesFamilyMember(row.content))))
  )).sort(byStanding);
  const goals = coreSelf.filter((row) => row.type === 'GOAL').sort(byStanding);
  const other = coreSelf.filter((row) => row.type === 'PERSONAL_FACT' || row.type === 'STABLE_PREFERENCE').sort(byStanding);

  const core: KnowledgeUnit[] = [];
  const placed = new Set<string>();
  let coreItems = 0;
  for (const row of [...slotted, ...family, ...goals, ...other]) {
    if (placed.has(row.id)) continue;
    // An UNSETTLED current fact is never served alone: every other UNSETTLED Memory of its slot comes with it, or none -
    // so a slot with any member this picture may not show (not stated by the user) is not served here at all.
    const unit = row.unsettled && row.slot !== null ? rows.filter((other) => other.unsettled && other.slot === row.slot) : [row];
    const members = unit.filter((member) => slotted.includes(member) || member === row);
    unit.forEach((member) => placed.add(member.id));
    if (members.length < unit.length || coreItems + members.length > MAX_CORE_ITEMS) continue;
    coreItems += members.length;
    core.push({
      tier: 'CORE',
      ids: members.map((member) => member.id),
      items: members.map((member) => ({
        type: member.type, content: member.content, source: member.source, about: aboutOf(member),
        ...(personOf(member) !== undefined ? { person: personOf(member) } : {}),
        ...(member.unsettled && member.slot !== null ? { standing: 'UNSETTLED' as const } : {}),
        tier: 'CORE' as const,
      })),
    });
  }

  const current = self.filter(isCurrentState)
    .sort((left, right) => right.last_stated_at.localeCompare(left.last_stated_at) || left.id.localeCompare(right.id))
    .slice(0, MAX_CURRENT_ITEMS)
    .map((row): KnowledgeUnit => ({
      tier: 'CURRENT',
      ids: [row.id],
      items: [{
        type: row.type, content: row.content, source: row.source, about: 'USER', tier: 'CURRENT',
        stated: row.last_stated_at.slice(0, 10),
      }],
    }));

  return { core, current, historical };
}

/** Restated more often first, then stated more recently, then more important; the id breaks ties. */
function byStanding(left: PersonalKnowledgeSource, right: PersonalKnowledgeSource): number {
  return right.restated_count - left.restated_count ||
    right.last_stated_at.localeCompare(left.last_stated_at) ||
    right.importance - left.importance ||
    left.id.localeCompare(right.id);
}

/** The person label of an OTHER row («سلمى (مراتي)»), or undefined (0173). */
export function personOf(row: Pick<PersonalKnowledgeSource, 'subject' | 'person_name' | 'person_relation'>): string | undefined {
  if (row.subject !== 'OTHER' || (!row.person_name && !row.person_relation)) return undefined;
  return [row.person_name, row.person_relation ? `(${row.person_relation})` : null].filter(Boolean).join(' ');
}

function aboutOf(row: PersonalKnowledgeSource): NonNullable<ModelRouterMemoryContext['about']> {
  return row.subject === 'SELF' ? 'USER' : row.subject === 'OTHER' ? 'SOMEONE_ELSE' : 'NOT_RECORDED';
}
