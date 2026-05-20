# ADR 0001 — Next.js 15 + Tailwind v4 + Capacitor (deferred) for stack

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Product Architect, UX/UI Designer, Pedagogy Lead, Critic Wave-1, user
- **Supersedes:** —

## Context

We are starting from an empty repository and need to ship a web-first MVP for kids aged 6–12 that:

- Runs primarily in a browser as an installable PWA (offline-capable).
- Keeps a credible path open to native mobile (iOS, Android) without a rewrite.
- Supports rich audio (BGM, narration, SFX, songs), tap-friendly UI, animations, and reduced-motion modes.
- Is type-safe end-to-end and easy for a small team (or solo + AI agents) to maintain.
- Allows i18n later (UI in English at MVP, but content/translations can grow).

## Decision

Adopt the following stack for the MVP:

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Mature SSR + RSC + static export support; first-class TS; large ecosystem; PWA-friendly via Serwist. |
| UI runtime | **React 19** | Aligns with Next.js 15; concurrent features for animation handoff. |
| Language | **TypeScript (strict)** | Project-wide; `tsconfig.base.json` extends to all packages. |
| Styling | **Tailwind CSS v4** | Token-driven; v4 has fast Lightning CSS engine; pairs with design-tokens.md. |
| UI primitives | **Radix UI** | Accessible primitives (Dialog, Tooltip, Toast) — critical for child UX. |
| Animation | **Motion** (formerly Framer Motion) + **Lottie** | Motion for state transitions; Lottie for mascot/celebrations (2 MB cap, see ADR 0006). |
| State | **Zustand** | Tiny, no boilerplate; ideal for per-activity local state. |
| Server data | **TanStack Query** | Caching + retry + offline tolerance for Supabase calls. |
| Local DB | **Dexie** (IndexedDB) | Local-first store for progress + queued sync events. |
| Backend | **Supabase** | See ADR 0003. |
| Audio engine | **Howler.js** | Sprite support, format fallback, mobile-friendly unlock. |
| Speech | Web Speech API default + whisper.cpp WASM opt-in | See ADR 0002. |
| PWA | **Serwist** | Modern Workbox successor; first-class Next.js integration. |
| i18n | **next-intl** | Wired now even though MVP ships English-only — avoids future re-plumbing. |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Standard. |
| Lint/format | **Biome** | Fast, single-tool replacement for ESLint+Prettier. |
| Build orchestration | **Turbo** + pnpm workspaces | Caches across packages; required by the monorepo layout. |

**Capacitor is deferred to Phase 2.** When/if we wrap for iOS/Android, we will static-export `/play/*` routes only (the gameplay surface), keep `/parents/*` server-rendered for the web, and ship the player as a Capacitor WebView app.

## Consequences

**Positive**

- Single codebase usable today on web and tomorrow on mobile.
- Strong TS guarantees catch many bugs before runtime — important when no dedicated QA exists.
- Tailwind v4 + design tokens give us consistent visual language without a heavy design-system package.
- Serwist + Dexie enable real offline play, which is one of our north-star differentiators.

**Negative / Risks**

- React 19 is recent; some third-party libs may still be migrating. Mitigation: pin versions, watch upstream.
- Static export imposes constraints on `/play/*` (no server components beyond Generate Static Params). We accept this.
- Howler is in maintenance mode; if it becomes unmaintained, the audio package abstracts it so we can swap.

## Alternatives Rejected

| Option | Why rejected |
|---|---|
| Remix | Smaller ecosystem, weaker static-export story for our future Capacitor wrap. |
| Vite + React SPA | We would re-implement routing, SSR, i18n, PWA plumbing manually. |
| Expo / React Native | Doubles the codebase too early; web parity for our audio/animation stack is unproven. |
| Astro | Excellent for content sites but weaker for the interactive `/play/*` surface. |
| SvelteKit | Team familiarity with React is higher; fewer kid-app reference projects. |

## Open Questions

- Lottie player choice (`@lottiefiles/react-lottie-player` vs `dotlottie`) — to be benchmarked in Sprint 2.
- Whether to add `tRPC` for parent-dashboard server calls or stick to TanStack Query against Supabase REST — to be decided when the dashboard work starts.
