import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    css: false,
  },
  resolve: {
    alias: {
      '@e4k/ui': resolve(__dirname, './src/index.ts'),
    },
  },
});
