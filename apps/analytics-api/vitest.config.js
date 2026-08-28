import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        testTimeout: 30000,
        hookTimeout: 30000,
        fileParallelism: false,
        sequence: { concurrent: false },
        // Provisions an ephemeral PostgreSQL container for the DB-backed suites
        // so `npm test` works from a clean checkout. See tests/globalSetup.js.
        globalSetup: ['./tests/globalSetup.js'],
    },
});
