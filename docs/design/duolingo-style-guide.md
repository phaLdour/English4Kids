# Duolingo Style Guide — Sprint 7

Sprint 7 introduces a "soft + big + mascot-forward" visual language inspired by Duolingo while preserving the existing brand palette, the 215 Lingokids illustrations, the mascot voice routing, and every child-safety contract. This document is **additive** to `design-tokens.md` and `illustration-style-guide.md` — nothing is replaced; new conventions are layered in.

The guiding principle is **order with detail**: every UI element must justify its presence on screen. No "mystery shapes", no decorative blobs without a child-facing purpose, no bottom-left squares that look like a half-loaded mascot.

---

## 1. Audit findings (Wave 0)

Findings from walking the current UI surfaces (onboarding, /play, lesson player, /settings, /parent, marketing, faq, privacy):

1. **`MascotFrame` static fallback** renders a 7-rem colored square anchored bottom-left whenever the Lottie JSON fails to load or `prefers-reduced-motion` is on. This is the "bottom-left big square mystery element" called out by the user. Resolution: replace the fallback with the SVG mascot illustration (`/img/_primitives/milo-still.svg`, `/img/_primitives/luna-still.svg`) at the same anchor, or render no fallback at all when reduced-motion is set. See section 6.
2. **Onboarding screens** stack mascot, copy, and buttons in equal weights — mascot is too small to feel like a guide. Resolution: `MascotPanel` primitive places mascot at 30–40% of viewport height with a speech bubble that carries the prompt.
3. **`/play` home** renders 3 unit cards with even-weight stars, lock icons, and meta — every detail competes for attention. Resolution: Duolingo-style "soft pill" card with one hero illustration, one CTA, and progress as a soft bar.
4. **Lesson player top bar** carries Exit, Pause, Mute, Streak, Stars (5 elements). Resolution: minimal top bar (Exit + progress bar) with secondary actions in a tap-to-reveal menu.
5. **Lesson player ProgressDots** show every step as a discrete dot — visually noisy. Resolution: single soft progress bar with a percentage indicator (only revealed in adult/parent context). Children see only the bar.
6. **Settings page (842 lines)** scrolls forever. Resolution: category index → sub-routes (Wave 4).
7. **Parent dashboard** mixes child cards, export, delete, account in one viewport. Resolution: hero card + secondary action row.

Items 1, 2, 3, 4, 5 are addressed by tokens + primitives in Wave 3. Items 6 and 7 are addressed in Wave 4 redesign passes.

Non-issues confirmed during the audit (do **not** change):
- 215 SVG illustrations stay 1:1.
- Mascot voice routing (Milo/Luna/Both) stays.
- Mic indicator color, banned-phrasings list, COPPA gates, parent-gate math.

---

## 2. New design tokens (additive)

```css
@theme {
  /* Soft Duolingo-style radius scale — added alongside existing radii */
  --radius-soft: 1.5rem;     /* default card / panel */
  --radius-soft-lg: 2rem;    /* hero cards (welcome, unit cards) */
  --radius-button: 999px;    /* primary button pill default */

  /* Larger spacing scale — additive (existing space-1..32 untouched) */
  --space-14: 3.5rem;
  --space-18: 4.5rem;
  --space-28: 7rem;
  --space-36: 9rem;

  /* Soft elevation (Duolingo's "no harsh shadow" style) */
  --shadow-soft: 0 2px 0 0 rgba(31, 41, 51, 0.08);  /* button "press" shadow */
  --shadow-soft-press: 0 4px 0 0 rgba(31, 41, 51, 0.12);
  --shadow-panel: 0 10px 30px -10px rgba(31, 41, 51, 0.12);

  /* Provider button brand colors — Apple/Google sign-in */
  --color-apple-ink: #000000;
  --color-apple-surface: #ffffff;
  --color-google-ink: #1f1f1f;
  --color-google-surface: #ffffff;
  --color-google-blue: #4285f4;
}
```

