/**
 * Tests for the URL/referrer sanitisation applied at the ingest boundary.
 *
 * These exist because `events.url` previously stored `window.location.href`
 * verbatim, so any token a site put in a query string was persisted and became
 * readable through the dashboard, SQL Editor, exports and Pulse.
 */
import { describe, it, expect } from 'vitest';
import { sanitiseUrl, sanitiseReferrer } from '../src/utils/urlPrivacy.js';

describe('sanitiseUrl — redacts sensitive query parameters', () => {
    const cases = [
        ['token', 'https://x.com/reset?token=abc123'],
        ['access_token', 'https://x.com/cb?access_token=ya29.secret'],
        ['password', 'https://x.com/login?password=hunter2'],
        ['api_key', 'https://x.com/a?api_key=sk-live-1234'],
        ['apikey', 'https://x.com/a?apikey=sk-live-1234'],
        ['secret', 'https://x.com/a?secret=shh'],
        ['session', 'https://x.com/a?session=sess_9'],
        ['sid', 'https://x.com/a?sid=abc'],
        ['otp', 'https://x.com/verify?otp=123456'],
        ['code', 'https://x.com/oauth?code=authcode'],
        ['email', 'https://x.com/signup?email=a@b.com'],
        ['reset_token', 'https://x.com/r?reset_token=t0k'],
        ['signature', 'https://x.com/s?signature=deadbeef'],
    ];

    it.each(cases)('redacts %s', (param, url) => {
        const out = sanitiseUrl(url);
        expect(out).toContain(`${param}=REDACTED`);
        // The original value must not survive anywhere in the output.
        const original = new URL(url).searchParams.get(param);
        expect(out).not.toContain(original);
    });

    it('is case-insensitive on the parameter name', () => {
        expect(sanitiseUrl('https://x.com/a?TOKEN=abc123')).not.toContain('abc123');
        expect(sanitiseUrl('https://x.com/a?ApiKey=sk-1')).not.toContain('sk-1');
    });

    it('redacts every sensitive param when several are present', () => {
        const out = sanitiseUrl('https://x.com/a?token=t1&code=c1&keep=yes');
        expect(out).not.toContain('t1');
        expect(out).not.toContain('c1');
        expect(out).toContain('keep=yes');
    });
});

describe('sanitiseUrl — preserves analytics-relevant data', () => {
    it('keeps UTM parameters intact', () => {
        const out = sanitiseUrl('https://x.com/p?utm_source=twitter&utm_medium=social&utm_campaign=spring');
        expect(out).toContain('utm_source=twitter');
        expect(out).toContain('utm_medium=social');
        expect(out).toContain('utm_campaign=spring');
    });

    it('keeps ordinary parameters, including search queries', () => {
        const out = sanitiseUrl('https://x.com/search?q=shoes&page=2');
        expect(out).toContain('q=shoes');
        expect(out).toContain('page=2');
    });

    it('leaves a URL with no query string unchanged', () => {
        expect(sanitiseUrl('https://x.com/pricing')).toBe('https://x.com/pricing');
    });

    it('preserves the path and host', () => {
        const out = sanitiseUrl('https://shop.example.com/a/b/c?token=x');
        expect(out).toContain('shop.example.com');
        expect(out).toContain('/a/b/c');
    });
});

describe('sanitiseUrl — fragments', () => {
    it('drops the fragment, a common place for SPA auth tokens', () => {
        const out = sanitiseUrl('https://x.com/cb#access_token=secret123&type=bearer');
        expect(out).not.toContain('secret123');
        expect(out).not.toContain('#');
    });
});

describe('sanitiseUrl — relative and malformed input', () => {
    it('handles a path-relative URL without inventing a host', () => {
        const out = sanitiseUrl('/search?q=x&token=abc');
        expect(out.startsWith('/search')).toBe(true);
        expect(out).not.toContain('abc');
        expect(out).not.toContain('http://_');
    });

    it('never returns an unparseable value with its query string intact', () => {
        const out = sanitiseUrl('ht!tp:// bad ?token=leaky');
        expect(out).not.toContain('leaky');
    });

    it('returns empty string for empty or non-string input', () => {
        expect(sanitiseUrl('')).toBe('');
        expect(sanitiseUrl(null)).toBe('');
        expect(sanitiseUrl(undefined)).toBe('');
        expect(sanitiseUrl(42)).toBe('');
    });

    it('caps output length', () => {
        expect(sanitiseUrl('https://x.com/' + 'a'.repeat(5000)).length).toBeLessThanOrEqual(2048);
    });
});

describe('sanitiseReferrer', () => {
    it('returns null for empty input so the column stays NULL', () => {
        expect(sanitiseReferrer('')).toBeNull();
        expect(sanitiseReferrer(null)).toBeNull();
        expect(sanitiseReferrer(undefined)).toBeNull();
    });

    it('redacts sensitive params in referrers too', () => {
        expect(sanitiseReferrer('https://mail.x.com/read?token=abc123')).not.toContain('abc123');
    });

    it('keeps an ordinary referrer usable for attribution', () => {
        expect(sanitiseReferrer('https://news.ycombinator.com/item?id=123'))
            .toBe('https://news.ycombinator.com/item?id=123');
    });
});
