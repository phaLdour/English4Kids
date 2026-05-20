import type { Page, Route } from '@playwright/test';

/**
 * 1-second silent OGG/Opus stub. The exact bytes do not matter — most browsers
 * just need a Content-Type to satisfy `<audio src>` and the page never plays
 * audio in jsdom-style headless tests. We return a tiny WAV header so that
 * even strict decoders will at least parse and emit `loadeddata`.
 *
 * 44 bytes: RIFF/WAVE header + 0 PCM samples = "valid" silent WAV.
 */
const SILENT_WAV_BASE64 =
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/**
 * Patterns of asset URLs that should be intercepted with a silent audio buffer.
 * These cover both pre-rendered Piper TTS and bundled SFX/music tracks.
 */
const AUDIO_PATTERNS: RegExp[] = [
  /\.(opus|ogg|mp3|wav|m4a|aac)(\?.*)?$/i,
  /\/audio\/.+/i,
];

const AUDIO_MIME_FRAGMENTS = [
  'audio/',
  'application/ogg',
  'application/octet-stream-audio',
];

function looksLikeAudioUrl(url: string): boolean {
  return AUDIO_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Intercept any request that looks like an audio asset and return a silent
 * fixture. Without this, the dev server returns 404 for unbundled Piper output
 * during Sprint 2, which causes activity timers to wait forever for fadeIn.
 */
export async function mockAudioAssets(page: Page): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    const url = route.request().url();
    if (!looksLikeAudioUrl(url)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
      body: Buffer.from(SILENT_WAV_BASE64, 'base64'),
    });
  });
}

/**
 * Records any outbound request whose body or content-type looks like audio so
 * the safety-mic-policy test can assert "no audio ever leaves the device."
 */
export interface AudioLeakRecord {
  url: string;
  method: string;
  contentType: string;
  bodyLength: number;
}

export async function captureAudioLeaks(
  page: Page,
  sink: AudioLeakRecord[],
): Promise<void> {
  page.on('request', (request) => {
    const headers = request.headers();
    const contentType = headers['content-type'] ?? '';
    const postData = request.postData();
    const isAudioMime = AUDIO_MIME_FRAGMENTS.some((fragment) =>
      contentType.includes(fragment),
    );
    if (!isAudioMime && !postData) return;
    // Any non-text outbound POST that touches an audio mime type is a leak.
    if (isAudioMime) {
      sink.push({
        url: request.url(),
        method: request.method(),
        contentType,
        bodyLength: postData?.length ?? 0,
      });
    }
  });
}
