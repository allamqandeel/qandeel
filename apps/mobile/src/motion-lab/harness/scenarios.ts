/**
 * T-10.0 MOTION LAB — the identical shootout scenarios (§8), as timed scripts over the SAME acts a
 * finger or a control would perform. A script never touches a shared value that a Product act
 * would not, and every Product change it causes still goes through the real executors: the script
 * only decides WHEN, exactly as a reader would.
 *
 * S1 drives the synthetic finger through the same worklets the real pan uses. S3 walks the
 * preview through T-06's own non-drag route (exact entry) so the world's answer to `K(PTC)` can be
 * watched without a hand on the strip; the 1:1 finger tracking itself is for the human to feel by
 * dragging the strip. Everything else is the act layer.
 */
import { decodeCameraIntent, placeScene, type PlacedNode, type ViewportEnvelope } from '../../map';
import { latestReturnCheckpoint, type ReturnCheckpointTarget } from '../../return-navigation';
import { sessionPosition, type CanonicalStore } from '../../state';
import { commitPreviewedTarget, temporalTargeting, type TemporalPreviewController } from '../../temporal-navigation';
import type { PresentationController } from '../../timeline';
import type { LabCameraBinding } from '../motion/useLabCamera';
import { describeOutcome, type LabActs, type LabOutcome } from '../truth/lab-acts';
import { currentLabContext } from '../truth/lab-projection';
import type { LabWorld } from '../truth/lab-world';

export type ScenarioId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export interface ScenarioContext {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  readonly presentation: PresentationController;
  readonly acts: LabActs;
  readonly world: LabWorld;
  readonly envelope: ViewportEnvelope;
  readonly camera: LabCameraBinding;
  readonly status: (line: string) => void;
  /** Records the Exact Return origin the script establishes, for the harness control. */
  readonly setOrigin: (target: ReturnCheckpointTarget | null) => void;
  readonly getOrigin: () => ReturnCheckpointTarget | null;
}

export interface ScenarioStep {
  readonly at: number;
  readonly note: string;
  readonly run: (context: ScenarioContext) => void;
}

export interface Scenario {
  readonly id: ScenarioId;
  readonly title: string;
  readonly oracle: string;
  readonly steps: readonly ScenarioStep[];
}

/** The placed node of an identity on the CURRENT committed scene, or `null`. */
function findNode(context: ScenarioContext, objectKey: string, bindingId: string | null): { readonly node: PlacedNode; readonly mapContext: NonNullable<ReturnType<typeof currentLabContext>> } | null {
  const state = context.store.getState();
  const mapContext = currentLabContext(context.world, state);
  const decoded = decodeCameraIntent(state.camera);
  if (mapContext === null || !decoded.ok) return null;
  const placed = placeScene(mapContext.scene, decoded.camera, context.envelope);
  const node = placed.nodes.find((candidate) => {
    if (candidate.objectKey !== objectKey) return false;
    if (bindingId === null) return candidate.locus === null || candidate.locus.kind === 'THREAD_HOME';
    return candidate.locus?.kind === 'CONTEXTUAL_APPEARANCE' && candidate.locus.bindingId === bindingId;
  });
  return node === undefined ? null : { node, mapContext };
}

function act(context: ScenarioContext, label: string, run: () => LabOutcome): LabOutcome {
  const outcome = context.camera.settleThen(run);
  context.status(`${label} → ${describeOutcome(outcome)}`);
  return outcome;
}

function tapIdentity(context: ScenarioContext, label: string, objectKey: string, bindingId: string | null): void {
  const found = findNode(context, objectKey, bindingId);
  if (found === null) {
    context.status(`${label}: not on the current scene`);
    return;
  }
  act(context, label, () => context.acts.tap(found.mapContext, found.node));
}

function previewMoment(context: ScenarioContext, sp: number): void {
  const targeting = temporalTargeting(context.store.getState(), context.presentation.getSnapshot().track);
  const result = context.preview.preview(targeting, sessionPosition(sp), 'EXACT_ENTRY');
  context.status(`preview SP ${sp} → ${result.outcome}`);
}

function commitPreview(context: ScenarioContext): void {
  context.camera.settleThen(() => {
    const targeting = temporalTargeting(context.store.getState(), context.presentation.getSnapshot().track);
    const outcome = commitPreviewedTarget(context.store, context.preview, targeting);
    context.status(`commit previewed Moment → ${outcome.outcome}`);
  });
}

