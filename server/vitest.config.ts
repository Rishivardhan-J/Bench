import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // One database, so test files run one at a time.
    fileParallelism: false,
    testTimeout: 20000,
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/env.ts'],
  },
});
