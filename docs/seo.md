# SEO — on-page and technical

How `insightstrack.dev` is made crawlable and rankable. Companion to
[`aeo.md`](aeo.md), which covers the Markdown twin and AI answer engines.

Everything here lives in `analytics-dashboard/` and is produced by
`npm run build:seo` (Vite build → OG images → RSS → sitemap → prerender).
A plain `npm run build` skips all of it and ships an empty SPA shell, so
**deploys must run `build:seo`**.

## Where things live

| File | Purpose |
|------|---------|
| `src/hooks/useSeo.js` | Per-route title, description, canonical, OG/Twitter, robots, JSON-LD. Owns the trailing-slash canonical rule and the title-length rule. |
| `scripts/prerender.mjs` | Renders each public route headlessly and snapshots it to static HTML, so crawlers see content rather than `<div id="root">`. Also injects `article:*` meta. |
| `scripts/sitemap.mjs` | Generates `dist/sitemap.xml` from `BLOG_POSTS`, with per-post `<lastmod>`. |
| `scripts/og-images.mjs` | Per-post Open Graph cards. |
| `src/data/blogPosts.js` | Post bodies, `seoTitle` overrides, and `TAG_INTROS`. |
| `public/robots.txt` | Crawl directives; points at the sitemap. |

## Rules that are enforced, not just intended

**Titles stay under ~60 characters.** Google truncates past roughly that.
`useSeo` appends `— InsightsTrack` only when the result still fits, and a post
whose own headline is already long carries a shorter `seoTitle` used for the
`<title>` tag alone. The full headline remains the on-page `<h1>` — the two are
deliberately allowed to differ.

```js
// src/data/blogPosts.js
{
    title: 'What Is a Good Bounce Rate? (And Why the Metric Misleads You)', // <h1>
    seoTitle: 'What Is a Good Bounce Rate?',                                // <title>
}
```

**Canonicals name the URL the host actually serves.** Cloudflare Pages
308-redirects `/blog/x` to `/blog/x/`. `canonicalUrl()` normalises to the
trailing-slash form so canonical, `og:url`, and JSON-LD all agree with the URL
that returns 200. The root stays `/` and is never doubled.

**Public pages never link to routes that 404 for a crawler.** Two classes to
watch:

- Routes inside the authenticated layout (`/docs`, `/settings`, …) are never
  prerendered. A public page must link to a public equivalent — the landing
  page's docs link points at the GitHub `docs/` folder, not `/docs`.
- `/landing` is *not* a URL. The prerenderer writes that route to
  `dist/index.html`, so public links to the home page use `/`.

**Auth links carry `rel="nofollow"`.** `/login` and `/register` are real buttons
but are `Disallow`ed and unprerendered, so following them yields a 404 in crawl
reports. `nofollow` keeps them working for users without inviting crawlers.

**Every post has an FAQ.** `## Frequently asked questions` with `### ` questions
beneath it is parsed by `extractFaq()` in `src/pages/Blog.jsx` and emitted as
`FAQPage` structured data. Google requires the marked-up answer to be **visible
on the page**, which is why the schema is derived from the rendered body rather
than written separately — the two cannot drift. `src/__tests__/faqSchema.test.jsx`
asserts every post has a section and that the schema carries every question in
it, including the last one.

**Tag archives carry real intro copy.** `TAG_INTROS` in `src/data/blogPosts.js`
gives each tag a paragraph, used both on the page and as its meta description.
Without it a tag page is a heading plus a list of cards — thin content that
ranks for nothing and gives a reader no reason to stay.

## Page weight is an SEO concern

Core Web Vitals are a ranking signal, and the biggest lever on this site is how
much JavaScript a *reader* downloads. Blog and landing routes are code-split,
but anything imported eagerly by `App.jsx` lands in the entry chunk that every
visitor fetches — including people who only ever read one article.

`AssistantPanel` is therefore lazy-loaded from `DashboardLayout`. It pulls in
Recharts for Pulse's result cards, and a static import put the whole charting
library in the entry chunk: **724 KB → 287 KB** once deferred, with Recharts
isolated in its own chunk that loads only when Pulse is opened.
`src/__tests__/assistantPanelLazy.test.jsx` guards both directions — the panel
must be absent while closed and present once opened.

The rule generalises: **before adding an eager import to `App.jsx` or
`DashboardLayout`, check what it drags in.** `npm run build` prints chunk sizes;
a jump in `assets/index-*.js` is a regression a blog reader pays for.

```bash
# what is actually in the entry chunk
grep -c "recharts" dist/assets/index-*.js    # expect 0
```

Images carry `loading="lazy"` and `decoding="async"` plus explicit
`width`/`height` — the dimensions reserve space and keep CLS at zero.

## Structured data

Emitted per route by `useSeo`, injected into static HTML by the prerenderer:

| Type | Where |
|------|-------|
| `SoftwareApplication`, `WebSite`, `Organization` | `index.html`, site-wide |
| `BlogPosting` + `BreadcrumbList` | every post |
| `FAQPage` | every post |
| `CollectionPage` + `ItemList` + `BreadcrumbList` | tag archives |

`SoftwareApplication` deliberately carries **no `aggregateRating`**. Validators
flag it as a missing recommended field, and it is the one field that cannot be
supplied honestly without real reviews — inventing a rating is fabricated review
markup and a manual-action risk. The page stays valid; it simply does not
qualify for a star-rating rich result. Do not "fix" this warning by inventing a
number.

## Known external items (not fixable in this repo)

- **`/cdn-cgi/l/email-protection` 404s** — Cloudflare's Email Address
  Obfuscation rewriting `mailto:` links. Disable under Scrape Shield.
- **Permanent-redirect notices** — the trailing-slash policy working as
  intended.
- **HSTS on a subdomain** — host configuration.

## Verifying a change

```bash
cd analytics-dashboard
npm test                 # includes blogSeo + faqSchema suites
npm run build:seo        # self-checks titles, canonicals, og:*, empty roots
```

The prerender self-check fails the build on a page whose root never hydrated or
whose metadata still describes the home page. Beyond that, these hold on the
built output:

```bash
# no public link points at a route the host 404s
grep -ro 'href="/landing"\|href="/docs"' dist --include='*.html' | wc -l   # 0

# every post carries FAQ structured data
grep -rlo 'FAQPage' dist/blog --include='*.html' | wc -l                   # 31

# no title exceeds 60 characters
for f in $(find dist -name index.html); do
  t=$(grep -o '<title>[^<]*</title>' "$f" | sed 's/<[^>]*>//g')
  [ ${#t} -gt 60 ] && echo "LONG ${#t} $f"
done
```

## Three-copy rule

Per `CLAUDE.md` rule 9, every file here exists in `traffic/`,
`traffic2/apps/dashboard-web/`, and `traffic2/appsv2/dashboard-web/` and must
stay byte-identical. Sync procedure:
`.claude/skills/insighttrack/references/workflows.md`.
