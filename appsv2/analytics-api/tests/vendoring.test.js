import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * P1.1 — Vendoring drift guard.
 *
 * `src/mcp/openapi/{mapper,spec}.js` and `src/mcp/connect/{signing,keystore}.js`
 * are DELIBERATELY vendored copies of `mcp-toolkit-core/src/…` (the toolkit
 * engine): the backend must not add a workspace dependency that complicates the
 * single-process/single-writer DuckDB Docker build. But byte-identical copies
 * silently rot when only one side is edited. This test fails the moment they
 * diverge, so the copy is a conscious, checked contract rather than an accident.
 *
 * `insighttrack-spec.js` is NOT vendored — it's the repo's own OpenAPI doc — so
 * it is intentionally excluded from this check.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const vendored = path.resolve(here, '..', 'src', 'mcp');
const pkg = path.resolve(here, '..', '..', 'mcp-toolkit-core', 'src');

const PAIRS = [
    ['openapi/mapper.js', 'openapi/mapper.js'],
    ['openapi/spec.js', 'openapi/spec.js'],
    ['connect/signing.js', 'connect/signing.js'],
    ['connect/keystore.js', 'connect/keystore.js'],
];

describe('mcp-toolkit-core vendoring (P1.1)', () => {
    for (const [vend, source] of PAIRS) {
        it(`src/mcp/${vend} is byte-identical to the package copy`, () => {
            const a = readFileSync(path.join(vendored, vend), 'utf8');
            const b = readFileSync(path.join(pkg, source), 'utf8');
            expect(a, `src/mcp/${vend} has drifted from mcp-toolkit-core/src/${source} — re-vendor one from the other`).toBe(b);
        });
    }
});
