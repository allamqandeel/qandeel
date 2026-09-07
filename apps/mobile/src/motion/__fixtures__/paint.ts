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

/** Every circle the renderer actually asked Skia to paint, with the ancestors it sits under. */
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
