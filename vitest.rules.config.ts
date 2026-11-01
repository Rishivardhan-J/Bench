import { defineConfig } from 'vitest/config';

// Rules tests run in node against a running Firestore emulator (see `npm run test:rules`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.rules.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
