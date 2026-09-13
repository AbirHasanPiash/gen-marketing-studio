import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Pure logic only — no database, no network. These are the rules that are
    // easy to break by accident and expensive to catch by clicking through.
    passWithNoTests: false,
  },
});
