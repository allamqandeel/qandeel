import { Stack } from 'expo-router';

/**
 * Root technical container (T-01).
 *
 * One stack, one technical route, no product routes. QANDEEL navigation is not a
 * route stack: the frozen return/orientation acts arrive with T-02 and later as
 * canonical state actions. Nothing in this file may grow into a product route tree.
 */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
