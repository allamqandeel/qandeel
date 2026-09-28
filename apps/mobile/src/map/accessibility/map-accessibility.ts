/**
 * T-04 — the nonvisual Map, projected from the SAME `MapScene` as the pixels.
 *
 * The accessible tree is not a description of the drawing; it is a second projection of one
 * disclosure. That is what makes the parity invariants structural rather than aspirational:
 *
 *   - the accessible object set is exactly the entitled disclosed object set at this depth and
 *     context — no future object, no off-depth object, no unavailable context;
 *   - no accessibility-only geography and no accessibility-only identity exists: every node is a
 *     scene object, and an ungeographic identity is announced as ungeographic rather than given
 *     a position;
 *   - the set is never larger than what sighted rendering can reach. A node outside the current
 *     viewport is in the tree because it is entitled and reachable by exploring, and its
 *     visibility is stated rather than implied.
 *
 * Roles are chosen conservatively. A collection role publishes a set size to the platform, and a
 * set size announced while a rung of the frozen lineage is still `DEPTH_WITHHELD` would read as
 * a claim about the world rather than about this disclosure. So the container takes a collection
 * role only when every rung is disclosed; otherwise the nodes stay individually reachable inside
 * a plain group. No node publishes an `accessibilityValue`: the Map has no range, no position in
 * a total and no progress to report.
 *
 * Every essential Map intent this task owns has a non-drag route here: inspect, semantic zoom in
 * and out, viewport exploration in four directions, context switching among disclosed
 * appearances, and direct-jump activation where a unique locus already exists. None of them
 * requires an entitlement that the visual route does not.
 *
 * The words are the reader's language, from the W1A-01 Analysis copy (`analysis-language`). An
 * object is described by its Product type and its placement ONLY: no canonical id, binding id, locus
 * key, fixture id or enum token is ever part of a label. Nothing here states an analytical fact
 * about an object.
 */
import { analysisCopy, type AnalysisLanguage } from '../../analysis-language';
import type { MapCamera, ViewportEnvelope } from '../camera';
import { isWithinFootprint, visibleFootprint } from '../camera';
import type { MapObjectFamily, MapScene, MapSceneObject } from '../projection';

export const MAP_NODE_ACTIONS = Object.freeze(['inspect', 'switch-context', 'direct-jump'] as const);
export type MapNodeActionName = (typeof MAP_NODE_ACTIONS)[number];

export const MAP_VIEWPORT_ACTIONS = Object.freeze([
  'zoom-in',
  'zoom-out',
  'explore-left',
  'explore-right',
  'explore-up',
  'explore-down',
] as const);
export type MapViewportActionName = (typeof MAP_VIEWPORT_ACTIONS)[number];

export interface MapAccessibilityAction {
  readonly name: string;
  readonly label: string;
}

export type MapNodePlacement = 'CANONICAL_HOME' | 'CONTEXTUAL_APPEARANCE' | 'UNGEOGRAPHIC';

export interface MapAccessibilityNode {
  readonly key: string;
  readonly family: MapObjectFamily;
  readonly id: string;
  readonly role: 'button';
  readonly label: string;
  readonly placement: MapNodePlacement;
  readonly locusCount: number;
  readonly withinVisibleFootprint: boolean;
  readonly actions: readonly MapAccessibilityAction[];
}

export interface MapAccessibilityTree {
  readonly containerRole: 'list' | 'none';
  readonly containerLabel: string;
  readonly viewportActions: readonly MapAccessibilityAction[];
  readonly nodes: readonly MapAccessibilityNode[];
  readonly keys: ReadonlySet<string>;
}

function placementOf(object: MapSceneObject): MapNodePlacement {
  if (object.loci.length === 0) return 'UNGEOGRAPHIC';
  return object.loci[0].kind === 'THREAD_HOME' ? 'CANONICAL_HOME' : 'CONTEXTUAL_APPEARANCE';
}

/** The object's Product type and its placement. Never its id: an identifier is not Product language. */
function labelOf(object: MapSceneObject, placement: MapNodePlacement, language: AnalysisLanguage): string {
  const copy = analysisCopy(language);
  const family = copy.family[object.family];
  switch (placement) {
    case 'CANONICAL_HOME':
      return copy.describe(family, copy.permanentPlace);
    case 'CONTEXTUAL_APPEARANCE':
      return copy.describe(family, copy.contexts(object.loci.length));
    case 'UNGEOGRAPHIC':
      return copy.describe(family, copy.noPlace);
    default: {
      const exhaustive: never = placement;
      return exhaustive;
    }
  }
}

