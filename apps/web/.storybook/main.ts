import path from 'node:path';
import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook config for the app-side components. Sibling to `packages/ui`'s
 * Storybook, but scoped to `apps/web/src/components/**` so we can document
 * components that depend on next-intl, motion, and Dexie without moving them
 * out of the Next app.
 *
 * Different dev port (6007) so both Storybook instances can run side-by-side
 * during a Sprint 4 review.
 */
const config: StorybookConfig = {
  stories: ['../src/components/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y', '@storybook/addon-interactions'],
  framework: { name: '@storybook/react-vite', options: {} },
  docs: { autodocs: 'tag' },
  // The app uses `@/*` as a path alias for `apps/web/src/*` (see
  // `apps/web/tsconfig.json`). Storybook's Vite builder does not read that
  // tsconfig automatically, so we mirror the alias here. Without this, any
  // story that imports `@/lib/...` or `@/components/...` fails Rollup
  // resolution at build time.
  viteFinal: async (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      '@': path.resolve(__dirname, '../src'),
    };
    return cfg;
  },
};

export default config;
