// iOS Safari (and other mobile browsers) require a user gesture before an
// AudioContext can produce sound. We open one shared context inside a click /
// tap handler, play a silent buffer, and remember that we've done so. The
// shared context can then be used by Howler and the rest of the audio stack.

let unlocked = false;
let sharedContext: AudioContext | null = null;

type WebkitWindow = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as WebkitWindow;
  if (typeof w.AudioContext !== "undefined") return w.AudioContext;
  if (typeof w.webkitAudioContext !== "undefined") return w.webkitAudioContext;
  return null;
}

/**
 * AudioUnlock primes the browser audio pipeline from a user gesture.
 *
 * Usage:
 *   button.addEventListener('click', () => AudioUnlock.unlock());
 *
 * Idempotent: calling unlock() repeatedly is safe and cheap.
 */
export class AudioUnlock {
  static isUnlocked(): boolean {
    return unlocked;
  }

  /**
   * Get the shared AudioContext used to gate playback. Returns null in
   * non-browser environments (SSR / tests). Consumers should treat absence
   * as "audio not available" rather than an error.
   */
  static getContext(): AudioContext | null {
    return sharedContext;
  }

  /**
   * Resume the shared AudioContext and play a tiny silent buffer to satisfy
   * iOS Safari's autoplay gate. MUST be called from inside a user-gesture
   * handler the first time; subsequent calls are no-ops.
   */
  static async unlock(): Promise<void> {
    if (unlocked) return;

    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      // SSR or unsupported environment — flip the flag so the rest of the
      // app can continue (it will simply have no audio).
      unlocked = true;
      return;
    }

    if (!sharedContext) {
      sharedContext = new Ctor();
    }

    if (sharedContext.state === "suspended") {
      try {
        await sharedContext.resume();
      } catch {
        // Resume can fail outside a gesture; we still try the silent buffer
        // below and re-throw only if both paths fail.
      }
    }

    try {
      const buffer = sharedContext.createBuffer(1, 1, 22050);
      const source = sharedContext.createBufferSource();
      source.buffer = buffer;
      source.connect(sharedContext.destination);
      source.start(0);
    } catch {
      // If buffer creation fails we still consider ourselves "unlocked" so we
      // don't loop forever — Howler will surface a more specific failure on
      // its first real play call.
    }

    unlocked = true;
  }

  /** Test-only: reset internal state. Not part of the public contract. */
  static _resetForTests(): void {
    unlocked = false;
    sharedContext = null;
  }
}
