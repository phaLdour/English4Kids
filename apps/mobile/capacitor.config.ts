import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the English4Kids mobile wrappers.
 *
 * Strategy: the same Next.js codebase ships as the web PWA *and* as the
 * embedded WebView payload here. `webDir` points at the static export
 * produced by `pnpm --filter @e4k/web build` with `E4K_TARGET=mobile`.
 *
 * Privacy invariants (Safety Officer-owned):
 *   - No analytics SDKs inside the WebView. The CSP rules from
 *     `apps/web/next.config.ts` carry over because the same HTML is served.
 *   - Microphone audio is on-device only. We use the community speech
 *     recognition plugin which routes through the platform's built-in
 *     speech APIs; no audio frames leave the device.
 */
const config: CapacitorConfig = {
  appId: 'app.english4kids',
  appName: 'English4Kids',
  webDir: '../web/out',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
    backgroundColor: '#FFF8EE',
  },
  android: {
    backgroundColor: '#FFF8EE',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFF8EE',
    },
    Microphone: {
      // No upload; on-device only per Safety Officer policy.
    },
    SpeechRecognition: {
      // Web Speech API surrogate; on-device only.
    },
  },
};

export default config;
