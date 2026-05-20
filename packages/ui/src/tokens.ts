export const colors = {
  primary: 'var(--color-primary)',
  primaryDark: 'var(--color-primary-dark)',
  success: 'var(--color-success)',
  sunflower: 'var(--color-sunflower)',
  milo: 'var(--color-milo)',
  luna: 'var(--color-luna)',
  coral: 'var(--color-coral)',
  alert: 'var(--color-alert)',
  muted: 'var(--color-muted)',
  surface: 'var(--color-surface)',
  surfaceHigh: 'var(--color-surface-high)',
  ink: 'var(--color-ink)',
  mist: 'var(--color-mist)',
  micLive: 'var(--color-mic-live)',
} as const;

export const radius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  pill: 'var(--radius-pill)',
} as const;

export const tap = {
  primaryYoung: 'var(--tap-primary-young)',
  primaryOld: 'var(--tap-primary-old)',
  minYoung: 'var(--tap-min-young)',
  minOld: 'var(--tap-min-old)',
} as const;

export const motion = {
  fast: 'var(--motion-fast)',
  base: 'var(--motion-base)',
  slow: 'var(--motion-slow)',
  spring: 'var(--motion-spring)',
  ease: 'var(--motion-ease)',
} as const;

export const shadows = {
  card: 'var(--shadow-card)',
  pop: 'var(--shadow-pop)',
  milo: 'var(--shadow-milo)',
  luna: 'var(--shadow-luna)',
} as const;

export type AgeBand = 'young' | 'old';
