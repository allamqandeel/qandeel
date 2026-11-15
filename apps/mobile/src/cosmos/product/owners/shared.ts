/**
 * COSMOS-INT-01 Slice B — a Shared World's owner: the COSMOS stage over the PRODUCTION `SharedFieldController` the
 * Shared area created (SHARED-VIS-01), opened and will retire. Every act goes to that controller; every answer is read
 * back. A Shared place carries no category the client may show: its dye comes from its own identity and groups
 * nothing; members and QANDEEL are not drawn (D6). The focused place's served source count is its motes.
 */

import type { ChromeLanguage } from '../../../orientation-chrome';
import type { SharedFieldController } from '../../../shared-world/field/shared-field-controller';
import { sharedScene } from '../../core/adapters';
import { compileStage, type Stage } from '../../core/stage';
import { ORIGIN, createFieldOwner, memo, type CosmosWorldOwner } from '../owner-core';

export function createSharedCosmosOwner(controller: SharedFieldController, language: ChromeLanguage): CosmosWorldOwner {
  const rtl = language === 'ar';
  /** The served panel's real source count, once served: the motes about the focused place. */
  const motes = () => {
    const panel = controller.getState().focus?.panel;
    return panel?.status === 'SERVED' ? panel.place.sources.length : undefined;
  };
  const compiled = memo<readonly unknown[], Stage>(() => {
    const state = controller.getState();
    return compileStage(sharedScene(state.entries, state.focus?.id ?? null, rtl, ORIGIN, motes()));
  });
  return createFieldOwner({
    world: 'SHARED',
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
    compile: () => { const state = controller.getState(); return compiled([state.entries, state.focus?.id ?? null, motes()]); },
    labelOf: (id) => controller.getState().entries.find((e) => e.id === id)?.meaning ?? '',
  }, rtl);
}
