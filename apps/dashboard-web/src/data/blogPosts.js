/**
 * Blog posts for SEO. Each targets a winnable long-tail keyword and answers
 * the query in depth. Content is plain markdown-ish (rendered by Blog.jsx).
 * Keep paragraphs short and headings descriptive for both readers and crawlers.
 */
export const BLOG_POSTS = [
    {
        slug: 'open-source-google-analytics-alternative',
        title: 'The Best Open-Source Google Analytics Alternative (Self-Hosted & Free)',
        description:
            'Looking for an open-source, self-hosted alternative to Google Analytics? Here is how InsightsTrack gives you cookieless, privacy-first web analytics you fully own — free forever.',
        keyword: 'open source google analytics alternative',
        date: '2026-06-20',
        readingMinutes: 6,
        body: `
## Why look for a Google Analytics alternative?

Google Analytics 4 is powerful, but it comes with trade-offs that more and more teams are no longer willing to accept: it sets cookies (so you need a consent banner), it sends your visitors' data to Google, the reports are slow, and the interface is famously hard to use. For privacy-conscious teams and developers, those trade-offs are dealbreakers.

An **open-source, self-hosted analytics platform** flips every one of those problems: your data stays on your own server, there are no cookies and no consent banner, and you can read and modify the source code.

## What makes a good open-source alternative?

When you evaluate an open-source Google Analytics alternative, look for:

- **True self-hosting** — you run it on your own infrastructure, not someone else's cloud.
- **Cookieless tracking** — no consent banner, GDPR-friendly by design.
- **Speed** — analytics queries should be fast even over millions of events.
- **Depth** — real-time, funnels, heatmaps, and Core Web Vitals, not just pageviews.
- **A permissive license** — MIT or similar, so you can use it commercially.

## How InsightsTrack compares

InsightsTrack is built specifically to tick all of those boxes:

| | Google Analytics 4 | InsightsTrack |
|---|---|---|
| Open source | ❌ | ✅ (MIT) |
| Self-hosted | ❌ | ✅ |
| Cookies / consent banner | Required | None |
| Sells / shares data | Yes | Never |
| Real-time, heatmaps, funnels | Partial | ✅ |
| Price | "Free" (your data) | Free forever |

Under the hood, InsightsTrack uses PostgreSQL for writes and DuckDB — an embedded columnar engine — for reads, so 90-day reports return in under 100 ms even across millions of events.

## Try it without installing anything

You do not have to clone a repo to see if it fits. InsightsTrack ships a **live demo**: open the dashboard, sign up, and you are instantly exploring real sample data — heatmaps, funnels, realtime, and more.

When you are ready to self-host, it is a single \`docker-compose up\`.

## The bottom line

If you want analytics you fully own, without cookies, consent banners, or data selling, an open-source self-hosted tool is the answer — and InsightsTrack is a fast, modern, free option you can try in seconds.
`,
    },
    {
        slug: 'self-host-analytics-with-docker',
        title: 'How to Self-Host Web Analytics with Docker in 15 Minutes',
        description:
            'A step-by-step guide to self-hosting privacy-first web analytics with Docker. Spin up the full stack — database, API, and dashboard — with one command.',
        keyword: 'self-hosted analytics docker',
        date: '2026-06-24',
        readingMinutes: 5,
        body: `
## Why self-host your analytics?

Self-hosting means your visitors' data never leaves infrastructure you control. No third party, no data sharing, no monthly per-seat bill. With Docker, standing up a complete analytics stack takes minutes.

## What you need

- **Docker** and **Docker Compose** installed
- A server or your local machine
- About 15 minutes

## Step 1 — Clone the repository

\`\`\`bash
git clone https://github.com/NishikantaRay/InsightTrack.git
cd InsightTrack
\`\`\`

## Step 2 — Configure environment

Copy the example environment file and fill in your secrets (database password, JWT secret):

\`\`\`bash
cp .env.example .env
\`\`\`

For production, generate strong values:

\`\`\`bash
openssl rand -base64 48   # use for JWT_SECRET and POSTGRES_PASSWORD
\`\`\`

## Step 3 — Start the stack

\`\`\`bash
docker-compose up --build -d
\`\`\`

That single command brings up PostgreSQL, the analytics API, the dashboard, and a demo site:

| Service | URL |
|---|---|
| Dashboard | http://localhost:4173 |
| API | http://localhost:3001 |

## Step 4 — Add the tracking script

Create a site in **Settings**, then paste the snippet into your website's \`<head>\`:

\`\`\`html
<script src="https://your-domain/api/sites/YOUR_SITE_ID/script"></script>
\`\`\`

The script is about 2 KB and loads asynchronously, so it never slows your site. Pageviews, sessions, clicks, scroll depth, Web Vitals, and heatmap data start flowing immediately.

## Step 5 — Go to production

Put the stack behind HTTPS (Caddy or Nginx + Let's Encrypt), set your real \`CORS_ORIGINS\` and \`APP_BASE_URL\`, and mount a volume for the DuckDB file so data persists across restarts.

That is it — self-hosted, privacy-first analytics running in about 15 minutes.
`,
    },
    {
        slug: 'cookieless-analytics-explained',
        title: 'Cookieless Analytics, Explained: Track Visitors Without Cookies or Consent Banners',
        description:
            'What is cookieless analytics and how does it work? Learn how privacy-first tools track visitors with anonymous IDs, no cookies, and no GDPR consent banner.',
        keyword: 'cookieless analytics',
        date: '2026-06-27',
        readingMinutes: 5,
        body: `
## What is cookieless analytics?

Cookieless analytics measures your website traffic **without storing cookies** in the visitor's browser. Because no personal identifiers are stored, you typically do not need a cookie consent banner, and you stay on the right side of regulations like GDPR.

## How can you track visitors without cookies?

Traditional analytics drop a cookie to recognise returning visitors. Cookieless tools use privacy-preserving alternatives:

- **Anonymous first-party IDs** — a random identifier stored in the browser's localStorage (not a cookie, not shared across sites).
- **No IP storage** — the visitor's location (country) is derived from their browser timezone, a far less sensitive signal, and the IP is discarded before it ever hits the database.
- **No fingerprinting** — no attempt to identify a device by its characteristics.

The result: you can count unique visitors and sessions without ever collecting personal data.

## Do you still need a consent banner?

In most jurisdictions, if you set no cookies and store no personal data, you do not need a consent banner. (Always confirm with your own legal counsel for your region.) Tools like InsightsTrack also honor the browser **Do Not Track (DNT)** and **Global Privacy Control (GPC)** signals automatically.

## What you can still measure

Cookieless does not mean limited. With InsightsTrack you still get:

- Real-time visitors and a live world map
- Pageviews, sessions, bounce rate, top pages
- Conversion funnels and goals
- Click heatmaps
- Core Web Vitals and JS error tracking

## Why it matters

Cookieless, privacy-first analytics respects your visitors **and** simplifies your compliance — no banner, no data-sharing agreements, no risk. You understand your traffic; your visitors keep their privacy.

Want to see it in action? Try the InsightsTrack live demo — no install, no signup friction.
`,
    },
    {
        slug: 'postgres-duckdb-analytics-architecture',
        title: 'Why We Built Analytics on PostgreSQL + DuckDB (Architecture Deep-Dive)',
        description:
            'A technical deep-dive into the dual-database analytics architecture behind InsightsTrack: PostgreSQL for writes, DuckDB for reads, and how it answers 90-day queries in under 100 ms.',
        keyword: 'duckdb analytics architecture',
        date: '2026-06-28',
        readingMinutes: 9,
        body: `
## The problem with one database for analytics

Web analytics has two very different workloads. **Writes** are tiny, frequent, and transactional — one row per pageview, thousands per minute. **Reads** are huge aggregations — "count distinct visitors per day over the last 90 days, grouped by country." A single database tuned for one is bad at the other.

Row-store databases like PostgreSQL are excellent at writes but slow at wide aggregations, because answering "sum over 5 million rows" means walking 5 million rows. Column-store (OLAP) engines flip that: they read only the columns you ask for, in compressed blocks, and aggregate at memory bandwidth.

So we use **both**.

## The dual-database design

- **PostgreSQL** is the source of truth for all **writes**: tracking events, sessions, users, sites, teams. It is durable, transactional, and battle-tested.
- **DuckDB** is an embedded **columnar OLAP** engine that serves every **analytics read**. It runs in-process (no separate server), and it is astonishingly fast at the GROUP BY / COUNT DISTINCT queries dashboards live on.

A background sync streams new rows from PostgreSQL into DuckDB. The dashboard never queries PostgreSQL directly — it only reads from DuckDB.

\`\`\`
Tracking script ──▶ POST /api/track ──▶ PostgreSQL (writes)
                                            │  sync (keyset cursor)
                                            ▼
Dashboard ◀── GET /api/analytics ◀──────  DuckDB (reads)
\`\`\`

## Why DuckDB specifically

DuckDB is "SQLite for analytics": a single file, zero-config, in-process, columnar. For a self-hosted tool that matters enormously — there is no extra service to run, no cluster to manage. You ship one binary dependency and get column-store performance.

On a single node, DuckDB answers a 90-day KPI aggregation over millions of events in **under 100 ms**. The same query against the row-store would take seconds.

## The sync pipeline (and how we made it correct)

The naive sync — "copy every row newer than the last timestamp" — has two classic bugs:

1. **Duplicates on crash.** If the process dies mid-sync and the high-water mark was only written at the end, the next run re-copies rows.
2. **Lost rows at the boundary.** If many rows share the same millisecond timestamp, a \`timestamp > last\` cursor can skip some.

We fixed both with a **keyset cursor on the monotonic event id**: page by \`id > last_id ORDER BY id\`, and persist the cursor **after every batch**. A re-run resumes exactly where it left off — idempotent, and no boundary gaps. Bulk inserts (one multi-row INSERT per batch) make it fast.

## Hot + cold for scale (appsv2)

For very large datasets, the v2 layout adds a **hot/cold** tier: the last 30 days live in a DuckDB hot table (RAM-speed), and older data is exported to **Parquet files** (optionally on S3 or Cloudflare R2). A transparent \`UNION ALL\` view stitches them together, so queries still just say \`FROM events\` and get the full history — recent data fast, historical data cheap.

## What this buys you

- Fast dashboards at any scale, on a single node
- No separate analytics database server to operate
- Clean separation: durable writes in PG, fast reads in DuckDB
- A read-only SQL editor that lets power users query their own data directly

It is the kind of architecture that used to require a data warehouse — running in one open-source container you can self-host.

Curious how it feels? The InsightsTrack live demo runs this exact stack with sample data.
`,
    },
    {
        slug: 'migrate-from-google-analytics',
        title: 'How to Migrate from Google Analytics to Self-Hosted Analytics',
        description:
            'A practical, step-by-step guide to migrating off Google Analytics 4 to a self-hosted, privacy-first alternative — without losing tracking or breaking your site.',
        keyword: 'migrate from google analytics',
        date: '2026-06-28',
        readingMinutes: 7,
        body: `
## Should you migrate off Google Analytics?

If any of these apply, migrating is worth it:

- You want to **own your data** instead of sending it to Google.
- You are tired of the **cookie consent banner** GA4 forces.
- You find GA4's interface slow and confusing.
- You need **GDPR compliance** without legal gymnastics.
- You want analytics that load fast and do not bloat your site.

Self-hosted, cookieless analytics solves all of these. Here is how to switch cleanly.

## Step 1 — Run both in parallel first

Do not rip out GA4 on day one. Install your new analytics **alongside** it for a week or two. This lets you compare numbers, build confidence, and confirm tracking works before you remove anything.

\`\`\`html
<!-- Keep GA4 for now -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<!-- Add InsightsTrack -->
<script src="https://your-domain/api/sites/YOUR_SITE_ID/script"></script>
\`\`\`

## Step 2 — Understand the metric differences

Numbers will not match GA4 exactly, and that is expected (and usually a good thing):

- **No bot inflation** — cookieless first-party tracking filters far more noise.
- **Different "session" logic** — most privacy tools use simpler, more honest session definitions.
- **Country from timezone**, not IP — slightly different geo distribution, but no IP stored.

Focus on **trends**, not absolute parity. If both tools agree your traffic is up 12% week-over-week, you are tracking correctly.

## Step 3 — Recreate your key reports

Map what you actually use in GA4 to the new tool:

| GA4 report | InsightsTrack equivalent |
|---|---|
| Realtime | Realtime page (live visitors + map) |
| Acquisition / Traffic sources | Acquisition (sources + UTM) |
| Pages and screens | Pages |
| Conversions / Events | Funnels + Conversions |
| Engagement | Engagement (scroll depth, rage clicks) |

## Step 4 — Move your UTM campaigns

Your existing UTM-tagged links keep working — InsightsTrack reads \`utm_source\`, \`utm_medium\`, \`utm_campaign\`, etc. automatically. No changes to your ad campaigns needed.

## Step 5 — Set up goals and funnels

Recreate your GA4 conversions as **goals** and multi-step **funnels** so you can see drop-off between steps (e.g. Visit → Signup → Checkout → Purchase).

## Step 6 — Remove GA4

Once you trust the new numbers, delete the GA4 script. Bonus: your site gets faster (GA4's gtag.js is ~50× larger than a privacy-first ~2 KB script), and you can finally remove the cookie consent banner.

## Migration checklist

- [ ] Install new analytics alongside GA4
- [ ] Verify pageviews and events are recording
- [ ] Recreate key reports and goals
- [ ] Compare trends for 1–2 weeks
- [ ] Remove GA4 + cookie banner
- [ ] Enjoy owning your data

Want a low-risk way to evaluate first? Explore the InsightsTrack live demo before you touch your site.
`,
    },
    {
        slug: 'core-web-vitals-monitoring-guide',
        title: 'Monitoring Core Web Vitals (LCP, CLS, INP) From Your Own Analytics',
        description:
            'Learn what Core Web Vitals are, the thresholds Google uses, and how to monitor LCP, CLS, and INP from real users with self-hosted, privacy-first analytics.',
        keyword: 'core web vitals monitoring',
        date: '2026-06-29',
        readingMinutes: 8,
        body: `
## What are Core Web Vitals?

Core Web Vitals are the three real-user performance metrics Google uses as a ranking signal:

- **LCP (Largest Contentful Paint)** — how fast the main content renders. Good: under **2.5 s**.
- **CLS (Cumulative Layout Shift)** — how much the page jumps around while loading. Good: under **0.1**.
- **INP (Interaction to Next Paint)** — how responsive the page feels to clicks/taps. Good: under **200 ms**. (INP replaced FID in 2024.)

Two more are often tracked alongside: **TTFB** (server response time) and **FCP** (first paint).

## Lab data vs. field data

Tools like Lighthouse give you **lab data** — one run, on one machine. Useful, but it is not what your actual users experience. **Field data** (a.k.a. RUM, Real User Monitoring) measures Web Vitals from real visitors on real devices and networks. Google ranks on field data.

To get field data you need to collect it from real sessions — which is exactly what an analytics tracking script can do.

## How to collect Web Vitals from real users

The browser exposes Web Vitals through the \`PerformanceObserver\` API. A tracking script subscribes to them and reports the values back:

\`\`\`js
import { onLCP, onCLS, onINP } from 'web-vitals';
onLCP((m) => track('web_vital', { name: 'LCP', value: m.value }));
onCLS((m) => track('web_vital', { name: 'CLS', value: m.value }));
onINP((m) => track('web_vital', { name: 'INP', value: m.value }));
\`\`\`

InsightsTrack's tracking script does this automatically — no extra setup. Every real session contributes its Web Vitals.

## Reading the numbers: use p75, not averages

Google scores Web Vitals at the **75th percentile** of your traffic. Averages hide your slowest 25% of users (often mobile / slow networks). Always look at **p75**: "75% of my users had an LCP under X." InsightsTrack's Performance page scores each metric Good / Needs-Improvement / Poor against Google's thresholds at p75.

## Turning metrics into fixes

- **High LCP?** Optimize your largest image/hero, preload critical assets, reduce server TTFB.
- **High CLS?** Set explicit width/height on images and embeds; avoid injecting content above existing content.
- **High INP?** Break up long JavaScript tasks, defer non-critical work, avoid heavy event handlers.

## Why monitor it from your own analytics

Monitoring Web Vitals inside the same tool you already use for traffic means you can correlate performance with behaviour: did a deploy regress LCP? Did a slow page hurt conversions? And because it is self-hosted and cookieless, you collect this real-user data without sending anything to a third party.

See live Core Web Vitals (LCP, CLS, INP, TTFB) scored against Google's thresholds in the InsightsTrack demo.
`,
    },
];

export function getPost(slug) {
    return BLOG_POSTS.find((p) => p.slug === slug);
}
