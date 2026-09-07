/**
 * T-10.0 MOTION LAB — the harness chrome: direction picker, toggles, scenarios, the non-drag act
 * routes and the status readout. This is a developer instrument, not Product UI: its words are
 * English lab labels on purpose, and switching a direction is instant (a 100+/session action).
 *
 * The Product surfaces inside the phone frame — the temporal layer and the orientation chrome —
 * speak the frozen bilingual copy; the lab's own act buttons reuse T-08's `returnActWords` so no
 * new Product copy is authored here.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChromeLanguage } from '../../orientation-chrome';
import type { DirectionId, MotionProfile } from '../motion/profiles';
import { DIRECTIONS, DIRECTION_IDS } from '../motion/profiles';
import type { FrameReport } from './usePerfMeter';
import type { Scenario, ScenarioId } from './scenarios';

export interface LabControlsProps {
  readonly direction: DirectionId;
  readonly profile: MotionProfile;
  readonly reducedMotion: boolean;
  readonly systemReducedMotion: boolean;
  readonly language: ChromeLanguage;
  readonly rtl: boolean;
  readonly ignition: boolean;
  readonly scenarios: readonly Scenario[];
  readonly runningScenario: ScenarioId | null;
  readonly report: FrameReport | null;
  readonly readout: readonly string[];
  readonly status: readonly string[];
  readonly onDirection: (id: DirectionId) => void;
  readonly onReducedMotion: (on: boolean) => void;
  readonly onLanguage: (language: ChromeLanguage) => void;
  readonly onRtl: (on: boolean) => void;
  readonly onIgnition: (on: boolean) => void;
  readonly onScenario: (id: ScenarioId) => void;
  readonly onStopScenario: () => void;
  readonly onReset: () => void;
}

function Chip({ label, active, onPress, testID }: { readonly label: string; readonly active: boolean; readonly onPress: () => void; readonly testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      // Instant pressed feedback, no transition: a harness control is a 100+/session action.
      style={({ pressed }) => [styles.chip, active ? styles.chipActive : null, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function LabControls(props: LabControlsProps) {
  const { profile } = props;
  return (
    <View style={styles.panel} testID="qandeel-motion-lab-controls">
      <Text style={styles.title}>QANDEEL T-10.0 · Motion Lab</Text>
      <Text style={styles.small}>Prototype shootout. Nothing here is frozen.</Text>

      <Text style={styles.section}>Direction</Text>
      <View style={styles.row}>
        {DIRECTION_IDS.map((id) => (
          <Chip key={id} testID={`lab-direction-${id}`} label={`${id} · ${DIRECTIONS[id].name}`} active={props.direction === id} onPress={() => props.onDirection(id)} />
        ))}
      </View>
      <Text style={styles.small}>{profile.axis}</Text>

      <Text style={styles.section}>Conditions</Text>
      <View style={styles.row}>
        <Chip testID="lab-reduced" label={props.reducedMotion ? 'Reduced motion: on' : 'Reduced motion: off'} active={props.reducedMotion} onPress={() => props.onReducedMotion(!props.reducedMotion)} />
        <Chip testID="lab-language" label={props.language === 'ar' ? 'Copy: العربية' : 'Copy: English'} active={props.language === 'ar'} onPress={() => props.onLanguage(props.language === 'ar' ? 'en' : 'ar')} />
        <Chip testID="lab-rtl" label={props.rtl ? 'Direction: RTL' : 'Direction: LTR'} active={props.rtl} onPress={() => props.onRtl(!props.rtl)} />
        <Chip testID="lab-ignition" label={props.ignition ? 'Ignition cue: on' : 'Ignition cue: off'} active={props.ignition} onPress={() => props.onIgnition(!props.ignition)} />
      </View>
      {props.systemReducedMotion ? <Text style={styles.small}>The system reduce-motion setting is on; the reduced choreography is in force.</Text> : null}

      <Text style={styles.section}>Scenarios (same fixtures for every direction)</Text>
      <View style={styles.row}>
        {props.scenarios.map((scenario) => (
          <Chip key={scenario.id} testID={`lab-scenario-${scenario.id}`} label={scenario.title} active={props.runningScenario === scenario.id} onPress={() => props.onScenario(scenario.id)} />
        ))}
        <Chip label="Stop" active={false} onPress={props.onStopScenario} />
        <Chip testID="lab-reset" label="Reset session" active={false} onPress={props.onReset} />
      </View>
      <Text style={styles.small}>Drag the world to pan (momentum after release; grab it mid-flight). Tap a node to land on it. Drag the strip under the timeline to scrub.</Text>

      <Text style={styles.section}>Canonical state</Text>
      {props.readout.map((line, index) => (
        <Text key={`readout-${index}`} style={styles.mono}>
          {line}
        </Text>
      ))}

      <Text style={styles.section}>Frames (last second)</Text>
      <Text style={styles.mono}>
        {props.report === null
          ? 'measuring…'
          : `${props.report.frames} frames · avg ${props.report.averageMs} ms · worst ${props.report.worstMs} ms · >16.9 ms: ${props.report.over16} · >33.6 ms: ${props.report.over33}`}
      </Text>

      <Text style={styles.section}>Store answers</Text>
      {props.status.map((line, index) => (
        <Text key={`status-${index}`} style={styles.mono}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'column', rowGap: 6, padding: 16, maxWidth: 520 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  section: { marginTop: 10, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, lineHeight: 18, textTransform: 'uppercase', opacity: 0.7 },
  small: { fontSize: 12, lineHeight: 18, opacity: 0.8 },
  mono: { fontSize: 12, lineHeight: 18, fontFamily: 'monospace' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 32, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)', justifyContent: 'center' },
  chipActive: { backgroundColor: 'rgb(47,46,43)', borderColor: 'rgb(47,46,43)' },
  pressed: { opacity: 0.6 },
  chipText: { fontSize: 13, lineHeight: 18 },
  chipTextActive: { color: 'white' },
});
