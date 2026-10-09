/**
 * SHARED-VIS-01 (controlled frozen-map correction) — a model of the TWO runtimes' ordering, for race tests only.
 *
 * The suite-wide Reanimated stand-in (`jest.setup.js`) runs everything on one runtime: a write is visible to the next
 * read, an animation is at its target the moment it is assigned, and no reaction ever runs. That is right for asserting
 * a binding's output and it can never show a race between the runtimes. This model keeps exactly the ordering the
 * library has on a device (Reanimated 4 `mutables.ts`), and nothing else:
 *
 *   a write from the React runtime is POSTED to the UI runtime (`scheduleOnUI`) and is not seen by a read in the same
 *   task; a read from the React runtime is a synchronous read of the UI value (`getSync`);
 *   `deliver()` is the UI runtime receiving what was posted — it applies every write in order, between two React tasks;
 *   `frame()` is one animation frame — running animations advance, then every reaction (mapper) runs, and what a
 *   reaction hands to the React runtime (`scheduleOnRN`) waits in a queue for `drainReact()`;
 *   a write made ON the UI runtime (inside a reaction) applies at once, as it does there.
 *
 * So a test can say precisely "the React runtime ran two tasks before the UI runtime drew a frame", which is the
 * interleaving the device pass caught. It proves ordering, never pixels or timing.
 */

interface Segment {
  readonly to: number;
  readonly frames: number;
  delay: number;
}

interface Running {
  readonly segments: Segment[];
  index: number;
  step: number;
  from: number;
}

interface Cell {
  ui: unknown;
  running: Running | null;
}

/** An animation as the stand-ins describe it: segments of a straight approach, each after a delay in frames. */
export interface ModelAnimation {
  readonly __modelAnimation: true;
  readonly segments: readonly Segment[];
}

export interface ModelReaction {
  readonly prepare: () => unknown;
  readonly react: (now: unknown, previous: unknown) => void;
  first: boolean;
  previous: unknown;
}

const FRAME_MS = 1000 / 60;
const framesOf = (ms: number) => Math.max(0, Math.ceil(ms / FRAME_MS));

export interface UiRuntimeModel {
  /** Whether the code now running is on the UI runtime (inside `deliver` or `frame`). */
  onUi: boolean;
  readonly cells: Set<Cell>;
  readonly reactions: Set<ModelReaction>;
  makeValue<T>(initial: T): { value: T; get(): T; set(next: T | ((current: T) => T)): void; modify(fn: (v: T) => T): void };
  cancel(value: unknown): void;
  timing(to: number, ms: number): ModelAnimation;
  delay(ms: number, next: unknown): ModelAnimation;
  sequence(...parts: unknown[]): ModelAnimation;
  toReact(fn: (...args: unknown[]) => void, args: unknown[]): void;
  /** The UI runtime receives what the React runtime posted. */
  deliver(): void;
  /** One animation frame. Returns whether anything moved or any reaction ran with a change. */
  frame(): boolean;
  /** Runs what the UI runtime handed to the React runtime. */
  drainReact(): number;
  /** How many writes are still in flight to the UI runtime. */
  pending(): number;
  reset(): void;
}

function isAnimation(value: unknown): value is ModelAnimation {
  return typeof value === 'object' && value !== null && (value as ModelAnimation).__modelAnimation === true;
}

function asAnimation(value: unknown): ModelAnimation {
  if (isAnimation(value)) return value;
  return { __modelAnimation: true, segments: [{ to: value as number, frames: 0, delay: 0 }] };
}