/** The canonical identity the current `IF_ref` names, in Map terms; `null` when nothing is inspected. */
export interface MapAccessibilityFocus {
  readonly family: MapObjectFamily;
  readonly id: string;
  /** The contextual binding the current inspection names, when it names one. */
  readonly bindingId: string | null;
}

function actionsFor(object: MapSceneObject, focus: MapAccessibilityFocus | null, language: AnalysisLanguage): readonly MapAccessibilityAction[] {
  const copy = analysisCopy(language);
  const actions: MapAccessibilityAction[] = [{ name: 'inspect', label: copy.inspect }];
  // A context switch moves from ONE named context to ANOTHER named context of the same object,
  // so it is offered only on the object currently inspected through a named context, and only
  // when a second disclosed appearance exists. A direct jump needs exactly one locus to land in.
  // Neither is offered where it would have to elect a context.
  const inspectedHere = focus !== null && focus.family === object.family && focus.id === object.id;
  if (inspectedHere && focus.bindingId !== null && object.loci.length >= 2) {
    actions.push({ name: 'switch-context', label: copy.switchContext });
  }
  if (object.loci.length === 1) actions.push({ name: 'direct-jump', label: copy.goToPlace });
  return Object.freeze(actions);
}

function viewportActions(language: AnalysisLanguage): readonly MapAccessibilityAction[] {
  const copy = analysisCopy(language);
  return Object.freeze([
    { name: 'zoom-in', label: copy.moreDetail },
    { name: 'zoom-out', label: copy.lessDetail },
    { name: 'explore-left', label: copy.exploreLeft },
    { name: 'explore-right', label: copy.exploreRight },
    { name: 'explore-up', label: copy.exploreUp },
    { name: 'explore-down', label: copy.exploreDown },
  ]);
}

/**
 * The neutral name of the surface, in one language. It names the Map itself and nothing about a
 * disclosure: no depth, no rung, no count, no temporal position.
 */
export const mapContainerNeutralLabel = (language: AnalysisLanguage): string => analysisCopy(language).map;

/** The English neutral name, for callers that state the English surface. */
export const MAP_CONTAINER_NEUTRAL_LABEL = mapContainerNeutralLabel('en');

/**
 * The accessible Map while no current projection is available (R2-FIX-01).
 *
 * Suppressing the object nodes of a stale scene is not enough: a container role and a container
 * label derived from that scene are disclosure semantics too. A collection role would still
 * publish a set size, and a label naming the rung the old scene was disclosed at would still tell
 * a reader that the Map currently discloses that rung — after the camera has already moved to
 * another one. So nothing is derived from the stale scene at all; this tree is built without
 * looking at one.
 *
 * The viewport routes remain, because they act on the camera rather than on the disclosed world,
 * and they are how a reader brings the camera back to a rung the held projection matches. Nothing
 * here explains the wait: that is chrome, and chrome is T-08's.
 */
export function mapAccessibilityWithoutProjection(language: AnalysisLanguage = 'en'): MapAccessibilityTree {
  return Object.freeze({
    containerRole: 'none',
    containerLabel: mapContainerNeutralLabel(language),
    viewportActions: viewportActions(language),
    nodes: Object.freeze([]),
    keys: new Set<string>(),
  });
}

export function buildMapAccessibilityTree(
  scene: MapScene,
  camera: MapCamera,
  envelope: ViewportEnvelope,
  focus: MapAccessibilityFocus | null = null,
  language: AnalysisLanguage = 'en',
): MapAccessibilityTree {
  const footprint = visibleFootprint(camera, envelope);
  const nodes = scene.objects.map((object): MapAccessibilityNode => {
    const placement = placementOf(object);
    const within = object.loci.some((locus) => isWithinFootprint(footprint, locus.kind === 'THREAD_HOME' ? locus.address : locus.hostAddress));
    return {
      key: object.key,
      family: object.family,
      id: object.id,
      role: 'button',
      label: labelOf(object, placement, language),
      placement,
      locusCount: object.loci.length,
      // An ungeographic identity is not "off screen": it has no place to be on or off.
      withinVisibleFootprint: placement === 'UNGEOGRAPHIC' ? false : within,
      actions: actionsFor(object, focus, language),
    };
  });
  const everyRungDisclosed = scene.rungs.thread && scene.rungs.session && scene.rungs.analyticalObject && scene.rungs.sourceProvenance;
  return Object.freeze({
    containerRole: everyRungDisclosed ? 'list' : 'none',
    // The Map's own name, as on the no-projection tree. The disclosed rung was spoken here as a raw
    // enum token; it is not Product language, and T-08's chrome already says what is shown.
    containerLabel: mapContainerNeutralLabel(language),
    viewportActions: viewportActions(language),
    nodes: Object.freeze(nodes),
    keys: new Set(nodes.map((node) => node.key)),
  });
}
