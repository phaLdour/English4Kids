// Barrel re-exports for @e4k/audio public API.
// Privacy contract: NO raw audio (Blob / MediaRecorder / ArrayBuffer of mic input)
// ever leaves these modules. Only numeric scores and recognised text are
// surfaced to the application layer.

export { AudioUnlock } from "./unlock.js";
export { AudioPlayer } from "./howler.js";
export type { AudioPlayerConfig, AudioChannel } from "./howler.js";

export {
  WebSpeechTts,
  PrerenderedTts,
  pickTts,
} from "./tts.js";
export type { TtsAdapter, TtsSpeakOptions } from "./tts.js";

export {
  WebSpeechStt,
  WhisperWasmStt,
  pickStt,
  registerWhisperModuleProvider,
} from "./stt.js";
export type {
  SttAdapter,
  SttPreference,
  SttRecognizeOptions,
  SttResult,
  WhisperLoaderState,
  WhisperModuleProvider,
  WhisperRuntimeHandle,
} from "./stt.js";

export { scorePronunciation } from "./pronunciation.js";
export type {
  PronunciationScoreResult,
  PronunciationBand,
  AgeBand,
  Strictness,
  PhonemeMap,
} from "./pronunciation.js";
