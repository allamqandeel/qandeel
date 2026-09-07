/**
 * T-10.0 MOTION LAB — a frame-time meter, measured on the UI runtime and reported once a second.
 *
 * It records rather than claims: average and worst frame interval, and how many frames overran
 * the 60 Hz and 30 Hz budgets in the last second. On web this measures the browser's animation
 * frame cadence; on a device it measures the UI runtime's.
 */
import { useCallback, useState } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export interface FrameReport {
  readonly frames: number;
  readonly averageMs: number;
  readonly worstMs: number;
  readonly over16: number;
  readonly over33: number;
}

export function usePerfMeter(active: boolean): FrameReport | null {
  const [report, setReport] = useState<FrameReport | null>(null);
  const frames = useSharedValue(0);
  const total = useSharedValue(0);
  const worst = useSharedValue(0);
  const over16 = useSharedValue(0);
  const over33 = useSharedValue(0);
  const windowStart = useSharedValue(0);

  const publish = useCallback((next: FrameReport) => {
    setReport(next);
  }, []);

  useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame;
    if (dt === null || dt <= 0) return;
    frames.set(frames.get() + 1);
    total.set(total.get() + dt);
    if (dt > worst.get()) worst.set(dt);
    if (dt > 16.9) over16.set(over16.get() + 1);
    if (dt > 33.6) over33.set(over33.get() + 1);
    if (windowStart.get() === 0) windowStart.set(info.timestamp);
    if (info.timestamp - windowStart.get() >= 1000) {
      const count = frames.get();
      scheduleOnRN(publish, {
        frames: count,
        averageMs: count > 0 ? Math.round((total.get() / count) * 10) / 10 : 0,
        worstMs: Math.round(worst.get() * 10) / 10,
        over16: over16.get(),
        over33: over33.get(),
      });
      frames.set(0);
      total.set(0);
      worst.set(0);
      over16.set(0);
      over33.set(0);
      windowStart.set(info.timestamp);
    }
  }, active);

  return report;
}
