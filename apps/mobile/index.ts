import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  // Order matters and the failure mode is subtle: `@shopify/react-native-skia` builds its
  // `Skia` façade from `global.CanvasKit` the moment the module is evaluated. A static
  // `import App from './App'` here would pull Skia in before CanvasKit exists, leaving a
  // façade whose `Skia.Path` is undefined — the app mounts, then dies the first time a
  // path is built. So App is imported only after the wasm has landed.
  //
  // `scripts/copy-canvaskit.js` puts the .wasm in `public/` at prestart, which is why the
  // loader is pointed at the site root.
  void import('@shopify/react-native-skia/lib/module/web')
    .then(({ LoadSkiaWeb }) => LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }))
    .then(() => import('./App'))
    .then(({ default: App }) => registerRootComponent(App));
} else {
  void import('./App').then(({ default: App }) => registerRootComponent(App));
}
