# Contributing to English4Kids

## Multi-Agent Development Model

This project is built by a coordinated team of specialized roles (real subagents in the build process):

**Strategy:** Orchestrator · Product Architect · Critic / Red Team
**Pedagogy & Content:** Pedagogy Lead · Content Designer · Gamification Designer
**Audio:** Audio Director · Voice Casting Lead · Music Composer · Songwriter · SFX Designer · Pronunciation Coach · Audio Engineer · Audio Settings Specialist
**Design & Engineering:** UX/UI Designer · Frontend Engineer · Backend Engineer · Animation/Asset Engineer
**Quality & Safety:** Accessibility Auditor · Safety & Privacy Officer · QA Engineer · Parent Dashboard Specialist · DevOps

Each role owns specific documentation and code areas. Decisions go through the Orchestrator; the Critic agent reviews major output.

## Code Rules

1. **Open-source first.** No paid TTS/STT/music services at runtime. Pre-rendered Piper TTS, free CC0/CC-BY music only.
2. **Child safety > everything.** Microphone audio never leaves the device. No third-party trackers, no ad SDKs, no session replay on child pages.
3. **English-only UI for MVP** but all user-facing strings must be i18n-keyed (no hardcoded copy).
4. **Process-praise language only** in child copy. Banned: "Wrong," "No," "Incorrect," "You failed," "Smart/Clever/Genius."
5. **Tap targets ≥64px for 6–8 band, ≥48px for 9–12 band.**
6. **No leaderboards, no streaks-with-shame, no variable-reward loot, no time-pressure timers.**

## Assets

Every asset (audio/image/font) must be listed in `PROVENANCE.md` with source URL, license, date acquired. CI fails if a new asset lands without a provenance entry.

Allowed licenses: CC0 · CC-BY · MIT · Apache-2.0 · BSD-2/3 · OFL.
Forbidden: CC-NC · CC-ND · "royalty-free" without explicit license · AI-generated without model+prompt+date provenance.

## Commit Style

Conventional Commits.

```
feat(audio): add Howler wrapper with AudioUnlock
fix(content): correct phoneme entry for "rabbit"
docs(adr): add ADR-0004 — on-device speech processing
```

## Branches

- `main` — production-ready, protected
- `claude/<feature>` — Claude-driven development branches
- `feature/<scope>` — human feature branches

## PR Checklist

- [ ] Tests pass (`pnpm test`)
- [ ] Type-check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Content validates (`pnpm validate:content`)
- [ ] If you added assets → `PROVENANCE.md` updated
- [ ] If you touched child UI → passes Child UX Code (Honesty / Calm / Reversibility / Parent visibility / No financial coercion)
- [ ] If you touched audio scoring → no audio Blob created, no upload endpoint
