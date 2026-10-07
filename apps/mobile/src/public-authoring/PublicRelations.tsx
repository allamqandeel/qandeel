/**
 * S5-03C — explicit Public relations, managed inside the Public authoring workspace (no second destination, no graph
 * screen, no map of its own).
 *
 *   PublicRelationsSection   on the workspace: the requests that wait on the reader's acceptance (accept / decline), and
 *                            the reader's own Experiences in Public World now, each opening its relations;
 *   PublicRelationsScreen    one own served Experience: requests received for it, its current relations (remove), its
 *                            own waiting requests (cancel), and asking for a relation to an Experience found by the SAME
 *                            Public search.
 *
 * Everything drawn is what the server served on the last read, and every act re-reads it. Another Experience is named by
 * its reviewed meaning only — never its publisher, place, region, nearness or anything ranked. Nothing here suggests a
 * relation: the reader asks, and it exists only once the other side accepts. Every word is the S5-03C copy module's.
 */
import { useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { PublicRelation } from '../runtime-entry';
import { PUBLIC_RELATION_SEARCH_MAX, type PublicAuthoringController, type PublicAuthoringState } from './public-authoring-controller';
import { fill, publicRelationCopy, type PublicRelationCopy } from './relation-copy';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;

interface Shared {
  readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly copy: PublicRelationCopy; readonly writing: 'rtl' | 'ltr';
  readonly busy: boolean;
}

function Heading({ text, s, testID }: { readonly text: string; readonly s: Shared; readonly testID?: string }) {
  return (
    <Text testID={testID} accessibilityRole="header" accessibilityLanguage={s.language}
      style={{ ...typeStyle('metadata'), color: s.palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Line({ text, s, role = 'supporting', testID, color }: { readonly text: string; readonly s: Shared; readonly role?: 'supporting' | 'body'; readonly testID?: string; readonly color?: string }) {
  return (
    <Text testID={testID} accessibilityLanguage={s.language}
      style={{ ...typeStyle(role), color: color ?? s.palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Action({ label, onPress, s, testID, emphasis = false }: {
  readonly label: string; readonly onPress: () => void; readonly s: Shared; readonly testID: string; readonly emphasis?: boolean;
}) {
  return (
    <Control palette={s.palette} language={s.language} accessibilityLabel={label} accessibilityState={{ busy: s.busy, disabled: s.busy }} onPress={onPress} testID={testID}
      style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: emphasis ? s.palette.field : undefined, opacity: s.busy ? BUSY_OPACITY : 1 }}>
      <Text style={{ ...typeStyle('action'), color: emphasis ? s.palette.primary : s.palette.restInk, writingDirection: s.writing }}>{label}</Text>
    </Control>
  );
}

/** One row: the other Experience's reviewed meaning, an optional line naming the reader's own, then the side's acts. */
function RelationRow({ relation, own, s, controller }: {
  readonly relation: PublicRelation; readonly own: string | null; readonly s: Shared; readonly controller: PublicAuthoringController;
}) {
  return (
    <View testID={`qandeel-public-relation-${relation.state.toLowerCase()}`} style={{ paddingVertical: 6 }}>
      <Line text={relation.other.meaning} s={s} role="body" color={s.palette.primary} testID="qandeel-public-relation-other" />
      {own !== null ? <Line text={fill(s.copy.withYours, own)} s={s} testID="qandeel-public-relation-own" /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingStart: ROW_START - 16, columnGap: 4 }}>
        {relation.state === 'REQUEST_RECEIVED' ? (
          <>
            <Action label={s.copy.accept} onPress={() => controller.acceptRelation(relation.relationId)} s={s} emphasis testID="qandeel-public-relation-accept" />
            <Action label={s.copy.decline} onPress={() => controller.declineRelation(relation.relationId)} s={s} testID="qandeel-public-relation-decline" />
          </>
        ) : relation.state === 'REQUEST_SENT' ? (
          <Action label={s.copy.cancel} onPress={() => controller.cancelRelation(relation.relationId)} s={s} testID="qandeel-public-relation-cancel" />
        ) : (
          <Action label={s.copy.remove} onPress={() => controller.removeRelation(relation.relationId)} s={s} testID="qandeel-public-relation-remove" />
        )}
      </View>
    </View>
  );
}

export interface PublicRelationsProps {
  readonly state: PublicAuthoringState;
  readonly controller: PublicAuthoringController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}

/** The workspace's relation section. Nothing is drawn when the reader has nothing in Public World and no request waits. */
export function PublicRelationsSection({ state, controller, language, palette }: PublicRelationsProps) {
  const copy = publicRelationCopy(language);
  const s: Shared = { palette, language, copy, writing: language === 'ar' ? 'rtl' : 'ltr', busy: state.busy };
  const meaningOf = (id: string) => state.relationExperiences.find((e) => e.id === id)?.meaning ?? null;
  const received = state.relations.filter((r) => r.state === 'REQUEST_RECEIVED');
  return (
    <View testID="qandeel-public-relations-section">
      {received.length > 0 ? <Heading text={copy.receivedHeading} s={s} testID="qandeel-public-relations-received" /> : null}
      {received.map((relation) => (
        <RelationRow key={`${relation.relationId}:${relation.experienceId}`} relation={relation} own={meaningOf(relation.experienceId)} s={s} controller={controller} />
      ))}
      {state.relationExperiences.length > 0 ? <Heading text={copy.relationsHeading} s={s} testID="qandeel-public-relations-experiences" /> : null}
      {state.relationExperiences.map((experience) => (
        <View key={experience.id} style={{ paddingStart: ROW_START - 16 }}>
          <Action label={experience.meaning} onPress={() => controller.openRelations(experience.id)} s={s} testID="qandeel-public-relations-experience" />
        </View>
      ))}
    </View>
  );
}

/** One own served Experience's relations, and asking for a new one. */
export function PublicRelationsScreen({ state, controller, language, palette }: PublicRelationsProps) {
  const copy = publicRelationCopy(language);
  const s: Shared = { palette, language, copy, writing: language === 'ar' ? 'rtl' : 'ltr', busy: state.busy };
  const [query, setQuery] = useState('');
  const experienceId = state.experienceId;
  const own = state.relationExperiences.find((e) => e.id === experienceId) ?? null;
  if (own === null) return null;
  const mine = state.relations.filter((r) => r.experienceId === own.id);
  const groups: ReadonlyArray<{ readonly state: PublicRelation['state']; readonly heading: string }> = [
    { state: 'REQUEST_RECEIVED', heading: copy.receivedHeading },
    { state: 'ACTIVE', heading: copy.activeHeading },
    { state: 'REQUEST_SENT', heading: copy.sentHeading },
  ];
  const search = state.relationSearch;
  return (
    <View testID="qandeel-public-relations">
      <Line text={own.meaning} s={s} role="body" color={s.palette.primary} testID="qandeel-public-relations-own" />
      {groups.map((group) => {
        const rows = mine.filter((r) => r.state === group.state);
        if (rows.length === 0) return null;
        return (
          <View key={group.state}>
            <Heading text={group.heading} s={s} />
            {rows.map((relation) => <RelationRow key={relation.relationId} relation={relation} own={null} s={s} controller={controller} />)}
          </View>
        );
      })}
      <Heading text={copy.requestHeading} s={s} />
      <Line text={copy.requestHint} s={s} testID="qandeel-public-relations-hint" />
      <View style={{ paddingHorizontal: ROW_START - 12, paddingVertical: 6 }}>
        <TextInput testID="qandeel-public-relations-search" value={query} onChangeText={setQuery}
          onSubmitEditing={() => { Keyboard.dismiss(); controller.searchRelation(query); }} returnKeyType="search" maxLength={PUBLIC_RELATION_SEARCH_MAX}
          editable={!state.busy} accessibilityLabel={copy.searchLabel} placeholder={copy.searchLabel} placeholderTextColor={palette.tertiary}
          accessibilityLanguage={language} selectionColor={palette.primary} cursorColor={palette.primary}
          style={{ ...typeStyle('body'), minHeight: 44, color: palette.primary, backgroundColor: palette.field, borderRadius: 22,
            paddingHorizontal: 16, writingDirection: s.writing, textAlign: s.writing === 'rtl' ? 'right' : 'left' }} />
      </View>
      {search.status === 'SEARCHING'
        ? <View testID="qandeel-public-relations-searching" accessible accessibilityState={{ busy: true }} style={{ minHeight: MIN_TARGET }} /> : null}
      {search.status === 'NONE' ? <Line text={copy.noResults} s={s} testID="qandeel-public-relations-no-results" /> : null}
      {search.status === 'UNAVAILABLE' ? <Line text={copy.actionUnavailable} s={s} testID="qandeel-public-relations-search-unavailable" /> : null}
      {search.results.map((entry) => (
        <View key={entry.id} testID="qandeel-public-relations-result" style={{ paddingVertical: 6 }}>
          <Line text={entry.meaning} s={s} role="body" color={s.palette.primary} />
          <View style={{ paddingStart: ROW_START - 16, flexDirection: 'row' }}>
            <Action label={copy.requestAction} onPress={() => controller.requestRelation(entry.id)} s={s} emphasis testID="qandeel-public-relations-request" />
          </View>
        </View>
      ))}
    </View>
  );
}
