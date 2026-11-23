/**
 * REPLAY-COSMOS-01 — the in-app drawing of a Replay's COSMOS stage at scoped presentation time t: `replayCosmosFrame`
 * in a `<Canvas>`, the same element tree the video export renders offscreen. No gesture is attached: the guided camera
 * is the Replay's, and nothing the reader does in the app moves or rewrites it.
 */
import { Canvas } from '@shopify/react-native-skia';
import { View } from 'react-native';

import { replayCosmosFrame, type ReplayCosmosScene, type ReplayFrameImages } from './frame';

export const REPLAY_COSMOS_TEST_ID = 'qandeel-replay-cosmos';

export function ReplayCosmosStage({ scene, images, t, width, height, accessibilityLabel }: {
  readonly scene: ReplayCosmosScene; readonly images: ReplayFrameImages | null; readonly t: number;
  readonly width: number; readonly height: number; readonly accessibilityLabel?: string;
}) {
  return (
    <View testID={REPLAY_COSMOS_TEST_ID} style={{ width, height }} accessible={accessibilityLabel !== undefined} accessibilityLabel={accessibilityLabel} pointerEvents="none">
      {/* The drawing itself is not announced: what it shows is said by the chrome's sentences (residue R-6). */}
      <View style={{ width, height }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Canvas style={{ width, height }} opaque>
          {replayCosmosFrame(scene, images, t, width, height)}
        </Canvas>
      </View>
    </View>
  );
}
