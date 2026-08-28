/**
 * Tests for the database-engine benchmark harness.
 *
 * These verify the properties that make the benchmark trustworthy: determinism
 * of the dataset, completeness and equivalence of the query workload, and
 * correctness of the statistics.
 *
 * Deliberately absent: any assertion that one engine is faster than the other.
 * A test like `expect(duckdb.median).toBeLessThan(postgres.median)` would make
 * the benchmark self-confirming — it would fail whenever the measurement
 * disagreed with the expected conclusion, which is the opposite of measuring.
 * Performance outcomes are reported, never asserted.
 */
import { describe, it, expect } from 'vitest';
import {
    generateEvents, fingerprint, makeRng, EVENT_COLUMNS, SITES, DATASET_END_ISO,
} from '../../../scripts/benchmarking/dataset.js';
import { QUERIES, BENCH_SITE, WINDOW_START, WINDOW_END } from '../../../scripts/benchmarking/workload.js';
import { summarise, percentile, stddev } from '../../../scripts/benchmarking/stats.js';

// ── Deterministic dataset generation ─────────────────────────────────────────

describe('benchmark dataset — determinism', () => {
    it('produces an identical dataset for the same seed and size', () => {
        const a = generateEvents({ count: 2000, seed: 42 });
        const b = generateEvents({ count: 2000, seed: 42 });
        expect(fingerprint(a.rows)).toBe(fingerprint(b.rows));
        expect(a.rows).toEqual(b.rows);
    });

    it('produces a different dataset for a different seed', () => {
        const a = generateEvents({ count: 2000, seed: 42 });
        const b = generateEvents({ count: 2000, seed: 43 });
        expect(fingerprint(a.rows)).not.toBe(fingerprint(b.rows));
    });

    it('is stable across repeated generation within one process', () => {
        const prints = Array.from({ length: 4 }, () => fingerprint(generateEvents({ count: 500, seed: 7 }).rows));
        expect(new Set(prints).size).toBe(1);
    });

    it('does not depend on wall-clock time (fixed dataset end instant)', () => {
        const { rows } = generateEvents({ count: 300, seed: 11 });
        const end = Date.parse(DATASET_END_ISO);
        for (const r of rows) {
            const ts = Date.parse(r[EVENT_COLUMNS.indexOf('timestamp')]);
            expect(ts).toBeLessThanOrEqual(end);
        }
    });

    it('seeded PRNG is reproducible and bounded', () => {
        const r1 = makeRng(99);
        const r2 = makeRng(99);
        for (let i = 0; i < 200; i++) {
            const v = r1();
            expect(v).toBe(r2());
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});

// ── Dataset shape ────────────────────────────────────────────────────────────

describe('benchmark dataset — shape and realism', () => {
    it('emits one value per declared column, in order', () => {
        const { rows } = generateEvents({ count: 50, seed: 1 });
        for (const r of rows) expect(r.length).toBe(EVENT_COLUMNS.length);
    });

    it('reports dataset statistics', () => {
        const { stats } = generateEvents({ count: 1200, seed: 5 });
        expect(stats.events).toBe(1200);
        expect(stats.sessions).toBeGreaterThan(0);
        expect(stats.sessions).toBeLessThanOrEqual(1200);
        expect(stats.sites).toBe(SITES.length);
        expect(stats.seed).toBe(5);
    });

    it('reuses a bounded visitor pool so distinct visitors < row count', () => {
        const { rows } = generateEvents({ count: 3000, seed: 3 });
        const idx = EVENT_COLUMNS.indexOf('user_id');
        const distinct = new Set(rows.map((r) => r[idx]));
        expect(distinct.size).toBeLessThan(3000);
        expect(distinct.size).toBeGreaterThan(0);
    });

    it('groups several events into a session', () => {
        const { rows } = generateEvents({ count: 3000, seed: 4 });
        const idx = EVENT_COLUMNS.indexOf('session_id');
        const distinct = new Set(rows.map((r) => r[idx]));
        expect(distinct.size).toBeLessThan(3000);
    });

    it('produces a skewed (non-uniform) site distribution', () => {
        const { rows } = generateEvents({ count: 5000, seed: 8 });
        const idx = EVENT_COLUMNS.indexOf('site_id');
        const counts = {};
        for (const r of rows) counts[r[idx]] = (counts[r[idx]] ?? 0) + 1;
        const values = Object.values(counts).sort((a, b) => b - a);
        // Dominant tenant should clearly lead — uniform data would not.
        expect(values[0]).toBeGreaterThan(values[values.length - 1] * 2);
    });

    it('produces a skewed page distribution (a few hot paths)', () => {
        const { rows } = generateEvents({ count: 5000, seed: 9 });
        const idx = EVENT_COLUMNS.indexOf('path');
        const counts = {};
        for (const r of rows) counts[r[idx]] = (counts[r[idx]] ?? 0) + 1;
        const values = Object.values(counts).sort((a, b) => b - a);
        expect(values[0]).toBeGreaterThan(values[values.length - 1] * 5);
    });

    it('generates the benchmark site referenced by the workload', () => {
        const { rows } = generateEvents({ count: 2000, seed: 42 });
        const idx = EVENT_COLUMNS.indexOf('site_id');
        expect(rows.some((r) => r[idx] === BENCH_SITE)).toBe(true);
    });
});

// ── Query workload ───────────────────────────────────────────────────────────

describe('benchmark workload — completeness', () => {
    it('defines at least the ten required query categories', () => {
        expect(QUERIES.length).toBeGreaterThanOrEqual(10);
    });

    it('gives every query an id, title, description and both dialects', () => {
        for (const q of QUERIES) {
            expect(q.id, 'id').toBeTruthy();
            expect(q.title, `${q.id} title`).toBeTruthy();
            expect(q.description, `${q.id} description`).toBeTruthy();
            expect(typeof q.pg, `${q.id} pg`).toBe('string');
            expect(typeof q.duck, `${q.id} duck`).toBe('string');
            expect(Array.isArray(q.params), `${q.id} params`).toBe(true);
        }
    });

    it('uses unique query ids', () => {
        const ids = QUERIES.map((q) => q.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('covers the required analytical categories', () => {
        const ids = QUERIES.map((q) => q.id).join(' ');
        for (const needle of [
            'total_events', 'unique_visitors', 'sessions', 'daily_events',
            'daily_unique_visitors', 'top_pages', 'referrer_sources',
            'date_range_filter', 'multi_dim_groupby', 'dashboard_kpi',
        ]) {
            expect(ids, `missing category: ${needle}`).toContain(needle);
        }
    });

    it('uses matching placeholder counts for each dialect', () => {
        for (const q of QUERIES) {
            const pgPlaceholders = new Set((q.pg.match(/\$\d+/g) ?? []));
            const duckPlaceholders = (q.duck.match(/\?/g) ?? []).length;
            expect(pgPlaceholders.size, `${q.id} pg placeholders`).toBe(q.params.length);
            expect(duckPlaceholders, `${q.id} duck placeholders`).toBe(q.params.length);
        }
    });

    it('reads only the events table — no pre-aggregated shortcut for either engine', () => {
        for (const q of QUERIES) {
            for (const sql of [q.pg, q.duck]) {
                expect(sql, `${q.id} must not read daily_stats`).not.toMatch(/daily_stats/i);
                expect(sql, `${q.id} must not read a materialised view`).not.toMatch(/materialized\s+view/i);
            }
        }
    });

    it('is read-only', () => {
        for (const q of QUERIES) {
            for (const sql of [q.pg, q.duck]) {
                expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/i);
            }
        }
    });

    it('orders results deterministically wherever rows are grouped', () => {
        for (const q of QUERIES) {
            if (/GROUP BY/i.test(q.pg)) {
                expect(q.pg, `${q.id} pg needs ORDER BY`).toMatch(/ORDER BY/i);
                expect(q.duck, `${q.id} duck needs ORDER BY`).toMatch(/ORDER BY/i);
            }
        }
    });

    it('uses window bounds that fall inside the generated date range', () => {
        const { stats } = generateEvents({ count: 100, seed: 42 });
        expect(Date.parse(WINDOW_START)).toBeGreaterThanOrEqual(Date.parse(stats.rangeStart));
        expect(Date.parse(WINDOW_END)).toBeLessThanOrEqual(Date.parse(stats.rangeEnd));
    });
});

// ── Statistics ───────────────────────────────────────────────────────────────

describe('benchmark statistics', () => {
    it('summarises a known sample correctly', () => {
        const s = summarise([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(s.n).toBe(10);
        expect(s.min).toBe(1);
        expect(s.max).toBe(10);
        expect(s.mean).toBe(5.5);
        expect(s.median).toBe(5);
    });

    it('reports every required statistic', () => {
        const s = summarise([5, 1, 9, 3, 7]);
        for (const key of ['n', 'min', 'max', 'mean', 'median', 'p95', 'p99', 'stddev']) {
            expect(s, `missing ${key}`).toHaveProperty(key);
            expect(s[key]).not.toBeNull();
        }
    });

    it('computes nearest-rank percentiles', () => {
        const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
        expect(percentile(sorted, 0.5)).toBe(50);
        expect(percentile(sorted, 0.95)).toBe(95);
        expect(percentile(sorted, 0.99)).toBe(99);
    });

    it('computes sample standard deviation', () => {
        expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
        expect(stddev([5, 5, 5, 5])).toBe(0);
    });

    it('handles empty and single-value inputs without throwing', () => {
        const empty = summarise([]);
        expect(empty.n).toBe(0);
        expect(empty.median).toBeNull();

        const one = summarise([42]);
        expect(one.n).toBe(1);
        expect(one.median).toBe(42);
        expect(one.stddev).toBe(0);
    });

    it('is not distorted by ordering of the input samples', () => {
        const a = summarise([10, 2, 8, 4, 6]);
        const b = summarise([2, 4, 6, 8, 10]);
        expect(a).toEqual(b);
    });
});

// ── Result record schema ─────────────────────────────────────────────────────

describe('benchmark result schema', () => {
    it('a per-query summary carries both engines and the full statistic set', () => {
        const record = {
            queryId: 'Q01_total_events',
            title: 'Total events',
            description: 'x',
            postgres: summarise([1, 2, 3]),
            duckdb: summarise([1, 2, 3]),
        };
        expect(record).toHaveProperty('queryId');
        expect(record).toHaveProperty('postgres.median');
        expect(record).toHaveProperty('duckdb.median');
        expect(record).toHaveProperty('postgres.p95');
        expect(record).toHaveProperty('duckdb.p99');
        expect(record).toHaveProperty('postgres.stddev');
    });

    it('a raw sample identifies engine, query and iteration', () => {
        const sample = { queryId: 'Q01_total_events', engine: 'postgres', iteration: 1, ms: 1.234 };
        for (const key of ['queryId', 'engine', 'iteration', 'ms']) {
            expect(sample).toHaveProperty(key);
        }
        expect(['postgres', 'duckdb']).toContain(sample.engine);
    });
});
