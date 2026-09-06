import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { PresentationController } from '../window/controller';
import { runPresentationCommand } from './commands';

export function PresentationNavigator({ controller }: { controller: PresentationController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [command, setCommand] = useState('');
  const [invalid, setInvalid] = useState(false);
  const available = state.maximum > 0;
  const submit = () => setInvalid(!runPresentationCommand(controller, command));
  return <View>
    <View accessible accessibilityRole="adjustable" testID="timeline-position"
      accessibilityLabel="Position within already-disclosed Timeline"
      accessibilityState={{ disabled: !available }}
      accessibilityValue={{ min: 0, max: 100, now: state.position * 100,
        text: state.track.targets.length === 0 ? 'No disclosed Moments' : available
          ? `${Math.round(state.position * 100)}% of already-disclosed presentation range`
          : 'All disclosed positions fit; no presentation movement' }}
      accessibilityActions={[
        { name: 'increment', label: 'Later disclosed presentation region' },
        { name: 'decrement', label: 'Earlier disclosed presentation region' },
        { name: 'first', label: 'First disclosed presentation window' },
        { name: 'last', label: 'Last disclosed presentation window' },
        { name: 'refine', label: 'Refine presentation adjustment' },
        { name: 'widen', label: 'Widen presentation adjustment' },
      ]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) => {
        if (!available) return;
        if (actionName === 'increment' || actionName === 'decrement') controller.adjust(actionName === 'increment' ? 1 : -1);
        else runPresentationCommand(controller, actionName);
      }}><Text>{Math.round(state.position * 100)}% within disclosed presentation</Text></View>
    <Text>Presentation only: enter 0–100%, first, last, next, previous, +, -, refine or widen.</Text>
    <TextInput testID="timeline-command" accessibilityLabel="Disclosed presentation command" style={{ minHeight: 44 }}
      accessibilityHint="Enter 0 to 100 percent, first, last, next, previous, plus, minus, refine or widen. Moves visibility only."
      value={command} onChangeText={setCommand} onSubmitEditing={submit} returnKeyType="go"
      autoCapitalize="none" autoCorrect={false} maxLength={16} />
    <Pressable accessibilityRole="button" accessibilityLabel="Move disclosed presentation" onPress={submit} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text>Move presentation</Text>
    </Pressable>
    {invalid && <Text accessibilityRole="alert">Use 0–100%, first, last, next, previous, +, -, refine or widen.</Text>}
  </View>;
}
