import { useEffect } from 'react';

const SITE = 'InsightsTrack';
const ORIGIN = 'https://insightstrack.dev';
const DEFAULT_DESC =
    'Open-source, self-hosted, privacy-friendly web analytics — a cookieless alternative to Google Analytics.';
const DEFAULT_OG = `${ORIGIN}/og-image.png`;

function setMeta(attr, key, value) {
    if (!value) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', value);
}

function setCanonical(href) {
    let el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function setJsonLd(id, data) {
    let el = document.getElementById(id);
    if (data) {
        if (!el) {
            el = document.createElement('script');
            el.type = 'application/ld+json';
            el.id = id;
            document.head.appendChild(el);
        }
        el.textContent = JSON.stringify(data);
    } else if (el) {
        el.remove();
    }
}

/**
 * Absolute URL for a route, with the trailing slash the host actually serves.
 *
 * Cloudflare Pages 308-redirects /blog/x to /blog/x/ (it serves the file at
 * dist/blog/x/index.html). A canonical pointing at the pre-redirect URL names a
 * URL that does not exist, so Google has to guess which of the two is real and
 * the declared canonical is contradicted by the response. Normalising here
 * keeps canonical, og:url, and the JSON-LD that reads them all on the URL the
 * server returns 200 for. The root stays "/" and is never doubled.
 */
export function canonicalUrl(path = '/') {
    const clean = String(path).split(/[?#]/)[0] || '/';
    const withSlash = clean === '/' ? '/' : `${clean.replace(/\/+$/, '')}/`;
    return `${ORIGIN}${withSlash}`;
}

/**
 * Lightweight, dependency-free per-page SEO. Sets title, meta description,
 * canonical, Open Graph / Twitter, an optional robots directive, and an
 * optional JSON-LD block (e.g. BreadcrumbList or Article) for the current route.
 *
 * Usage:
 *   useSeo({ title: 'Pricing', description: '…', path: '/pricing' });
 */
export function useSeo({
    title,
    description = DEFAULT_DESC,
    path = '',
    image = DEFAULT_OG,
    noindex = false,
    jsonLd = null,
} = {}) {
    useEffect(() => {
        // Google truncates around 60 characters. Appending "— InsightsTrack"
        // to an already-long post title pushes the distinctive part out of the
        // SERP, so the brand suffix is only added when it actually fits; the
        // brand still appears in og:site_name and the visible page chrome.
        const branded = title ? `${title} — ${SITE}` : `${SITE} — Self-Hosted, Privacy-First Analytics`;
        const fullTitle = title && branded.length > 60 ? title : branded;
        const url = canonicalUrl(path || (typeof window !== 'undefined' ? window.location.pathname : ''));

        document.title = fullTitle;
        setMeta('name', 'description', description);
        setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
        setCanonical(url);

        // Open Graph
        setMeta('property', 'og:title', fullTitle);
        setMeta('property', 'og:description', description);
        setMeta('property', 'og:url', url);
        setMeta('property', 'og:image', image);
        setMeta('property', 'og:type', 'website');

        // Twitter
        setMeta('name', 'twitter:title', fullTitle);
        setMeta('name', 'twitter:description', description);
        setMeta('name', 'twitter:image', image);

        // Optional structured data for this page (breadcrumbs, article, etc.)
        setJsonLd('page-jsonld', jsonLd);

        return () => setJsonLd('page-jsonld', null);
    }, [title, description, path, image, noindex, JSON.stringify(jsonLd)]);
}

export { ORIGIN, SITE };
