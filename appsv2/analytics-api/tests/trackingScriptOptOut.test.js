/**
 * Tracking script — DNT / GPC opt-out.
 *
 * These tests EXECUTE the generated tracking script inside a mocked browser and
 * observe real side effects (localStorage writes, sessionStorage writes, network
 * calls). They deliberately do not assert on the presence of the strings
 * "doNotTrack"/"globalPrivacyControl": a substring check would pass even if the
 * guard never ran, which is exactly the defect being regression-tested.
 *
 * The mock is a plain object harness rather than jsdom because the script only
 * touches a small, well-defined surface (navigator, localStorage, sessionStorage,
 * fetch/sendBeacon, document, window) and a hand-built harness makes every
 * observed side effect explicit.
 */
import { describe, it, expect } from 'vitest';
import sitesService from '../src/services/sitesService.js';

/**
 * Run the generated script against a mocked browser.
 * @param {{doNotTrack?: any, globalPrivacyControl?: any}} navigatorProps
 * @returns {{localWrites, sessionWrites, requests, analytics, threw}}
 */
function runScript(navigatorProps = {}) {
    const localWrites = [];
    const sessionWrites = [];
    const localReads = [];
    const sessionReads = [];
    const requests = [];

    const makeStore = (writes, reads) => {
        const data = new Map();
        return {
            getItem: (k) => { reads.push(k); return data.has(k) ? data.get(k) : null; },
            setItem: (k, v) => { writes.push({ key: k, value: v }); data.set(k, String(v)); },
            removeItem: (k) => data.delete(k),
        };
    };

    const navigator = {
        userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        language: 'en-US',
        languages: ['en-US'],
        sendBeacon: (url, body) => { requests.push({ via: 'sendBeacon', url, body }); return true; },
        ...navigatorProps,
    };

    const win = {
        location: { href: 'https://example.com/page', pathname: '/page', search: '', hostname: 'example.com' },
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        innerWidth: 1280, innerHeight: 800,
        scrollY: 0, pageYOffset: 0,
        performance: { now: () => 0, getEntriesByType: () => [], timing: {} },
        PerformanceObserver: function () { return { observe: () => {}, disconnect: () => {} }; },
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    };

    const doc = {
        referrer: 'https://google.com/',
        title: 'Page',
        addEventListener: () => {},
        removeEventListener: () => {},
        readyState: 'complete',
        documentElement: { scrollHeight: 2000, clientHeight: 800, scrollTop: 0 },
        body: { scrollHeight: 2000, clientHeight: 800, offsetHeight: 2000 },
        querySelectorAll: () => [],
        querySelector: () => null,
        visibilityState: 'visible',
        cookie: '',
    };

    const sandbox = {
        window: win,
        document: doc,
        navigator,
        localStorage: makeStore(localWrites, localReads),
        sessionStorage: makeStore(sessionWrites, sessionReads),
        fetch: (url, opts) => { requests.push({ via: 'fetch', url, opts }); return Promise.resolve({ ok: true }); },
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        Blob: function (parts) { this.parts = parts; },
        Intl: {
            DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'America/New_York' }) }),
            Locale: function (tag) { this.region = String(tag).split('-')[1]; },
        },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        // The script patches history.pushState/replaceState for SPA navigation.
        history: { pushState: function () {}, replaceState: function () {} },
        MutationObserver: function () { return { observe: () => {}, disconnect: () => {} }; },
    };
    // The script assigns window.analytics; expose the same object graph.
    sandbox.window.analytics = undefined;

    const script = sitesService.getRawTrackingScript('site_test', 'http://localhost:3001');
    const names = Object.keys(sandbox);
    let threw = null;
    try {
        // eslint-disable-next-line no-new-func
        new Function(...names, script)(...names.map((n) => sandbox[n]));
    } catch (err) {
        threw = err;
    }

    return {
        localWrites, sessionWrites, localReads, sessionReads, requests,
        analytics: sandbox.window.analytics,
        threw,
    };
}

/** Writes made under InsightTrack's own storage keys. */
const itKeys = (writes) => writes.filter((w) => String(w.key).startsWith('_analytics_'));