export const SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: 'S1',
    title: 'S1 · Pan, release, interruption',
    oracle: 'The world is controllable at every frame; one PAN commits where the plane rests.',
    steps: [
      { at: 0, note: 'finger down', run: (c) => c.camera.synthetic.grab() },
      { at: 30, note: 'drag 1:1', run: (c) => c.camera.synthetic.drag(-150, -70, 340) },
      { at: 400, note: 'release with velocity', run: (c) => c.camera.synthetic.release(-820, -380) },
      { at: 760, note: 'second finger interrupts the settle mid-flight', run: (c) => c.camera.synthetic.grab() },
      { at: 790, note: 'drag the other way', run: (c) => c.camera.synthetic.drag(110, 20, 280) },
      { at: 1100, note: 'release again', run: (c) => c.camera.synthetic.release(520, 90) },
    ],
  },
  {
    id: 'S2',
    title: 'S2 · Semantic Zoom / inspection',
    oracle: 'Same world, stable locus, deeper disclosure resolving; then the reverse. No page, no modal.',
    steps: [
      { at: 0, note: 'land on a Thread Home (Direct Jump)', run: (c) => tapIdentity(c, 'Direct Jump thread-east', 'THREAD:thread-east', null) },
      { at: 900, note: 'disclose one rung deeper', run: (c) => act(c, 'Semantic Zoom IN', () => c.acts.zoom('IN')) },
      { at: 2200, note: 'enter a Reading through its appearance', run: (c) => tapIdentity(c, 'Direct Jump reading-east-1', 'READING:reading-east-1', 'binding-e1') },
      { at: 3500, note: 'and back out one rung', run: (c) => act(c, 'Semantic Zoom OUT', () => c.acts.zoom('OUT')) },
    ],
  },
  {
    id: 'S3',
    title: 'S3 · Timeline scrub (non-drag walk)',
    oracle: 'The world previews K(PTC) truthfully, nothing future is ghosted, commit is distinct from preview.',
    steps: [
      { at: 0, note: 'land on thread-east and disclose its Thread rung, where the record changes across Moments', run: (c) => tapIdentity(c, 'Direct Jump thread-east', 'THREAD:thread-east', null) },
      { at: 800, note: '…', run: (c) => act(c, 'Semantic Zoom IN', () => c.acts.zoom('IN')) },
      { at: 2000, note: 'preview an earlier Moment: what was bound later is simply not there', run: (c) => previewMoment(c, 5) },
      { at: 2700, note: 'earlier still', run: (c) => previewMoment(c, 3) },
      { at: 3400, note: 'before this Thread had any appearance', run: (c) => previewMoment(c, 2) },
      { at: 4100, note: 'commit the previewed Moment', run: (c) => commitPreview(c) },
      { at: 5300, note: 'preview forward without committing', run: (c) => previewMoment(c, 6) },
      { at: 6000, note: 'cancel the preview: committed truth returns', run: (c) => c.status(`cancel preview → ${c.preview.cancel().outcome}`) },
      { at: 6900, note: 'rejoin the live conversation (temporal only)', run: (c) => act(c, 'Return to Live Head', () => c.acts.returnLiveHead()) },
    ],
  },
  {
    id: 'S4',
    title: 'S4 · The six Return meanings',
    oracle: 'Six acts, six motion truths; no fake camera movement where the act has no landing.',
    steps: [
      { at: 0, note: 'start from the World camera', run: (c) => act(c, 'Return to World', () => c.acts.returnWorld()) },
      { at: 700, note: 'land on thread-east', run: (c) => tapIdentity(c, 'Direct Jump thread-east', 'THREAD:thread-east', null) },
      { at: 1600, note: 'disclose the Thread rung', run: (c) => act(c, 'Semantic Zoom IN', () => c.acts.zoom('IN')) },
      {
        at: 2700,
        note: 'inspect a Reading (the journey origin)',
        run: (c) => {
          tapIdentity(c, 'Direct Jump reading-east-1', 'READING:reading-east-1', 'binding-e1');
          c.setOrigin(latestReturnCheckpoint(c.store));
        },
      },
      { at: 3800, note: 'preview SP 4', run: (c) => previewMoment(c, 4) },
      { at: 4200, note: 'commit SP 4 (historical)', run: (c) => commitPreview(c) },
      { at: 5300, note: 'RETURN_LIVE_HEAD: temporal only, the camera does not pretend to move', run: (c) => act(c, 'Return to Live Head', () => c.acts.returnLiveHead()) },
      { at: 6500, note: 'pin SP 4 again', run: (c) => previewMoment(c, 4) },
      { at: 6900, note: 'commit', run: (c) => commitPreview(c) },
      {
        at: 8000,
        note: 'RETURN_LIVE_FOCUS from SP 4: the referent is not known here, so nothing moves',
        run: (c) => {
          const context = currentLabContext(c.world, c.store.getState());
          if (context === null) return;
          act(c, 'Return to Live Focus', () => c.acts.returnLiveFocus(context));
        },
      },
      {
        at: 9200,
        note: 'GO_LIVE_AND_LOCATE with live attention on an ungeographic focus: the temporal half completes, no fake camera movement',
        run: (c) => act(c, 'Go Live + Locate', () => c.acts.goLiveAndLocate()),
      },
      { at: 10600, note: 'two more Moments commit; live attention moves to an established Thread', run: (c) => act(c, 'Advance live', () => c.acts.advanceLive()) },
      { at: 11000, note: '…', run: (c) => act(c, 'Advance live', () => c.acts.advanceLive()) },
      { at: 11800, note: 'pin SP 4 once more', run: (c) => previewMoment(c, 4) },
      { at: 12200, note: 'commit', run: (c) => commitPreview(c) },
      { at: 13200, note: 'GO_LIVE_AND_LOCATE: temporal phase, then the conditional spatial phase lands', run: (c) => act(c, 'Go Live + Locate', () => c.acts.goLiveAndLocate()) },
      { at: 15200, note: 'RETURN_WORLD: same TC, spatial and depth opening only', run: (c) => act(c, 'Return to World', () => c.acts.returnWorld()) },
      { at: 16600, note: 'BACK_ONE_STEP: continuity to the captured prior viewpoint', run: (c) => act(c, 'Back one step', () => c.acts.backOneStep()) },
      {
        at: 18000,
        note: 'EXACT_RETURN: the exact captured origin viewpoint, not a similar current place',
        run: (c) => {
          const target = c.getOrigin();
          if (target === null) {
            c.status('no origin bound');
            return;
          }
          act(c, 'Exact Return', () => c.acts.exactReturn(target));
        },
      },
    ],
  },
  {
    id: 'S5',
    title: 'S5 · Meaning Ignition hypothesis',
    oracle: 'New analytical material becomes legitimately known through a live advance; compare with the cue on and off.',
    steps: [
      { at: 0, note: 'World camera', run: (c) => act(c, 'Return to World', () => c.acts.returnWorld()) },
      { at: 700, note: 'land on thread-north', run: (c) => tapIdentity(c, 'Direct Jump thread-north', 'THREAD:thread-north', null) },
      { at: 1600, note: 'disclose the Thread rung', run: (c) => act(c, 'Semantic Zoom IN', () => c.acts.zoom('IN')) },
      { at: 2600, note: 'Moments commit (nothing new here yet)', run: (c) => act(c, 'Advance live', () => c.acts.advanceLive()) },
      { at: 3000, note: '…', run: (c) => act(c, 'Advance live', () => c.acts.advanceLive()) },
      { at: 3800, note: 'a Moment commits: a new appearance becomes known in THIS Thread', run: (c) => act(c, 'Advance live', () => c.acts.advanceLive()) },
      { at: 5600, note: 'back to the World rung', run: (c) => act(c, 'Return to World', () => c.acts.returnWorld()) },
      { at: 6800, note: 'a Moment commits: an Emerging Focus is promoted, a Home appears', run: (c) => act(c, 'Advance live', () => c.acts.advanceLive()) },
      { at: 8600, note: 'a Moment commits: live attention moves to the new Thread', run: (c) => act(c, 'Advance live', () => c.acts.advanceLive()) },
      {
        at: 9600,
        note: 'RETURN_LIVE_FOCUS: one spatial act to where live attention is',
        run: (c) => {
          const context = currentLabContext(c.world, c.store.getState());
          if (context === null) return;
          act(c, 'Return to Live Focus', () => c.acts.returnLiveFocus(context));
        },
      },
    ],
  },
]);

/** Runs a scenario; returns a function that stops the remaining steps. */
export function runScenario(scenario: Scenario, context: ScenarioContext): () => void {
  context.status(`▶ ${scenario.title}`);
  const timers = scenario.steps.map((step) =>
    setTimeout(() => {
      context.status(`· ${step.note}`);
      step.run(context);
    }, step.at),
  );
  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