### Fewer-colors-per-screen rule

Each screen uses **at most 3 brand colors plus neutrals**. Acceptable triples:

- **Welcome / Auth**: `--color-primary` + `--color-milo` + `--color-success` (neutrals on top)
- **Lesson**: one unit accent + `--color-success` + `--color-coral` (try-again)
- **Settings index**: neutrals only; each sub-route can add one accent
- **Parent dashboard**: `--color-primary` + `--color-mist` only

Reviewers: count colored fills on each screenshot. If you count four or more brand colors, reject the change.

---

## 3. Component shape vocabulary

| Primitive | Shape | Radius | Shadow | Notes |
|---|---|---|---|---|
| `PrimaryButton` | huge pill | `--radius-button` | `--shadow-soft` press-down | Min height 56 on adult screens, 80 on child screens |
| `ProviderButton` | rounded rect | `--radius-soft` | `--shadow-soft` | Apple / Google / Email — always together |
| `MascotPanel` | rounded panel | `--radius-soft-lg` | `--shadow-panel` | Mascot 60–80% of width, speech bubble bottom-right |
| `Card` (refreshed) | rounded card | `--radius-soft` | `--shadow-card` | No border by default; outline only on focus |
| `TapCard` (refreshed) | rounded tile | `--radius-soft-lg` | `--shadow-card` | Touch-targets `--tap-primary-young/old` unchanged |
| `TopBar` (refreshed) | flat bar | none | none | Exit (left), progress (center), settings (right) |
| `ProgressBar` (new) | soft pill bar | `--radius-button` | none | Replaces ProgressDots in lesson player |

### Anatomy reference — Welcome screen

```
+---------------------------------+
|  [logo]                  [TR]   |   24px padding, neutrals only
|                                 |
|     [Milo welcoming, 240px]     |   MascotPanel
|     "Hi! Let's get started"     |   speech bubble, body font, 22px
|                                 |
|  [ Sign In            ]         |   PrimaryButton, full width
|  [ Create Account     ]         |
|                                 |
|  [Continue as guest]            |   text link, 14px, --color-mist
+---------------------------------+
```

---

## 4. Mascot-forward layout

The mascot is the visual anchor of every kid-facing screen. Rules:

- **Welcome / Onboarding / Auth-for-13+**: mascot occupies 25–40% of viewport height inside a `MascotPanel`. Speech bubble carries the prompt; copy below is one short line.
- **Lesson player**: mascot sits inside a "reaction slot" between activities, growing on success, leaning forward on tries. Reaction is driven by activity outcome.
- **Settings / Parent screens**: mascot is **absent** (parent context — kid mascot would feel infantilising). Use neutral header instead.
- **Marketing / FAQ / Privacy**: mascot bottom-right small (max 96px), waving, with no speech bubble. These pages are skim-read.

### Mascot moods (new `state` prop on `MascotPanel`)

| state | Lottie file (existing) | Use when |
|---|---|---|
| `welcoming` | `milo-waving.json` / `luna-waving.json` | Welcome, Sign In, Sign Up first paint |
| `encouraging` | `milo-encouraging.json` / `luna-encouraging.json` | Lesson try-again, "let's try once more" |
| `thinking` | `milo-thinking.json` / `luna-thinking.json` | Activity question delivered, awaiting response |
| `celebrating` | `milo-celebrating.json` / `luna-celebrating.json` | Activity passed, lesson complete |
| `listening` | `milo-listening.json` / `luna-listening.json` | Mic active, SpeakIt activity |
| `gentle-hmm` | `milo-gentle-hmm.json` / `luna-gentle-hmm.json` | Soft correction, ambient |
| `idle` | `milo-idle.json` / `luna-idle.json` | Default ambient |

No new Lottie files are added in Sprint 7. The 14 existing files cover all 7 moods × 2 mascots.

---

## 5. "Order with detail" enforcement checklist

