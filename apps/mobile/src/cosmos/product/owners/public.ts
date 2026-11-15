/**
 * COSMOS-INT-01 Slice B — the Public World's owner: the COSMOS stage over the PRODUCTION `PublicFieldController` the
 * Public area created (S5-03B), entered and will retire. Every act goes to that controller; every answer is read back.
 *
 * What the stage shows is what the old field showed, in the stage's own look:
 *   - every served Experience, dyed by its own identity (never a category, rank or popularity signal);
 *   - the reader's chosen section (S8A-05 CP1): everything outside it recedes, the field stays where it is;
 *   - the open search's results (S5-03B D2): while results are shown, the other Experiences recede, so the results
 *     stand out exactly as the old field's RESULT presence did;
 *   - the focused Experience's explicit relations (S5-03C) as ties — each with the approved accessible name
 *     ("Relation with {other}") the old line carried — and its served content count as motes.
 * Nothing ranks, counts or lines up.
 */

import type { ChromeLanguage } from '../../../orientation-chrome';
import { fill, publicRelationCopy } from '../../../public-authoring/relation-copy';
import type { PublicFieldController } from '../../../public-world/field/public-field-controller';
import { publicEntryLabel } from '../../../runtime-entry';
import { publicScene } from '../../core/adapters';
import { compileStage, type Stage } from '../../core/stage';
import { ORIGIN, createFieldOwner, memo, type CosmosWorldOwner } from '../owner-core';

export function createPublicCosmosOwner(controller: PublicFieldController, language: ChromeLanguage): CosmosWorldOwner {
  const rtl = language === 'ar';
  const words = publicRelationCopy(language);
  const related = () => {
    const panel = controller.getState().focus?.panel;
    return panel?.status === 'SERVED' ? panel.experience.relations.map((relation) => relation.other.id) : [];
  };
  /** S5-03C: the served relations of the focused Experience, at NEAR only, each named by the OTHER Experience as served. */
  const relations = () => {
    const state = controller.getState();
    const panel = state.focus?.panel;
    if (state.camera?.depth !== 'NEAR' || panel?.status !== 'SERVED') return [];
    return panel.experience.relations.map((relation) => ({ id: relation.relationId, label: fill(words.relationWith, publicEntryLabel(relation.other)) }));
  };
  /** The served panel's real content item count, once served: the motes about the focused Experience. */
  const motes = () => {
    const panel = controller.getState().focus?.panel;
    return panel?.status === 'SERVED' ? panel.experience.content.length : undefined;
  };
  /** The results the open search shows (the old field's `results` input), or null while none are shown. */
  const results = () => {
    const { search } = controller.getState();
    return search.open && search.status === 'RESULTS' ? search.results : null;
  };
  const compiled = memo<readonly unknown[], Stage>(() => {
    const state = controller.getState();
    const scene = publicScene({ entries: state.entries, focusId: state.focus?.id ?? null, relatedIds: related(), section: state.section.key, focusMotes: motes(), rtl }, ORIGIN);
    const shown = results();
    if (shown === null) return compileStage(scene);
    const keep = new Set(shown.map((entry) => entry.id));
    const receded = new Set(scene.receded ?? []);
    for (const entry of state.entries) if (!keep.has(entry.id)) receded.add(entry.id);
    return compileStage({ ...scene, receded });
  });
  return createFieldOwner({
    world: 'PUBLIC',
    read: () => {
      const state = controller.getState();
      return { status: state.status, entries: state.entries, camera: state.camera, focusId: state.focus?.id ?? null };
    },
    subscribe: (listener) => controller.subscribe(listener),
    setEnvelope: (envelope) => controller.setEnvelope(envelope),
    pan: (tx, ty) => controller.pan(tx, ty),
    step: (direction, focal) => controller.step(direction, focal),
    tapField: (x, y) => controller.tapField(x, y),
    focus: (id) => controller.focus(id),
    back: () => controller.back(),
    compile: () => {
      const state = controller.getState();
      return compiled([state.entries, state.focus?.id ?? null, related().join(','), state.section.key, motes(), (results() ?? []).map((entry) => entry.id).join(','), results() === null]);
    },
    labelOf: (id) => { const entry = controller.getState().entries.find((e) => e.id === id); return entry === undefined ? '' : publicEntryLabel(entry); },
    relations,
  }, rtl);
}
