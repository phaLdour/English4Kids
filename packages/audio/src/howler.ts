// AudioPlayer wraps Howler.js with E4K's mixer model: four logical channels
// (master, music, sfx, voice), mute, and a focus-mode toggle that suppresses
// background music + non-essential SFX while preserving voice prompts and
// critical feedback (Pedagogy red line: focus mode must NEVER silence
// instructional voice).

import { Howl, Howler } from "howler";

export type AudioChannel = "master" | "music" | "sfx" | "voice";

export interface AudioPlayerConfig {
  /** 0..100 */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  muteAll: boolean;
  focusMode: boolean;
}

interface ActiveSound {
  howl: Howl;
  id: number;
  channel: AudioChannel;
  essential: boolean;
}

const clamp01to100 = (v: number): number =>
  Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

export class AudioPlayer {
  private config: AudioPlayerConfig;
  private sounds = new Map<string, ActiveSound>();
  private nextHandle = 1;

  constructor(config: AudioPlayerConfig) {
    this.config = {
      masterVolume: clamp01to100(config.masterVolume),
      musicVolume: clamp01to100(config.musicVolume),
      sfxVolume: clamp01to100(config.sfxVolume),
      voiceVolume: clamp01to100(config.voiceVolume),
      muteAll: config.muteAll,
      focusMode: config.focusMode,
    };
    Howler.mute(this.config.muteAll);
    Howler.volume(this.config.masterVolume / 100);
  }

  /** Returns the per-sound multiplier (0..1) for a channel given current state. */
  private effectiveVolume(channel: AudioChannel): number {
    if (this.config.muteAll) return 0;
    const ch =
      channel === "music"
        ? this.config.musicVolume
        : channel === "sfx"
          ? this.config.sfxVolume
          : channel === "voice"
            ? this.config.voiceVolume
            : 100;
    // Howler.volume() already applies the master; per-Howl volume is the
    // channel-relative gain only.
    return ch / 100;
  }

  setVolume(channel: AudioChannel, value: number): void {
    const v = clamp01to100(value);
    if (channel === "master") {
      this.config.masterVolume = v;
      Howler.volume(v / 100);
      return;
    }
    if (channel === "music") this.config.musicVolume = v;
    else if (channel === "sfx") this.config.sfxVolume = v;
    else if (channel === "voice") this.config.voiceVolume = v;

    // Update already-playing sounds in this channel.
    const gain = this.effectiveVolume(channel);
    for (const s of this.sounds.values()) {
      if (s.channel === channel) {
        s.howl.volume(gain, s.id);
      }
    }
  }

  toggleMute(): void {
    this.config.muteAll = !this.config.muteAll;
    Howler.mute(this.config.muteAll);
  }

  setFocusMode(enabled: boolean): void {
    this.config.focusMode = enabled;
    if (!enabled) return;
    // Stop background music + non-essential SFX immediately. Voice and any
    // essential SFX (e.g. correct/incorrect feedback) continue.
    for (const [handle, s] of this.sounds.entries()) {
      if (s.channel === "music" || (s.channel === "sfx" && !s.essential)) {
        s.howl.stop(s.id);
        this.sounds.delete(handle);
      }
    }
  }

  getConfig(): Readonly<AudioPlayerConfig> {
    return { ...this.config };
  }

  private register(howl: Howl, id: number, channel: AudioChannel, essential: boolean): string {
    const handle = `snd_${this.nextHandle++}`;
    this.sounds.set(handle, { howl, id, channel, essential });
    howl.on("end", () => this.sounds.delete(handle), id);
    howl.on("stop", () => this.sounds.delete(handle), id);
    return handle;
  }

  playMusic(src: string, opts?: { loop?: boolean; fadeMs?: number }): string {
    if (this.config.focusMode) return ""; // no-op handle
    const howl = new Howl({
      src: [src],
      loop: opts?.loop ?? true,
      volume: this.effectiveVolume("music"),
      html5: true, // streaming for longer tracks
    });
    const id = howl.play();
    if (opts?.fadeMs && opts.fadeMs > 0) {
      howl.volume(0, id);
      howl.fade(0, this.effectiveVolume("music"), opts.fadeMs, id);
    }
    return this.register(howl, id, "music", false);
  }

  playSfx(
    spriteName: string,
    opts?: { duckMusicDb?: number; essential?: boolean },
  ): string {
    const essential = opts?.essential ?? false;
    if (this.config.focusMode && !essential) return "";
    const howl = new Howl({
      src: [spriteName],
      volume: this.effectiveVolume("sfx"),
    });
    const id = howl.play();

    if (opts?.duckMusicDb && opts.duckMusicDb > 0) {
      // Convert dB attenuation to linear: amp = 10^(-dB/20)
      const factor = Math.pow(10, -opts.duckMusicDb / 20);
      for (const s of this.sounds.values()) {
        if (s.channel === "music") {
          const target = this.effectiveVolume("music") * factor;
          s.howl.fade(s.howl.volume(s.id) as number, target, 120, s.id);
        }
      }
      howl.on(
        "end",
        () => {
          for (const s of this.sounds.values()) {
            if (s.channel === "music") {
              s.howl.fade(
                s.howl.volume(s.id) as number,
                this.effectiveVolume("music"),
                240,
                s.id,
              );
            }
          }
        },
        id,
      );
    }

    return this.register(howl, id, "sfx", essential);
  }

  playVoice(src: string, opts?: { rate?: number }): string {
    // Voice always plays — even in focus mode and even if essential SFX are off.
    const howl = new Howl({
      src: [src],
      volume: this.effectiveVolume("voice"),
      rate: opts?.rate ?? 1.0,
    });
    const id = howl.play();
    return this.register(howl, id, "voice", true);
  }

  stop(handle: string): void {
    const s = this.sounds.get(handle);
    if (!s) return;
    s.howl.stop(s.id);
    this.sounds.delete(handle);
  }

  stopAll(): void {
    for (const s of this.sounds.values()) {
      s.howl.stop(s.id);
    }
    this.sounds.clear();
  }
}
