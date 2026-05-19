// Text-to-Speech adapters.
//
// Two implementations:
//   - WebSpeechTts: uses the browser's built-in `speechSynthesis`. Default.
//   - PrerenderedTts: plays a Piper-rendered .opus file from the static assets
//     directory. Preferred when an asset has been pre-rendered at build time.
//
// Build-time pre-rendering is out of scope for Sprint 1; PrerenderedTts ships
// now so the rest of the app can target a stable interface.

import { Howl } from "howler";

export interface TtsSpeakOptions {
  lang?: string;
  rate?: number;
  voice?: SpeechSynthesisVoice;
}

export interface TtsAdapter {
  /** Speak the given text or asset id. Resolves when playback ends. */
  speak(textOrAssetId: string, opts?: TtsSpeakOptions): Promise<void>;
  isAvailable(): boolean | Promise<boolean>;
}

// --- WebSpeechTts -----------------------------------------------------------

export class WebSpeechTts implements TtsAdapter {
  private voicesCache: SpeechSynthesisVoice[] = [];

  /**
   * Voices load asynchronously on first access in most browsers. We wait up
   * to ~750ms for the list to populate before giving up.
   */
  async listVoices(): Promise<SpeechSynthesisVoice[]> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    const synth = window.speechSynthesis;
    const initial = synth.getVoices();
    if (initial.length > 0) {
      this.voicesCache = initial.filter((v) => v.lang.toLowerCase().startsWith("en"));
      return this.voicesCache;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 750);
      synth.addEventListener(
        "voiceschanged",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
    this.voicesCache = synth
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith("en"));
    return this.voicesCache;
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    const voices = await this.listVoices();
    return voices.length > 0;
  }

  speak(text: string, opts?: TtsSpeakOptions): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return Promise.reject(new Error("speechSynthesis not available"));
    }
    return new Promise<void>((resolve, reject) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = opts?.lang ?? "en-US";
      if (opts?.rate !== undefined) utter.rate = opts.rate;
      if (opts?.voice) utter.voice = opts.voice;
      utter.onend = () => resolve();
      utter.onerror = (e) => reject(new Error(`tts error: ${e.error}`));
      window.speechSynthesis.speak(utter);
    });
  }
}

// --- PrerenderedTts ---------------------------------------------------------

export class PrerenderedTts implements TtsAdapter {
  private basePath: string;

  constructor(basePath = "/audio/narration") {
    this.basePath = basePath.replace(/\/$/, "");
  }

  isAvailable(): boolean {
    return typeof window !== "undefined";
  }

  /**
   * @param assetId stable id matching the build-time render, e.g. "u1.l1.intro".
   *                Files are expected at `${basePath}/${assetId}.opus`.
   */
  speak(assetId: string, _opts?: TtsSpeakOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const howl = new Howl({
        src: [`${this.basePath}/${assetId}.opus`],
        volume: 1.0,
      });
      howl.once("end", () => resolve());
      howl.once("loaderror", () => reject(new Error(`tts asset missing: ${assetId}`)));
      howl.once("playerror", () => reject(new Error(`tts play failed: ${assetId}`)));
      howl.play();
    });
  }
}

/**
 * Choose the TTS adapter. When `preferPrerendered` is true and we're in a
 * browser, return PrerenderedTts; otherwise fall back to WebSpeechTts.
 *
 * The caller is responsible for handling the case where a specific asset is
 * not available in the prerendered set (PrerenderedTts.speak rejects).
 */
export function pickTts(preferPrerendered: boolean): TtsAdapter {
  if (preferPrerendered && typeof window !== "undefined") {
    return new PrerenderedTts();
  }
  return new WebSpeechTts();
}
