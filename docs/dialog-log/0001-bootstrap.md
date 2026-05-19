# Dialog Log 0001 — Bootstrap

A factual log of the multi-agent execution that produced the Sprint 1 plan. Dialog logs are the project's institutional memory: who said what, what was decided, what was deferred.

## Agents spawned

### Wave 1 (parallel)

1. **Pedagogy Lead** — CEFR map, age bands, scaffolding pattern, spaced repetition recommendation (Leitner), banned phrasings, red lines.
2. **Audio Director** — voice/music/SFX palette, loudness targets, audio map schema, pronunciation-scoring proposal.
3. **Product Architect** — stack choice, monorepo shape, Supabase posture, data model.
4. **Safety & Privacy Officer** — COPPA/GDPR-K posture, mic policy, asset licensing, CI gates.

### Critic Wave-1 (after Wave 1)

5. **Critic** — adversarial review of all four Wave-1 outputs.

### Wave 2 (after Critic + user decisions)

6. **UX/UI Designer** — design tokens, screen flows, accessibility rules, mascot screen integration.
7. **Gamification Designer** — stars, word garden, streak, what to defer.
8. **Content Designer** — Unit 1 outline, vocabulary list, copy voice, banned-phrasing list cross-check.

## Cross-agent decisions (the locked set)

| Area | Decision | Driver |
|---|---|---|
| **Spaced repetition** | Modified Leitner 5-box. SM-2 explicitly rejected. | Pedagogy Lead proposed; Critic Wave-1 caught a schema-design conflict where SM-2 fields had leaked into the data model; user confirmed Leitner. See ADR 0004. |
| **Bundle aggression** | Drop runtime Piper, drop runtime g2p / CMU dict, one mascot (Milo), Lottie 2 MB cap, whisper opt-in, 3 songs (not 5). | Critic Wave-1 measured ~100–140 MB projected payload; flagged as ship-blocker on low-end Android. User accepted all cuts. See ADR 0006. |
| **Speech** | Hybrid: Web Speech API default + whisper.cpp WASM opt-in for offline. | Safety Officer + Critic. Web Speech alone has Chrome-cloud-routing concerns; whisper alone is 40 MB. User chose hybrid with parent disclosure. See ADR 0002. |
| **Gamification** | Stars + Word Garden + Streak (with weekly freeze day). XP, levels, badges, leaderboards all deferred. | Gamification Designer proposed full ladder; Pedagogy Lead pushed back on XP/levels as creating implicit comparison; user agreed to minimal. |
| **Parent dashboard** | Anonymous + math-gate only at MVP. Email-plus-VPC deferred to Phase 2. | Safety Officer recommended minimum-collection posture. Sync to Supabase is wired but not active until Phase 2. |
| **Songs** | 3 for MVP, not 5. | Bundle cut. |
| **Mascot count** | 1 (Milo) for MVP. Luna deferred. | Bundle cut. |
| **Mobile** | Capacitor deferred to Phase 2. Web-first PWA at MVP. `/play/*` routes designed to be static-exportable so a future wrap is straightforward. | Product Architect + user. |

## Decisions explicitly deferred

- Headless CMS adoption (see ADR 0005).
- Email-plus-VPC parental verification + Supabase sync activation (Phase 2).
- Luna mascot, runtime Piper, runtime g2p, songs 4 and 5 (ADR 0006).
- Capacitor wrap.
- Leaderboards, badges, XP — Pedagogy Lead's veto stands unless re-litigated.
- Multi-locale rollout (next-intl is wired; locales are not authored).

## Process notes

- Subagents were spawned via the orchestrator's multi-agent prompt with explicit role contracts.
- Each subagent produced a markdown deliverable; the Critic was the only agent permitted to read all four Wave-1 outputs in one pass.
- User decisions (the "locked set" above) were captured by the orchestrator and are the binding output of this dialog. They take precedence over any contradictory subagent recommendation.

## Next dialog

`0002-critic-wave-1-findings.md` covers the specific issues Critic Wave-1 raised and how each was resolved.