describe('Tracking script — normal visitor (no opt-out signal)', () => {
    it('creates a visitor id and sends analytics when no signal is present', () => {
        const r = runScript();
        expect(r.threw).toBeNull();
        expect(itKeys(r.localWrites).some((w) => w.key === '_analytics_uid')).toBe(true);
        expect(itKeys(r.sessionWrites).some((w) => w.key === '_analytics_sid')).toBe(true);
        expect(r.requests.length).toBeGreaterThan(0);
    });

    it('tracks normally when signals are explicitly NOT opt-out (DNT "0", GPC false)', () => {
        const r = runScript({ doNotTrack: '0', globalPrivacyControl: false });
        expect(itKeys(r.localWrites).some((w) => w.key === '_analytics_uid')).toBe(true);
        expect(r.requests.length).toBeGreaterThan(0);
    });

    it('tracks normally when both signals are undefined', () => {
        const r = runScript({ doNotTrack: undefined, globalPrivacyControl: undefined });
        expect(itKeys(r.localWrites).length).toBeGreaterThan(0);
        expect(r.requests.length).toBeGreaterThan(0);
    });

    it('does not treat unrelated / legacy DNT values as opt-out', () => {
        for (const value of ['0', 'unspecified', 'yes', '', 'null']) {
            const r = runScript({ doNotTrack: value });
            expect(r.requests.length, `DNT="${value}" must not opt out`).toBeGreaterThan(0);
        }
    });

    it('does not treat a truthy-but-not-true GPC value as opt-out', () => {
        // Only === true counts; a string "true" is not the documented signal.
        const r = runScript({ globalPrivacyControl: 'true' });
        expect(r.requests.length).toBeGreaterThan(0);
    });
});

describe('Tracking script — DNT opt-out', () => {
    it('collects nothing when navigator.doNotTrack === "1"', () => {
        const r = runScript({ doNotTrack: '1' });
        expect(r.threw).toBeNull();
        expect(itKeys(r.localWrites)).toEqual([]);     // no visitor id
        expect(itKeys(r.sessionWrites)).toEqual([]);   // no session id
        expect(r.requests).toEqual([]);                // no network calls at all
    });

    it('never reads InsightTrack storage keys either', () => {
        const r = runScript({ doNotTrack: '1' });
        expect(r.localReads.filter((k) => String(k).startsWith('_analytics_'))).toEqual([]);
        expect(r.sessionReads.filter((k) => String(k).startsWith('_analytics_'))).toEqual([]);
    });
});

describe('Tracking script — GPC opt-out', () => {
    it('collects nothing when navigator.globalPrivacyControl === true', () => {
        const r = runScript({ globalPrivacyControl: true });
        expect(r.threw).toBeNull();
        expect(itKeys(r.localWrites)).toEqual([]);
        expect(itKeys(r.sessionWrites)).toEqual([]);
        expect(r.requests).toEqual([]);
    });
});

describe('Tracking script — both signals set', () => {
    it('collects nothing when DNT="1" and GPC=true', () => {
        const r = runScript({ doNotTrack: '1', globalPrivacyControl: true });
        expect(itKeys(r.localWrites)).toEqual([]);
        expect(itKeys(r.sessionWrites)).toEqual([]);
        expect(r.requests).toEqual([]);
    });
});

describe('Tracking script — public API under opt-out', () => {
    it('exposes an inert window.analytics stub so callers do not crash', () => {
        const r = runScript({ doNotTrack: '1' });
        expect(r.analytics).toBeDefined();
        expect(r.analytics.optedOut).toBe(true);
        expect(typeof r.analytics.track).toBe('function');
        expect(typeof r.analytics.identify).toBe('function');
    });

    it('window.analytics.track() sends nothing when opted out', () => {
        const r = runScript({ doNotTrack: '1' });
        r.analytics.track('signup', { plan: 'pro' });
        expect(r.requests).toEqual([]);
    });

    it('window.analytics.identify() writes no identifier when opted out', () => {
        const r = runScript({ globalPrivacyControl: true });
        r.analytics.identify('user-123');
        expect(itKeys(r.localWrites)).toEqual([]);
    });
});

describe('Tracking script — generated output is valid JavaScript', () => {
    it('parses as a function body', () => {
        const script = sitesService.getRawTrackingScript('site_abc', 'http://localhost:3001');
        expect(() => new Function(script)).not.toThrow();
    });

    it('places the opt-out guard before any storage or network use', () => {
        const script = sitesService.getRawTrackingScript('site_abc');
        const guard = script.indexOf('doNotTrack');
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(script.indexOf("localStorage.getItem('_analytics_uid')"));
        expect(guard).toBeLessThan(script.indexOf('navigator.sendBeacon'));
        expect(guard).toBeLessThan(script.indexOf('var userId = getUserId()'));
    });
});
