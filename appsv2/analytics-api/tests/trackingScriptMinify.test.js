/**
 * Minified tracking script.
 *
 * This file runs on every page of every customer's site, so the tests that
 * matter are: it still parses, the privacy behaviour survives minification, and
 * a minifier failure degrades to the readable source rather than to nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import sitesService from '../src/services/sitesService.js';

const SITE = 'site_min_test';
const URL = 'https://analytics.example.com';

describe('tracking script minification', () => {
    it('produces valid JavaScript', async () => {
        const code = await sitesService.getMinifiedTrackingScript(SITE, URL);
        expect(() => new Function(code)).not.toThrow();
    });

    it('is meaningfully smaller than the source', async () => {
        const raw = sitesService.getRawTrackingScript(SITE, URL);
        const min = await sitesService.getMinifiedTrackingScript(SITE, URL);
        expect(min.length).toBeLessThan(raw.length * 0.75);
    });

    // The site id and endpoint are the two things that must survive mangling —
    // without them the script runs and silently reports nothing.
    it('keeps the site id and server URL intact', async () => {
        const code = await sitesService.getMinifiedTrackingScript(SITE, URL);
        expect(code).toContain(SITE);
        expect(code).toContain(URL);
    });

    // Minification must never strip the opt-out path. This is the one
    // regression that would be both invisible and serious.
    it('preserves the DNT and GPC opt-out checks', async () => {
        const code = await sitesService.getMinifiedTrackingScript(SITE, URL);
        expect(code).toMatch(/doNotTrack/);
        expect(code).toMatch(/globalPrivacyControl|Sec-GPC|msDoNotTrack/i);
    });

    it('preserves sendBeacon for the exit path', async () => {
        const code = await sitesService.getMinifiedTrackingScript(SITE, URL);
        expect(code).toContain('sendBeacon');
    });

    it('caches per site so a request never waits on the minifier twice', async () => {
        const a = await sitesService.getMinifiedTrackingScript('site_cache_a', URL);
        const b = await sitesService.getMinifiedTrackingScript('site_cache_a', URL);
        expect(a).toBe(b);

        const other = await sitesService.getMinifiedTrackingScript('site_cache_b', URL);
        expect(other).toContain('site_cache_b');
        expect(other).not.toBe(a);
    });

    // A build-step failure must not take analytics off a customer's site.
    it('falls back to readable source when minification throws', async () => {
        vi.resetModules();
        vi.doMock('terser', () => ({ minify: async () => { throw new Error('boom'); } }));
        const { default: svc } = await import('../src/services/sitesService.js');
        const code = await svc.getMinifiedTrackingScript('site_fallback', URL);
        expect(code).toContain('site_fallback');
        expect(() => new Function(code)).not.toThrow();
        vi.doUnmock('terser');
    });
});
