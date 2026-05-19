# Design Tokens

These tokens are the single source of truth for color, typography, spacing, radii, motion, and tap-target rules. They are wired into Tailwind v4 via the `@theme` directive (Sprint 1) and accessible as CSS custom properties everywhere.

## Color

All colors meet WCAG AA against the surface they appear on. Names use a friendly noun (warm-fox, sun-glow) plus a numeric scale.

```css
:root {
  /* Brand */
  --color-brand-milo:        #F2A65A;   /* Milo's fur — warm orange */
  --color-brand-milo-dark:   #C97F39;
  --color-brand-sky:         #6EC1E4;   /* primary action */
  --color-brand-sky-dark:    #2E8FBF;
  --color-brand-leaf:        #7DBE6B;   /* correct / garden */
  --color-brand-leaf-dark:   #4F8A42;
  --color-brand-berry:       #E26F8E;   /* energy / streak */
  --color-brand-berry-dark:  #B0405E;

  /* Neutrals — warm-grey, never pure grey */
  --color-paper:             #FFFBF4;   /* main background */
  --color-paper-soft:        #F6EFE0;
  --color-ink:               #2A2622;   /* body text */
  --color-ink-soft:          #5B524A;
  --color-ink-faint:         #8E847A;

  /* Semantic */
  --color-correct:           var(--color-brand-leaf);
  --color-correct-bg:        #E8F4DF;
  --color-tryagain:          #F2C46A;   /* never red — amber instead */
  --color-tryagain-bg:       #FCF1D8;
  --color-info:              var(--color-brand-sky);
  --color-info-bg:           #E0F1F9;
  --color-danger:            #C24B4B;   /* destructive parent-panel actions only */
  --color-danger-bg:         #FAE4E4;

  /* Mic indicator (always visible when mic is hot) */
  --color-mic-hot:           #D14B4B;
  --color-mic-hot-glow:      rgba(209, 75, 75, 0.45);

  /* Dark / dim variant (kid-friendly, not pitch black) */
  --color-paper-dim:         #2A2622;
  --color-ink-dim:           #FFFBF4;
}
```

## Typography

```css
:root {
  /* Families (loaded from PROVENANCE-tracked files) */
  --font-display:  "Fredoka", system-ui, sans-serif;
  --font-body:     "Atkinson Hyperlegible", system-ui, sans-serif;
  --font-body-alt: "Lexend", system-ui, sans-serif;  /* "Reading Help" toggle */
  --font-mono:     "JetBrains Mono", ui-monospace, monospace;

  /* Type scale — generous for kids */
  --text-xs:     0.875rem;  /* 14px — captions only */
  --text-sm:     1rem;      /* 16px — secondary body */
  --text-base:   1.125rem;  /* 18px — body */
  --text-lg:     1.375rem;  /* 22px — emphasized body */
  --text-xl:     1.75rem;   /* 28px — section headings */
  --text-2xl:    2.25rem;   /* 36px — page headings */
  --text-3xl:    3rem;      /* 48px — activity titles */
  --text-hero:   4rem;      /* 64px — onboarding hero only */

  /* Line heights */
  --leading-tight:  1.15;
  --leading-snug:   1.30;
  --leading-base:   1.55;   /* body default */
  --leading-loose:  1.75;

  /* Weights */
  --weight-regular: 400;
  --weight-medium:  500;
  --weight-bold:    700;
}
```

## Spacing scale

```css
:root {
  --space-0:   0;
  --space-1:   0.25rem;   /* 4px */
  --space-2:   0.5rem;    /* 8px */
  --space-3:   0.75rem;   /* 12px */
  --space-4:   1rem;      /* 16px */
  --space-5:   1.5rem;    /* 24px */
  --space-6:   2rem;      /* 32px */
  --space-7:   3rem;      /* 48px */
  --space-8:   4rem;      /* 64px */
  --space-9:   6rem;      /* 96px */
}
```

## Radii

```css
:root {
  --radius-sm:    0.5rem;
  --radius-md:    0.75rem;
  --radius-lg:    1.25rem;
  --radius-xl:    2rem;
  --radius-pill:  9999px;
}
```

## Shadows

```css
:root {
  --shadow-card:    0 4px 12px rgba(42, 38, 34, 0.08);
  --shadow-lift:    0 8px 24px rgba(42, 38, 34, 0.12);
  --shadow-press:   0 2px 4px rgba(42, 38, 34, 0.10) inset;
  --shadow-focus:   0 0 0 4px rgba(110, 193, 228, 0.55);
}
```

## Motion

```css
:root {
  --ease-bounce:  cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-soft:    cubic-bezier(0.4, 0, 0.2, 1);
  --ease-firm:    cubic-bezier(0.2, 0, 0.1, 1);

  --duration-instant:  80ms;
  --duration-fast:     150ms;
  --duration-base:     240ms;
  --duration-slow:     400ms;
  --duration-celeb:    900ms;
}
```

`prefers-reduced-motion: reduce` overrides:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast:  0ms;
    --duration-base:  0ms;
    --duration-slow:  0ms;
    --duration-celeb: 0ms;
  }
}
```

## Tap targets

- **Minimum tap target:** **56 px × 56 px** for ages 6–8; **44 px × 44 px** for ages 9–12. The age band sets a CSS class on `<html>` that toggles a `--tap-min` token.
- **Minimum spacing between tap targets:** 12 px.
- **Drag-target snap radius:** 24 px around the visible target.
- **Buttons** have a minimum padding of `var(--space-3) var(--space-5)` and meet the band's tap minimum.

```css
:root {
  --tap-min: 56px;
}
html.age-band-older {
  --tap-min: 44px;
}
```

## Focus

Every interactive element has a `:focus-visible` style using `--shadow-focus`. Never remove focus outlines without replacing them.

## Layout breakpoints

- `sm`: 480px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

Player surface targets **portrait mobile first** (375×667 baseline), then scales up.
