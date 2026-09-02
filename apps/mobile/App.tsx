import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './src/i18n';
import { DirectionProvider } from './src/shell/DirectionContext';
import { LiveAnalysisSpikeScreen } from './src/screens/LiveAnalysisSpikeScreen';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DirectionProvider>
          <LiveAnalysisSpikeScreen />
          <StatusBar style="dark" />
        </DirectionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