export function createUiRuntimeModel(): UiRuntimeModel {
  let posted: (() => void)[] = [];
  let toReactQueue: (() => void)[] = [];
  let dirty = false;
  const cellOf = new WeakMap<object, Cell>();

  const assign = (cell: Cell, next: unknown) => {
    if (isAnimation(next)) {
      // A fresh copy: an animation object is a description and may be assigned more than once.
      cell.running = { segments: next.segments.map((s) => ({ ...s })), index: 0, step: 0, from: cell.ui as number };
    } else {
      cell.running = null;
      cell.ui = next;
    }
    dirty = true;
  };

  const model: UiRuntimeModel = {
    onUi: false,
    cells: new Set(),
    reactions: new Set(),
    makeValue<T>(initial: T) {
      const cell: Cell = { ui: initial, running: null };
      model.cells.add(cell);
      const write = (job: () => void) => {
        if (model.onUi) job();
        else posted.push(job);
      };
      const handle = {
        get value() {
          return cell.ui as T;
        },
        set value(next: T) {
          write(() => assign(cell, next));
        },
        get: () => cell.ui as T,
        set: (next: T | ((current: T) => T)) =>
          write(() => assign(cell, typeof next === 'function' ? (next as (current: T) => T)(cell.ui as T) : next)),
        modify: (fn: (v: T) => T) => write(() => assign(cell, fn(cell.ui as T))),
      };
      cellOf.set(handle, cell);
      return handle;
    },
    cancel(value: unknown) {
      const cell = cellOf.get(value as object);
      if (cell === undefined) return;
      const job = () => {
        cell.running = null;
      };
      if (model.onUi) job();
      else posted.push(job);
    },
    timing: (to, ms) => ({ __modelAnimation: true, segments: [{ to, frames: framesOf(ms), delay: 0 }] }),
    delay: (ms, next) => {
      const animation = asAnimation(next);
      const [first, ...rest] = animation.segments;
      return { __modelAnimation: true, segments: [{ ...first!, delay: first!.delay + framesOf(ms) }, ...rest] };
    },
    sequence: (...parts) => ({ __modelAnimation: true, segments: parts.flatMap((part) => asAnimation(part).segments) }),
    toReact: (fn, args) => {
      toReactQueue.push(() => fn(...args));
    },
    deliver() {
      model.onUi = true;
      try {
        while (posted.length > 0) {
          const jobs = posted;
          posted = [];
          for (const job of jobs) job();
        }
      } finally {
        model.onUi = false;
      }
    },
    frame() {
      model.onUi = true;
      let changed = dirty;
      dirty = false;
      try {
        for (const cell of model.cells) {
          const running = cell.running;
          if (running === null) continue;
          const segment = running.segments[running.index]!;
          if (segment.delay > 0) {
            segment.delay -= 1;
            continue;
          }
          running.step += 1;
          if (segment.frames <= running.step) {
            cell.ui = segment.to;
            running.index += 1;
            running.step = 0;
            running.from = segment.to;
            if (running.index >= running.segments.length) cell.running = null;
          } else {
            cell.ui = running.from + ((segment.to - running.from) * running.step) / segment.frames;
          }
          changed = true;
        }
        for (const reaction of [...model.reactions]) {
          if (!reaction.first && !changed) continue;
          const now = reaction.prepare();
          const previous = reaction.first ? null : reaction.previous;
          reaction.first = false;
          reaction.previous = now;
          reaction.react(now, previous);
        }
      } finally {
        model.onUi = false;
      }
      return changed;
    },
    drainReact() {
      const jobs = toReactQueue;
      toReactQueue = [];
      for (const job of jobs) job();
      return jobs.length;
    },
    pending: () => posted.length,
    reset() {
      posted = [];
      toReactQueue = [];
      dirty = false;
      model.cells.clear();
      model.reactions.clear();
      model.onUi = false;
    },
  };
  return model;
}

/** The one model a test file's stand-ins share (both factories run lazily, in either order). */
export function sharedUiRuntimeModel(): UiRuntimeModel {
  const holder = globalThis as { __QANDEEL_UI_RUNTIME_MODEL__?: UiRuntimeModel };
  holder.__QANDEEL_UI_RUNTIME_MODEL__ ??= createUiRuntimeModel();
  return holder.__QANDEEL_UI_RUNTIME_MODEL__;
}