Apply at design-review time:

- [ ] Every visible UI element has a label or aria-label and a clear job.
- [ ] No floating shapes (squares, circles, blobs) that aren't an icon, a mascot, a button, or a content illustration.
- [ ] At most 3 brand colors plus neutrals on a single screen.
- [ ] Primary CTA is the largest tappable element on the screen.
- [ ] Mascot is either the screen's anchor (kid surfaces) or absent (adult surfaces) — never a small decorative element.
- [ ] Body text is one paragraph or shorter; primary prompts are one sentence.
- [ ] Progress representation is **one** widget (bar OR dots OR star count) — not all three together.
- [ ] Touch targets are `--tap-min-young` (64px) on child screens, `--tap-min-old` (48px) on adult screens.
- [ ] No banned phrasings (see `tests/safety/banned-phrasings.json`).

---

## 6. Specific resolutions for audit findings

1. **MascotFrame static fallback (bottom-left mystery square)** — Replace the colored `<span>{displayName}</span>` block with one of:
   - Inline SVG of the mascot still pose loaded from `/img/_primitives/milo-still.svg` (preferred when reduced-motion is the cause).
   - Nothing rendered at all (when offline + reduced-motion).
   - Document `MascotFrame` as deprecated for hero use; new kid-surfaces consume `MascotPanel`, which never renders a "mystery square" because its fallback is the same SVG illustration.

2. **Welcome / Onboarding mascot too small** — `MascotPanel` enforces 25–40% viewport height for the mascot. Storybook story `MascotPanel/Welcome` is the canonical reference.

3. **Unit card noise** — `TapCard` refreshed to render: hero illustration (one SVG from the unit's `cover` field), unit name, single-line progress bar, large CTA. Stars and meta move to a tap-to-reveal detail sheet.

4. **Lesson top bar noise** — Three slots only: Exit (left, icon button), `ProgressBar` (center, fills width), Menu (right, icon button). Streak / mute / pause / parent-gate move into the menu sheet.

5. **ProgressDots noise** — `ProgressBar` primitive replaces dots in lesson player. Dots stay available in onboarding (where they signify a small finite number of steps).

6. **Settings page sprawl** — Wave 4: index of 5 category cards → sub-routes.

7. **Parent dashboard sprawl** — Wave 4: hero card + secondary action row.

---

## 7. Migration policy

- All existing primitive imports continue to work — refreshed primitives keep their props, just add new optional ones.
- `MascotFrame` stays exported (used in lesson player current code). `MascotPanel` is the new default for non-lesson surfaces.
- `ProgressBar` ships alongside `ProgressDots`; consumers swap when redesigned.
- No SVG illustration is removed or renamed.
- No Lottie file is added or renamed.
- No locale key is removed (new keys are added under `auth.*` namespace).

---

## 8. Accessibility baseline (re-asserted)

Sprint 7 must not regress any A11y commitment:

- WCAG AA contrast on all text and interactive elements.
- Reduced-motion path skips Lottie playback entirely (existing `MascotFrame` contract — preserved in `MascotPanel`).
- Dyslexia font toggle continues to swap `--font-body` to `--font-alt`.
- High-contrast theme continues to override the brand palette via `[data-theme='high-contrast']`.
- All new auth forms have visible labels, `autocomplete` hints, and `aria-describedby` for inline error text.
- Banned phrasings ("Wrong password!" etc.) are forbidden — see `tests/safety/banned-phrasings.json`. EN+TR auth copy must pass `safety-lint`.

---

## 9. Open questions deferred to Sprint 8+

- Whether to add a "Family mode" (parent + multiple children on one OAuth identity) — Sprint 8.
- Whether to localize the speech bubble copy per mascot personality (Milo playful, Luna calm) — Sprint 8 audio script pass.
- Whether to support social proof ("3,201 kids learned today") on Welcome — requires anonymized analytics, deferred.
