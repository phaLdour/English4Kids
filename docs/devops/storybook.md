# Storybook

The `@e4k/ui` package ships a Storybook 8 instance for visual review, a11y
checks, and component documentation. It is **local-only** for MVP — we
descoped Chromatic per Critic review until we have a budget owner and a
content-review checklist that doesn't blow up on every PR.

## Running locally

```bash
pnpm --filter @e4k/ui storybook
# or, from the repo root:
pnpm storybook
```

Storybook starts on http://localhost:6006.

## Where stories live

Each component in `packages/ui/src/components/` has a sibling
`<Component>.stories.tsx`. Stories cover the default state plus key variants
(reactions, states, sizes). Meta exports are tagged `autodocs` so the
auto-generated docs page is the canonical reference.

## Addons

| Addon | Purpose |
| --- | --- |
| `@storybook/addon-essentials` | Controls, Docs, Actions, Viewport, etc. |
| `@storybook/addon-a11y` | Axe-core panel — must be green before merge. |
| `@storybook/addon-interactions` | Step debugger for play-functions. |

The a11y addon is configured to enforce `color-contrast` globally in
`packages/ui/.storybook/preview.ts`. Components that intentionally lower
contrast (e.g., disabled states) should override `parameters.a11y.config`
on that specific story.

## Design tokens

`packages/ui/.storybook/preview.css` is a flat copy of the production
`@theme` block. If you add a new token to `apps/web/src/app/globals.css`,
mirror it here. Keeping the file flat (no `@import`) means Storybook does
not need to spin up the full Tailwind pipeline.

## Building a static export

```bash
pnpm --filter @e4k/ui build-storybook
```

Output goes to `packages/ui/storybook-static/` (gitignored). The static
build is useful for sharing review links via any static host, but we do not
deploy it from CI today.

## Deployment plan

Chromatic was descoped per Critic — Storybook stays local-only for MVP. We
will revisit once:

1. Pedagogy + Safety teams sign off on which component variants are
   contractually frozen.
2. We have a budget owner for the Chromatic seat.
3. The visual-regression noise budget has a clear escalation path.

Until then, run Storybook locally during review and attach a screen
recording to the PR if needed.
