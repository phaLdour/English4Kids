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
 *
 * Sprint 5 additions: SplashScreen colour, StatusBar styling, Android
 * https scheme (required so the service worker registers inside the
 * WebView), and SpeechRecognition permission timing.
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
    // No mixed-content fallback; the WebView is served over https only.
    allowMixedContent: false,
  },
  server: {
    // The Android scheme must be https to satisfy the service worker
    // secure-context check. Without it, Workbox refuses to install
    // (security model treats `file:` and bare `http:` as insecure).
    // iOS uses capacitor:// by default which is already secure.
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFF8EE',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#FFF8EE',
      overlaysWebView: false,
    },
    Microphone: {
      // No upload; on-device only per Safety Officer policy.
    },
    SpeechRecognition: {
      // 'always' = the plugin should request OS-level mic + speech
      // recognition permissions on first call. The in-app primer
      // (MicIndicator + onboarding card) explains what's about to happen
      // before the system prompt appears.
      permissions: 'always',
    },
  },
};

export default config;
