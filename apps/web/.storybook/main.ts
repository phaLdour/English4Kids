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
};

export default config;
