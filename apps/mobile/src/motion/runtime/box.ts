/**
 * T-10 — a plain mutable box, read at call time.
 *
 * Two things in this task need a value that outlives a render but is NOT rendering input: whether
 * a surface has already painted once, and whether it is still mounted when a completed gesture's
 * crossing arrives on the Product runtime. A `useRef` is the obvious tool and the wrong one here —
 * the React Compiler's rules reject reading a ref during render and reject handing one to a
 * gesture callback, both for good reasons — and holding it in state and mutating it directly is
 * rejected too.
 *
 * So the value is held in state as an object that is never replaced, and mutates only through a
 * method. Nothing here is Product state: a box can hold no truth, is never persisted, is never
 * compared, and is dropped with the component that owns it.
 */
export interface MutableBox<T> {
  readonly get: () => T;
  readonly set: (next: T) => void;
}

export function createBox<T>(initial: T): MutableBox<T> {
  let held = initial;
  return Object.freeze({
    get: () => held,
    set: (next: T) => {
      held = next;
    },
  });
}
