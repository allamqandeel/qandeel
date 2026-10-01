/**
 * T-10 — what the renderer actually asked the canvas to draw, read back out of the rendered tree.
 *
 * Shared by the integration suites so both read the SAME tree the same way: a claim about what is
 * painted should never depend on which file is asking.
 */

interface TreeNode {
  readonly props?: Record<string, unknown>;
  readonly children?: readonly unknown[];
}

/**
 * Every circle the renderer actually asked Skia to paint, and every OBJECT ANCHOR, with the ancestors
 * each sits under.
 *
 * VPORT-01 re-anchor: the placeholder drew each object as a circle, so a circle at a node's position
 * WAS that object. The final world draws each object as its canonical morphology, a path, inside a group
 * that carries only the object's origin — no transform and no opacity, a signature nothing else in the
 * renderer has. That anchor is reported here as a zero-radius entry at the object's own placed point,
 * so the claims these suites make — what is painted, where, and under which camera group — are read off
 * the same tree as before, from the object itself.
 */
export function circles(json: unknown): { cx: number; cy: number; r: number; underOpacity: boolean }[] {
  const found: { cx: number; cy: number; r: number; underOpacity: boolean }[] = [];
  const walk = (node: unknown, opacityAbove: boolean): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as TreeNode;
    const props = record.props;
    const opacityHere = opacityAbove || (props !== undefined && props.opacity !== undefined && props.origin === undefined);
    if (props !== undefined && typeof props.cx === 'number' && typeof props.cy === 'number' && typeof props.r === 'number') {
      found.push({ cx: props.cx, cy: props.cy, r: props.r, underOpacity: opacityAbove });
    }
    const origin = props?.origin as { x?: unknown; y?: unknown } | undefined;
    if (
      props !== undefined &&
      props.skiaElement === 'Group' &&
      props.opacity === undefined &&
      props.transform === undefined &&
      origin !== undefined &&
      typeof origin.x === 'number' &&
      typeof origin.y === 'number'
    ) {
      found.push({ cx: origin.x, cy: origin.y, r: 0, underOpacity: opacityAbove });
    }
    for (const child of record.children ?? []) walk(child, opacityHere);
  };
  walk(json, false);
  return found;
}

/**
 * How many objects are wrapped in an ARRIVAL.
 *
 * The signature is exact and stable: only `DisclosureArrival` renders a group carrying BOTH an
 * opacity and an origin. The plane's own opacity group has no origin, and the per-object
 * counter-scale group has no opacity.
 */
export function arrivalWrappers(json: unknown): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as TreeNode;
    const props = record.props;
    if (props !== undefined && props.opacity !== undefined && props.origin !== undefined) count += 1;
    for (const child of record.children ?? []) walk(child);
  };
  walk(json);
  return count;
}
