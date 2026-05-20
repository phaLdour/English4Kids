# Sprint 3 — Mic + Stories + Songs + Parent Dashboard + PWA offline

**Goal:** Bring up the mic-based experiences (Speak It!), the Story Time and Sing Along activities, the Word Garden, the Streak feature, the anonymous Parent Dashboard, and the offline-capable PWA precache.

## Scope

### Speak It! (Pronunciation activity)

- [ ] `apps/web/src/app/(player)/activities/speak-it/` activity.
- [ ] First-run mic disclosure modal + Parent Gate (math challenge) per `docs/safety/microphone-policy.md`.
- [ ] Web Speech engine integration (default).
- [ ] **whisper.cpp WASM** opt-in: lazy download, IndexedDB caching, progress UI, fallback messaging.
- [ ] Pronunciation scoring (`packages/audio/src/scoring`) per `docs/audio/pronunciation-scoring.md`.
- [ ] Persistent red-dot mic indicator.
- [ ] Push-to-talk by default; continuous toggle for age band 9–12.
- [ ] 3-attempt safeguard.

### Story Time

- [ ] `apps/web/src/app/(player)/activities/story-time/` activity.
- [ ] Reads a short illustrated story aloud (pre-rendered narration), highlights words as they're spoken.
- [ ] Tap-a-word to hear it again.
- [ ] No mic; no quiz; pure exposure.

### Sing Along

- [ ] Full karaoke-style UI for the 3 MVP songs.
- [ ] Lyric highlighting timed to the audio.
- [ ] No mic scoring — singing is for joy, not assessment.

### Word Garden

- [ ] Visual representation of Leitner state per vocabulary word.
- [ ] Each word is a plant: seed (Box 1) → sprout (Box 2) → bud (Box 3) → bloom (Box 4) → star (Box 5).
- [ ] Tap-a-plant to see the word and hear it.
- [ ] Garden grows alongside the child; no comparison to other children.

### Streak

- [ ] Daily play streak counter.
- [ ] **Freeze day** auto-restores once per week if the child misses a day (per Pedagogy red lines).
- [ ] Streak number is celebratory but not punitive — losing it is calm, not catastrophic.

### Parent Dashboard

- [ ] Anonymous + math-gate (no email at MVP; email-plus-VPC deferred to Phase 2 per ADR 0003).
- [ ] Shows: mastered words count, streak, last play date, attempts-needing-review list (Speak It! 3-attempt safeguard hits), settings panel.
- [ ] No raw transcripts displayed (privacy).
- [ ] "Reset progress" button with confirm dialog.

### PWA offline

- [ ] Serwist precache: app shell + Unit 1 content + Unit 1 audio + design tokens + font subset.
- [ ] Lazy precache: Units 2–5 fetched in background after first idle.
- [ ] Service worker update flow with a soft "new version available" banner.

### Bundle size verification

- [ ] `size-limit` CI check added; build fails if `/play/*` exceeds 25 MB.
- [ ] Run on a real low-end Android target; measure install time on 4G.

## Acceptance criteria

1. A child can complete a full lesson including a Speak It! activity end-to-end without internet.
2. Parent can enter the dashboard via the math gate and see meaningful progress data.
3. whisper.cpp WASM works on a low-end Android target (2 GB RAM, Chromium); inference ≤ 2 s on a 1-second utterance.
4. Streak survives day-to-day usage; freeze day auto-applies once per week.
5. `pnpm test` and Playwright e2e pass.
6. Lighthouse PWA audit ≥ 95 on the player route.
7. No CI safety-lint hit; no provenance-check hit.

## Out of scope (Phase 2)

- Capacitor wrap for iOS/Android.
- Email-plus-VPC + Supabase sync activation.
- Luna mascot.
- Runtime Piper TTS.
- Runtime g2p (out-of-curriculum word scoring).
- Songs 4–5.
- Units 6+.
- Karaoke vocal-stem mode.
- Headless CMS.
- Multi-locale rollout.

## Risks

- **whisper.cpp WASM on low-end Android** is the highest-risk item. If it cannot meet the 2 s inference budget, we ship Speak It! with Web Speech only and the offline mode becomes a Phase 2 deliverable.
- **Parental gate UX** — math challenges that are too easy can be solved by older kids; too hard locks out parents. Pilot with 3+ parents before merging.
- **Streak freeze-day messaging** — needs careful copy. Test the wording with a parent reviewer.
