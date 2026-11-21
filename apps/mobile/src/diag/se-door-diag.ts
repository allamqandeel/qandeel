/**
 * DIAG-SE-DOOR — the diagnostic branch `diag/se-door` ONLY (PO, 2026-11-21). Never merged; it has no product meaning.
 *
 * Timestamped markers for the intermittent iPhone SE Personal Analysis entry (run 44908792454): whether a touch reaches
 * the application's root, whether the Analysis door receives the press, whether its `onPress` runs, whether the
 * crossing is requested and whether the depth changes. Each marker goes to the system log (`console.log`, which the
 * Release build writes to os_log, subsystem com.facebook.react.log) and to `Documents/qdiag.log`, which the diagnostic
 * workflow reads from the app's container after each cycle.
 *
 * It observes only: it claims no responder, changes no layout and no navigation. The file is written after the
 * handler that marked it has returned (one coalesced write per JS task).
 */
import { AppState } from 'react-native';
import { File, Paths } from 'expo-file-system';

let seq = 0;
const lines: string[] = [];
let pending = false;

function flush(): void {
  pending = false;
  try {
    const file = new File(Paths.document, 'qdiag.log');
    if (!file.exists) file.create();
    file.write(lines.join('\n') + '\n');
  } catch (error) {
    console.log(`QDIAG file-write-failed ${String(error)}`);
  }
}

export function qdiag(event: string, detail = ''): void {
  seq += 1;
  const line = `QDIAG ${seq} wall=${Date.now()} mono=${performance.now().toFixed(1)} ${event}${detail === '' ? '' : ' ' + detail}`;
  console.log(line);
  lines.push(line);
  if (pending) return;
  pending = true;
  setTimeout(flush, 0);
}

interface TouchLike {
  readonly nativeEvent: { readonly pageX: number; readonly pageY: number; readonly timestamp: number; readonly target?: unknown; readonly touches?: readonly unknown[] };
}

/** The root's capture-phase touch observer (a View's `onTouch*Capture`; it never becomes the responder). */
export function qdiagTouch(phase: string): (event: TouchLike) => void {
  return (event) => {
    const e = event.nativeEvent;
    qdiag(`root.${phase}`, `x=${e.pageX.toFixed(1)} y=${e.pageY.toFixed(1)} ts=${e.timestamp} target=${String(e.target)} touches=${e.touches?.length ?? '?'}`);
  };
}

qdiag('js.start');
AppState.addEventListener('change', (state) => qdiag('appstate', state));
