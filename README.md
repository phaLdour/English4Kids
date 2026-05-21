# English4Kids

A gamified, audio-rich English learning platform for kids 6–12. Built open-source-first, COPPA/GDPR-K compliant, offline-capable PWA.

## Vision

Help children build real English confidence through play. Two age bands (6–8 Lower / 9–12 Upper), CEFR Pre-A1 → A1 (MVP) → A2 (post-MVP). Friendly mascot Milo the Fox narrates; no time pressure, no leaderboards, no dark patterns, no third-party tracking on child pages.

## Status

Soft-launch ready (post-ADR-0009 plus the Yayınlama Sprinti release-polish wave). Three CEFR Pre-A1 units shipped (12 lessons total), full mascot voice parity (Milo + Luna), EN/TR locale symmetry, anonymous-first 3-layer cloud sync gate, offline PWA with adaptive bitrate audio, Capacitor static export for iOS / Android, end-to-end CI gates green. External blockers tracked in `docs/launch/soft-launch-checklist.md`: accounts, signing keys, DNS, store submission assets, three privacy placeholders.

## Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript strict
- **Styling**: Tailwind CSS v4 + Radix primitives
- **State**: Zustand (client) + TanStack Query (server)
- **Local DB**: Dexie.js (IndexedDB)
- **Backend**: Supabase (Postgres + Auth + RLS)
- **Audio**: Howler.js + Web Speech API (TTS/STT) + Piper TTS pre-render (build time) + whisper.cpp WASM (opt-in offline)
- **Animation**: Motion (Framer) + Lottie
- **PWA**: Serwist
- **Testing**: Vitest + Testing Library + Playwright
- **CI/CD**: GitHub Actions + Vercel (web) + Capacitor (post-MVP for mobile)

## Project Structure

```
English4Kids/
├── apps/web/                 # Next.js application (kid app + parent dashboard)
├── packages/
│   ├── audio/                # Howler wrapper, TTS, STT, pronunciation
│   ├── game-engine/          # Pure TS: Leitner SR, stars, attempt evaluation
│   ├── content-schema/       # Zod schemas validating content JSON
│   ├── ui/                   # Shared design system components
│   └── db/                   # Supabase types + Dexie schema
├── content/units/            # In-repo JSON learning content
├── supabase/migrations/      # Postgres migrations + RLS
├── docs/                     # ADRs, audio map, design specs, pedagogy
└── tests/e2e/                # Playwright E2E
```

## Getting Started

```bash
# Prerequisites: Node 20+, pnpm 9+
nvm use
pnpm install

# Dev
pnpm dev

# Build
pnpm build

# Tests
pnpm test
pnpm test:e2e

# Content validation
pnpm validate:content
```

## Documentation

- [Architecture Decision Records](./docs/adr/) — start with ADR-0009 (MVP soft-launch sign-off) and ADR-0015 (soft-launch readiness)
- [Soft-launch checklist](./docs/launch/soft-launch-checklist.md) — exhaustive list of external blockers (accounts, secrets, store assets)
- [QA Lead final report](./docs/launch/qa-lead-final-report.md) — Sprint 6 audit trail (25 findings closed)
- [Audio strategy](./docs/audio/)
- [Pedagogy](./docs/pedagogy/) — process-praise tone, banned phrasings, mascot voice contract
- [Safety & Privacy](./docs/safety/) — microphone policy, COPPA / GDPR-K alignment
- [Sprint plans](./docs/sprints/)
- [Contributing](./CONTRIBUTING.md)

## Safety & Privacy

- **No PII collected from kids** — anonymous-first, animal nickname only.
- **No microphone audio leaves the device** — STT runs in-browser; only numeric pronunciation score is stored.
- **No third-party tracking on child pages**.
- **COPPA + GDPR-K + UK Age-Appropriate Design Code aligned**.

See [docs/safety/](./docs/safety/) for full posture.

## License

MIT for code. Assets are CC0/CC-BY only — see [PROVENANCE.md](./PROVENANCE.md) and [LICENSES/](./LICENSES/).
