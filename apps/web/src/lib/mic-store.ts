// SAFETY INVARIANTS (do NOT change without Safety Officer sign-off):
// - No MediaRecorder. Only SpeechRecognition / whisper.wasm STT adapters
//   reach for the microphone, and only this store's `active` flag flips
//   on while one of those adapters is running.
// - This module never touches `navigator.mediaDevices` itself. It only
//   coordinates UI state across mic-touching components.
// - `stopRequest` is a monotonic counter — subscribers compare values to
//   detect a fresh stop request without depending on equality semantics.

'use client';

import { create } from 'zustand';

export interface MicStore {
  /** True while any `useMicSession()` is in `listening` state. */
  active: boolean;
  setActive: (active: boolean) => void;
  /**
   * Monotonic counter. Increments each time the user clicks "Stop talking" in
   * the persistent MicIndicator. Active sessions subscribe to this and call
   * their internal stop() when it advances.
   */
  stopRequest: number;
  requestStop: () => void;
}

export const useMicStore = create<MicStore>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
  stopRequest: 0,
  requestStop: () => set((s) => ({ stopRequest: s.stopRequest + 1 })),
}));
