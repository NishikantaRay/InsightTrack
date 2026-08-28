/**
 * Privacy properties of the generated tracking script.
 *
 * These assert on the emitted script source rather than executing it, because
 * the point is what the script is capable of reading — a behavioural test that
 * happened not to click a populated input would pass while the leak remained.
 */
import { describe, it, expect } from 'vitest';
import { sitesService } from '../src/services/sitesService.js';

const script = () => sitesService.getRawTrackingScript('site_test', 'https://analytics.example.com');

describe('heatmap clicks must not capture form input values', () => {
    it('never reads el.value', () => {
        // The original bug: `el.innerText || el.value || ...` sent whatever the
        // visitor had typed into a clicked field.
        expect(script()).not.toMatch(/\bel\.value\b/);
    });

    it('reads a site-authored label for form controls instead', () => {
        const s = script();
        expect(s).toContain("el.getAttribute('aria-label')");
        expect(s).toContain("el.getAttribute('name')");
    });

    it('still labels ordinary elements with their text', () => {
        expect(script()).toContain('el.innerText');
    });
});

describe('no fingerprinting or high-entropy surface', () => {
    const banned = [
        ['canvas fingerprinting', /toDataURL|getImageData/],
        ['WebGL fingerprinting', /getContext\(['"]webgl/],
        ['audio fingerprinting', /AudioContext/],
        ['plugin enumeration', /navigator\.plugins/],
        ['CPU core count', /hardwareConcurrency/],
        ['device memory', /deviceMemory/],
        ['screen resolution', /screen\.(width|height|availWidth|availHeight)/],
        ['cookies', /document\.cookie/],
        ['keystroke capture', /addEventListener\(\s*['"](keydown|keypress|keyup)['"]/],
    ];

    it.each(banned)('does not use %s', (_label, pattern) => {
        expect(script()).not.toMatch(pattern);
    });
});

describe('visitor id rotation', () => {
    it('stores an expiry alongside the id', () => {
        const s = script();
        expect(s).toContain('UID_TTL_MS');
        expect(s).toMatch(/exp:\s*(now|Date\.now\(\))\s*\+\s*UID_TTL_MS/);
    });

    it('adopts pre-rotation bare-string ids instead of resetting the visitor', () => {
        // Values written before rotation existed are bare strings, not JSON.
        expect(script()).toContain("raw.charAt(0) !== '{'");
    });

    it('prefers crypto.randomUUID when available', () => {
        expect(script()).toContain('crypto.randomUUID');
    });

    it('honours VISITOR_ID_TTL_DAYS', () => {
        const prev = process.env.VISITOR_ID_TTL_DAYS;
        try {
            process.env.VISITOR_ID_TTL_DAYS = '30';
            expect(script()).toContain('var UID_TTL_MS = 30 *');
            process.env.VISITOR_ID_TTL_DAYS = '0';
            expect(script()).toContain('var UID_TTL_MS = 0 *');
        } finally {
            if (prev === undefined) delete process.env.VISITOR_ID_TTL_DAYS;
            else process.env.VISITOR_ID_TTL_DAYS = prev;
        }
    });

    it('defaults to 180 days', () => {
        const prev = process.env.VISITOR_ID_TTL_DAYS;
        delete process.env.VISITOR_ID_TTL_DAYS;
        try {
            expect(script()).toContain('var UID_TTL_MS = 180 *');
        } finally {
            if (prev !== undefined) process.env.VISITOR_ID_TTL_DAYS = prev;
        }
    });

    it('treats a TTL of 0 as "never expire" rather than "expire immediately"', () => {
        expect(script()).toContain('UID_TTL_MS === 0');
    });
});

describe('identify() keeps the stored format readable', () => {
    it('writes the same JSON shape getUserId parses', () => {
        const s = script();
        const body = s.slice(s.indexOf('identify: function'));
        expect(body).toContain('JSON.stringify');
        expect(body).toContain('exp:');
    });

    it('ignores empty input rather than storing a blank id', () => {
        const s = script();
        const body = s.slice(s.indexOf('identify: function'));
        expect(body).toMatch(/uid == null \|\| uid === ''/);
    });
});

describe('opt-out still precedes all collection', () => {
    it('checks DNT and GPC before any storage or network access', () => {
        const s = script();
        const dnt = s.indexOf('doNotTrack');
        const gpc = s.indexOf('globalPrivacyControl');
        const storage = s.indexOf('localStorage.getItem');
        expect(dnt).toBeGreaterThan(-1);
        expect(gpc).toBeGreaterThan(-1);
        expect(dnt).toBeLessThan(storage);
        expect(gpc).toBeLessThan(storage);
    });
});

describe('generated script stays syntactically valid', () => {
    it('parses as JavaScript', () => {
        // Catches a broken template interpolation, which would otherwise ship a
        // script that throws in every visitor's browser.
        expect(() => new Function(script())).not.toThrow();
    });

    it('contains no unresolved template placeholders', () => {
        expect(script()).not.toMatch(/\$\{/);
    });
});
