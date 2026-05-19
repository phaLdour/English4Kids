import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@e4k/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@e4k/audio': resolve(__dirname, '../../packages/audio/src/index.ts'),
      '@e4k/game-engine': resolve(__dirname, '../../packages/game-engine/src/index.ts'),
      '@e4k/content-schema': resolve(__dirname, '../../packages/content-schema/src/index.ts'),
      '@e4k/db': resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
});
