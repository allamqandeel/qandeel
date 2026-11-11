import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { analysisCopy, presentationCommandHelper, type AnalysisLanguage } from '../../analysis-language';
import { useAnalysisInk, useAnalysisType } from '../../analysis-visual';
import type { PresentationController } from '../window/controller';
import { runPresentationCommand } from './commands';

/**
 * The non-drag route to T-05's presentation window. Every word is the reader's language, from the
 * W1A-01 Analysis copy; the command field accepts the approved commands of BOTH languages.
 */
export function PresentationNavigator({ controller, language = 'en', tools = true }: {
  controller: PresentationController;
  language?: AnalysisLanguage;
  /**
   * MAP-CLOSE-01 V-3 (PO addendum): the typed command route and its guidance are details on request. Hidden, the
   * position element stays — it is the window's one accessible route and states where the view is — and the command
   * field, its helper and its act return with the details. Absent, everything is shown, exactly as before.
   */
  tools?: boolean;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [command, setCommand] = useState('');
  const [invalid, setInvalid] = useState(false);
  const copy = analysisCopy(language);
  // VPORT-02: the Analysis ink and type. The navigator's words, routes and actions are unchanged.
  const ink = useAnalysisInk();
  const type = useAnalysisType();
  const helper = presentationCommandHelper(language);
  const available = state.maximum > 0;
  const percent = Math.round(state.position * 100);
  const submit = () => setInvalid(!runPresentationCommand(controller, command));
  // MAP-CLOSE-01 V-3: every line starts on the reader's side, a physical side read from the Product language.
  const side = { textAlign: language === 'ar' ? 'right' : 'left' } as const;
  return <View style={{ paddingHorizontal: 16 }}>
    <View accessible accessibilityRole="adjustable" testID="timeline-position"
      accessibilityLabel={copy.timelineViewPosition}
      accessibilityLanguage={language}
      accessibilityState={{ disabled: !available }}
      accessibilityValue={{ min: 0, max: 100, now: state.position * 100,
        text: state.track.targets.length === 0 ? copy.noMomentYet : available
          ? copy.viewPercentage(percent)
          : copy.allVisible }}
      accessibilityActions={[
        { name: 'increment', label: copy.commands.next },
        { name: 'decrement', label: copy.commands.previous },
        { name: 'first', label: copy.commands.first },
        { name: 'last', label: copy.commands.last },
        { name: 'refine', label: copy.narrowView },
        { name: 'widen', label: copy.widenView },
      ]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) => {
        if (!available) return;
        if (actionName === 'increment' || actionName === 'decrement') controller.adjust(actionName === 'increment' ? 1 : -1);
        else runPresentationCommand(controller, actionName);
      }}><Text style={[type('metadata'), { color: ink.secondary }, side]}>{copy.viewPercentage(percent)}</Text></View>
    {tools && <>
    <Text style={[type('metadata'), { color: ink.tertiary }, side]}>{helper}</Text>
    <TextInput testID="timeline-command" accessibilityLabel={copy.moveView} accessibilityLanguage={language} style={[type('supporting'), { minHeight: 44, color: ink.primary, borderBottomWidth: 1, borderColor: ink.tertiary }, side]}
      selectionColor={ink.primary}
      accessibilityHint={helper}
      value={command} onChangeText={setCommand} onSubmitEditing={submit} returnKeyType="go"
      autoCapitalize="none" autoCorrect={false} maxLength={16} />
    <Pressable accessibilityRole="button" accessibilityLabel={copy.moveView} onPress={submit} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={[type('action'), { color: ink.primary }, side]}>{copy.moveView}</Text>
    </Pressable>
    {invalid && <Text accessibilityRole="alert" style={[type('metadata'), { color: ink.error }, side]}>{helper}</Text>}
    </>}
  </View>;
}
