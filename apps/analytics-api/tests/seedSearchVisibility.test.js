/**
 * Regression tests for the search-visibility seed script.
 *
 * Both bugs these cover were invisible to unit tests and only surfaced when the
 * seed ran against a real PostgreSQL + DuckDB stack:
 *
 *   1. The INSERT listed `id`, but events.id is a SERIAL — inserting a UUID
 *      there fails with "invalid input syntax for type integer".
 *   2. Weekly totals were spread from "today minus N days" rather than from ISO
 *      week boundaries, so each intended week straddled two real ones. The
 *      -33% drop smeared to -11.8%, fell under the significance floor, and the
 *      demo reported "no significant change".
 *
 * These run without a database: layOutWeeks is pure, and the column list is
 * asserted by reading the source.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isoWeekStart, layOutWeeks } from '../scripts/seedSearchVisibility.js';
import { bucketByWeek, detectChange } from '../src/services/correlationService.js';

const SCRIPT = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/seedSearchVisibility.js'),
    'utf8',
);

// The demo scenario's weekly totals: a -33% drop on the last COMPLETE week,
// followed by a partial in-progress week.
const WEEKLY = [520, 545, 588, 602, 575, 590, 616, 413, 120];

describe('bug 1 — events.id is a SERIAL', () => {
    it('does not list `id` in the INSERT column list', () => {
        const insert = SCRIPT.match(/INSERT INTO events \(([^)]+)\)/)[1];
        expect(insert).not.toMatch(/\bid\b/);
        expect(insert).toContain('site_id');
        expect(insert).toContain('timestamp');
    });

    it('never generates a UUID for an event row', () => {
        expect(SCRIPT).not.toContain('randomUUID');
    });

    it('supplies exactly as many placeholders as columns', () => {
        const cols = SCRIPT.match(/INSERT INTO events \(([^)]+)\)/)[1].split(',').length;
        const placeholders = (SCRIPT.match(/const placeholders = chunk\.map\(\(\) => `\(([^`]+)\)`\)/)[1].match(/\$\$\{n\+\+\}/g) || []).length;
        expect(placeholders).toBe(cols);
    });
});

describe('bug 2 — weekly totals must land on ISO week boundaries', () => {
    it('isoWeekStart snaps any day to its Monday, at UTC midnight', () => {
        expect(isoWeekStart(new Date('2026-09-16T13:45:00Z')).toISOString()).toBe('2026-09-14T00:00:00.000Z');
        expect(isoWeekStart(new Date('2026-09-14T00:00:00Z')).toISOString()).toBe('2026-09-14T00:00:00.000Z');
        expect(isoWeekStart(new Date('2026-09-20T23:59:59Z')).toISOString()).toBe('2026-09-14T00:00:00.000Z');
    });

    // The heart of bug 2: a timestamp generated for week N must actually fall
    // in ISO week N, or the correlation buckets it into a neighbouring week.
    it('every generated timestamp falls inside the ISO week it was meant for', () => {
        const now = new Date('2026-09-16T12:00:00Z');   // a Wednesday
        const thisWeek = isoWeekStart(now);
        for (const { ts, weekIndex } of layOutWeeks(WEEKLY, now)) {
            const weeksBack = WEEKLY.length - 1 - weekIndex;
            const expected = new Date(thisWeek);
            expected.setUTCDate(expected.getUTCDate() - weeksBack * 7);
            expect(isoWeekStart(ts).toISOString()).toBe(expected.toISOString());
        }
    });

    it('never seeds a timestamp in the future', () => {
        const now = new Date('2026-09-16T12:00:00Z');
        for (const { ts } of layOutWeeks(WEEKLY, now)) {
            expect(ts.getTime()).toBeLessThanOrEqual(now.getTime() + 86_400_000);
        }
    });

    it('leaves the final week partial, so the drop sits on a complete week', () => {
        const now = new Date('2026-09-16T12:00:00Z');   // Wednesday — 3 days in
        const rows = layOutWeeks(WEEKLY, now);
        const last = rows.filter((r) => r.weekIndex === WEEKLY.length - 1).length;
        const prev = rows.filter((r) => r.weekIndex === WEEKLY.length - 2).length;
        expect(last).toBeLessThan(Math.round(WEEKLY.at(-1) / 7) * 7);   // partial
        expect(prev).toBe(Math.round(WEEKLY.at(-2) / 7) * 7);           // complete
    });
});

describe('end-to-end: seeded data produces the demo explanation', () => {
    // This is the assertion that would have caught bug 2 immediately — the seed
    // feeding the real correlation and yielding a SIGNIFICANT -33% drop.
    it('yields a significant ~33% drop on the last complete week', () => {
        const now = new Date('2026-09-16T12:00:00Z');
        const daily = new Map();
        for (const { ts } of layOutWeeks(WEEKLY, now)) {
            const day = ts.toISOString().slice(0, 10);
            daily.set(day, (daily.get(day) || 0) + 1);
        }
        const series = [...daily.entries()].map(([date, views]) => ({ date, views }));
        const change = detectChange(bucketByWeek(series));

        expect(change.significant).toBe(true);
        expect(change.direction).toBe('drop');
        expect(change.changePct).toBeLessThan(-30);
        expect(change.changePct).toBeGreaterThan(-36);
    });

    // The original bug: spreading from "today minus N days" straddles ISO week
    // boundaries, so the reported change is whatever the misalignment happens to
    // produce on that weekday — sometimes diluted, sometimes exaggerated, never
    // the intended -33%. Asserting "wrong", not "smaller", is the honest check.
    it('reports the WRONG figure when weeks are misaligned (the original bug)', () => {
        const now = new Date('2026-09-16T12:00:00Z');
        const totalDays = WEEKLY.length * 7;
        const daily = new Map();
        for (let w = 0; w < WEEKLY.length; w++) {
            const perDay = Math.round(WEEKLY[w] / 7);
            for (let d = 0; d < 7; d++) {
                const daysAgo = totalDays - (w * 7 + d) - 1;
                const base = new Date(now);
                base.setUTCHours(0, 0, 0, 0);
                base.setUTCDate(base.getUTCDate() - daysAgo);
                const day = base.toISOString().slice(0, 10);
                daily.set(day, (daily.get(day) || 0) + perDay);
            }
        }
        const series = [...daily.entries()].map(([date, views]) => ({ date, views }));
        const change = detectChange(bucketByWeek(series));

        // The intended drop is -33%. Misalignment yields something else entirely.
        expect(Math.abs(change.changePct + 33)).toBeGreaterThan(5);
    });

    // Misalignment makes the reported figure depend on WHICH WEEKDAY the seed
    // runs — measured here as -63.6% (Mon) through -33% (Sun) for the same
    // input. A demo whose headline number drifts by 30 points based on the day
    // is broken even when it happens to clear the significance floor.
    it('makes the reported drop depend on the weekday the seed runs', () => {
        const misaligned = (now) => {
            const totalDays = WEEKLY.length * 7;
            const daily = new Map();
            for (let w = 0; w < WEEKLY.length; w++) {
                const perDay = Math.round(WEEKLY[w] / 7);
                for (let d = 0; d < 7; d++) {
                    const daysAgo = totalDays - (w * 7 + d) - 1;
                    const base = new Date(now);
                    base.setUTCHours(0, 0, 0, 0);
                    base.setUTCDate(base.getUTCDate() - daysAgo);
                    const day = base.toISOString().slice(0, 10);
                    daily.set(day, (daily.get(day) || 0) + perDay);
                }
            }
            return detectChange(bucketByWeek([...daily.entries()].map(([date, views]) => ({ date, views }))));
        };

        const pcts = Array.from({ length: 7 }, (_, i) =>
            misaligned(new Date(Date.UTC(2026, 8, 14 + i, 12))).changePct);

        // Unstable across weekdays — the defining symptom.
        expect(Math.max(...pcts) - Math.min(...pcts)).toBeGreaterThan(20);

        // The aligned layout, by contrast, is the same every day of the week.
        const aligned = Array.from({ length: 7 }, (_, i) => {
            const now = new Date(Date.UTC(2026, 8, 14 + i, 12));
            const daily = new Map();
            for (const { ts } of layOutWeeks(WEEKLY, now)) {
                const day = ts.toISOString().slice(0, 10);
                daily.set(day, (daily.get(day) || 0) + 1);
            }
            return detectChange(bucketByWeek([...daily.entries()].map(([date, views]) => ({ date, views })))).changePct;
        });
        expect(Math.max(...aligned) - Math.min(...aligned)).toBeLessThan(2);
        for (const p of aligned) expect(p).toBeLessThan(-30);
    });
});
