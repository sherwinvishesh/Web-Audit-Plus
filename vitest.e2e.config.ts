import { defineConfig } from 'vitest/config';

/** The end-to-end suite: the built extension in a real Chrome. Run `npm run build` first. */
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 180_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
