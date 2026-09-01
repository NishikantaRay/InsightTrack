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
        readingMinutes: 5,
        tags: ["Google Analytics","Privacy"],
        body: `
## Why look for a Google Analytics alternative?

Google Analytics 4 is powerful, but it comes with trade-offs that more and more teams are no longer willing to accept: it sets cookies (so you need a consent banner), it sends your visitors' data to Google, the reports are slow, and the interface is famously hard to use. For privacy-conscious teams and developers, those trade-offs are dealbreakers.

An **open-source, self-hosted analytics platform** flips every one of those problems: your data stays on your own server, there are no cookies and no consent banner, and you can read and modify the source code.

## What makes a good open-source alternative?

When you evaluate an open-source Google Analytics alternative, look for:

- **True self-hosting** — you run it on your own infrastructure, not someone else's cloud.
- **Cookieless tracking** — GDPR-friendly by design. Whether a consent banner is required depends on your jurisdiction and deployment.
- **Speed** — analytics queries should stay responsive as the dataset grows.
- **Depth** — real-time, funnels, heatmaps, and Core Web Vitals, not just pageviews.
- **A permissive license** — MIT or similar, so you can use it commercially.

## The landscape in 2026

The open-source analytics space has real depth now. The tools people actually shortlist:

| Tool | License | Storage | Self-host | Notable
|---|---|---|---|---|
| **Matomo** | GPL | MySQL/MariaDB | Yes | The most feature-complete; heaviest to run |
| **Plausible** | AGPL | ClickHouse | Yes | Simple, fast, opinionated; ClickHouse to operate |
| **Umami** | MIT | Postgres/MySQL | Yes | Very light; fewer advanced reports |
| **PostHog** | MIT (core) | ClickHouse | Yes | Product analytics, session replay; large footprint |
| **InsightsTrack** | MIT | Postgres + DuckDB | Yes | Embedded OLAP, no extra DB service; heatmaps + SQL editor |

Individual deep-dives: [vs PostHog](/blog/posthog-alternative), [vs Plausible](/blog/plausible-alternative), [vs Matomo](/blog/matomo-alternative), [vs Umami](/blog/umami-alternative), or the [full roundup](/blog/best-open-source-analytics-tools-compared).

The honest summary: Matomo if you need every GA feature and can run it. Plausible or Umami if you want simple traffic numbers. PostHog if you are doing product analytics, not web analytics. InsightsTrack if you want depth — heatmaps, funnels, Web Vitals, raw SQL — without operating a second database cluster.

## The operational cost nobody mentions

Feature tables ignore the thing that actually decides whether a self-hosted tool survives: how much work it is to keep running.

Anything backed by ClickHouse means a ClickHouse instance — sizing, merges, replication, upgrades, and a query dialect with its own edges. That is fine with a platform team and heavy without one.

InsightsTrack uses **DuckDB**, which is embedded. It runs inside the API process and reads a single file. There is no analytics database to deploy, monitor, or upgrade separately — writes go to PostgreSQL, a background sync feeds DuckDB, and reads come from DuckDB. One less service, and column-store read performance regardless. The [architecture deep-dive](/blog/postgres-duckdb-analytics-architecture) covers the design, and [DuckDB vs ClickHouse vs Postgres](/blog/duckdb-vs-clickhouse-vs-postgres-analytics) covers when each engine is the right call.

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

Under the hood, InsightsTrack uses PostgreSQL for writes and DuckDB — an embedded columnar engine — for reads (the [architecture deep-dive](/blog/postgres-duckdb-analytics-architecture) explains why). Columnar storage suits the wide aggregations a dashboard issues; real-world latency depends on your dataset, hardware, and query shape.

## What you give up, honestly

Switching off GA4 has real costs, and pretending otherwise wastes your time:

- **Google Ads integration.** GA4 wires directly into Ads for conversion import and audience building. No self-hosted tool replaces that. If your business runs on Google Ads, expect to keep GA4 alongside, or accept manual conversion tracking.
- **Cross-device identity.** Privacy-first tools deliberately avoid the persistent cross-site identity that makes GA4's user journeys work. You get session-level truth, not person-level.
- **Multi-touch attribution over weeks.** For the same reason, last-touch by session is the realistic model. See [the UTM guide](/blog/utm-parameters-guide) for what that means in practice.
- **You operate it.** Backups, upgrades, and uptime are yours. That is the trade for owning the data.

Everything else — traffic, sources, pages, funnels, goals, real-user performance — transfers cleanly, and usually reads more honestly because there is far less bot inflation.

## Will my numbers match GA4?

No, and they should not. Expect self-hosted, cookieless numbers to differ because:

- **Less bot traffic** is counted, because there is no ad-tech surface to attract it.
- **Ad blockers** block \`gtag.js\` far more aggressively than a first-party script on your own domain, so a privacy tool often records *more* real humans than GA4 did.
- **Session rules differ**, and so does geography (timezone-derived country, not IP lookup).

Compare *trends*, not absolute totals. If both tools agree traffic rose 12% week-over-week, both are working. [Metrics explained](/blog/website-analytics-metrics-explained) covers where each definition diverges.

## Try it without installing anything

You do not have to clone a repo to see if it fits. InsightsTrack ships a **live demo**: open the dashboard, sign up, and you are instantly exploring real sample data — heatmaps, funnels, realtime, and more.

When you are ready to self-host, it is a single \`docker-compose up\` — see the [15-minute Docker guide](/blog/self-host-analytics-with-docker). Already on GA4? Follow the [migration walkthrough](/blog/migrate-from-google-analytics).

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
        readingMinutes: 4,
        tags: ["Self-Hosting"],
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

The script is about 9 KB gzipped and loads asynchronously, so it does not block rendering. Pageviews, sessions, clicks, scroll depth, Web Vitals, and heatmap data start flowing immediately.

## What each container does

The compose file brings up four services, and it helps to know which is which when something misbehaves:

| Service | Role | Notes |
|---|---|---|
| \`postgres\` | Source of truth for all writes | Tracking events, users, sites, teams |
| \`analytics-api\` | Express API | Ingests events; serves dashboard reads from DuckDB |
| \`dashboard-web\` | React dashboard | Static build served over HTTP |
| \`demo-site\` | Example site | Carries the tracking script so you have data immediately |

DuckDB is **not** a service. It is embedded inside the API process and reads a single file on a mounted volume — which is exactly why this stack is four containers and not six. See [the architecture](/blog/postgres-duckdb-analytics-architecture).

## Persisting data across restarts

The single most common self-hosting mistake is losing data on \`docker-compose down\`. Two volumes matter:

\`\`\`yaml
volumes:
  pgdata:      # PostgreSQL — the source of truth
  duckdata:    # DuckDB file — rebuildable, but slow to rebuild
\`\`\`

PostgreSQL's volume is the one you must never lose. The DuckDB file is derived state and can be rebuilt from Postgres by re-running the sync — but at any real data volume that takes a while, so persist it too.

Note that \`docker-compose down -v\` **deletes volumes**. Use plain \`docker-compose down\` unless you genuinely want a clean slate.

## Backups

Derived state does not need backing up; the source of truth does.

\`\`\`bash
# nightly, to off-box storage
docker compose exec -T postgres pg_dump -U trafficuser analytics | gzip > backup-$(date +%F).sql.gz
\`\`\`

Restore into a fresh stack and re-run the sync to rebuild DuckDB. **Test this at least once before you need it** — an untested backup is a hypothesis, not a backup.

## Troubleshooting

- **No data appearing.** Open the browser console on the tracked site. If the request to \`/api/track\` is blocked by CORS, your \`CORS_ORIGINS\` does not include the site's origin.
- **Dashboard empty but events are in Postgres.** The sync has not run or is failing. Check the API logs for sync lag; it is the first metric to look at for almost any "where is my data" question — see [the sync design](/blog/incremental-sync-postgres-to-duckdb).
- **Container restarts on boot.** Usually \`memory_limit\` exceeding what the container actually has. Set DuckDB's limit to match the container, not the host.
- **Tracking works locally, not in production.** Almost always mixed content or a missing HTTPS certificate — the script must load over the same scheme as the page.

## Step 5 — Go to production

Put the stack behind HTTPS (Caddy or Nginx + Let's Encrypt), set your real \`CORS_ORIGINS\` and \`APP_BASE_URL\`, and mount a volume for the DuckDB file so data persists across restarts.

That is it — self-hosted, privacy-first analytics running in about 15 minutes. Next: understand [how cookieless tracking works](/blog/cookieless-analytics-explained), or read the [architecture behind the dashboard](/blog/postgres-duckdb-analytics-architecture).
`,
    },
    {
        slug: 'cookieless-analytics-explained',
        title: 'Cookieless Analytics, Explained: Track Visitors Without Cookies or Consent Banners',
        description:
            'What is cookieless analytics and how does it work? Learn how privacy-first tools track visitors with pseudonymous identifiers and no cookies.',
        keyword: 'cookieless analytics',
        date: '2026-06-27',
        readingMinutes: 4,
        tags: ["Privacy"],
        body: `
## What is cookieless analytics?

Cookieless analytics measures your website traffic **without storing cookies** in the visitor's browser. Because no directly identifying data is collected, many teams find their consent obligations are lighter — but requirements vary by jurisdiction and deployment, so consult applicable privacy/ePrivacy requirements rather than treating this as settled.

## How can you track visitors without cookies?

Traditional analytics drop a cookie to recognise returning visitors. Cookieless tools use privacy-preserving alternatives:

- **Anonymous first-party IDs** — a random identifier stored in the browser's localStorage (not a cookie, not shared across sites).
- **No IP storage** — the visitor's location (country) is derived from their browser timezone, a far less sensitive signal, and the IP is discarded before it ever hits the database.
- **No fingerprinting** — no attempt to identify a device by its characteristics.

The result: you can count unique visitors and sessions without ever collecting personal data.

## How a visitor is counted without a cookie

The mechanics matter, because "cookieless" is often used loosely. There are two honest implementations, and they trade off differently.

**First-party storage.** A random identifier is written to \`localStorage\` on the visitor's device. It is not a cookie, it is never sent to a third party, and it is scoped to your origin — but it *is* still storage on the device, which is why the consent question below is not automatically settled.

**Rotating server-side hashes.** No storage at all. The server derives an identifier by hashing a daily-rotating salt with the request's IP and user agent, then discards the raw inputs:

\`\`\`js
const visitorId = sha256(dailySalt + siteId + ip + userAgent).slice(0, 32);
\`\`\`

Nothing is written to the browser, the raw IP is never stored, and yesterday's identifiers cannot be linked to today's because the salt is destroyed. The cost is honest: a visitor returning tomorrow counts as new. You trade unique-visitor precision for unlinkability.

InsightsTrack uses first-party storage with a **rolling expiry**, so identifiers age out rather than persisting indefinitely. [Privacy-first database design](/blog/privacy-first-analytics-database-design) covers the schema-level decisions.

## What "no fingerprinting" actually rules out

Fingerprinting means identifying a device by its characteristics rather than by stored state — canvas rendering, font lists, audio-stack quirks, screen and hardware details combined into a stable hash. It is the technique privacy regulation is most hostile toward, because it works *specifically* by defeating the user's ability to opt out.

A tool that does not fingerprint therefore will not:

- probe canvas, WebGL, or AudioContext for entropy
- enumerate installed fonts or plugins
- combine hardware details into a device signature
- attempt to re-identify a visitor who cleared their storage

Parsing a user agent into "Chrome 141 on macOS" is not fingerprinting — that is a low-cardinality dimension with no identifying power. The line is whether you are building a **unique** signature.

## Do you still need a consent banner?

This depends on your jurisdiction and deployment. Some regulators treat any storage on a visitor's device — including browser local storage — as in scope regardless of whether it is technically a cookie, so "no cookies" does not automatically mean "no banner". Confirm with your own legal counsel for your region. Separately, InsightsTrack honors the browser **Do Not Track (DNT)** and **Global Privacy Control (GPC)** signals in both the tracking script and the API.

## The trade-offs, stated plainly

Cookieless analytics is not GA4 with the privacy problems removed. Specific things get harder:

- **Cross-device journeys are gone.** Someone who reads on their phone and converts on a laptop is two visitors. There is no privacy-preserving way around this, and any tool claiming otherwise is doing something you should look at closely.
- **Returning-visitor counts are approximate**, especially with rotating identifiers or a short storage expiry.
- **Multi-touch attribution over weeks** is not reliably available. Last-touch by session is the honest model.
- **Very long funnels** that span sessions across days will undercount completion.

What stays fully intact is everything session-scoped and everything aggregate — which is the overwhelming majority of what teams actually act on.

## What you can still measure

Cookieless does not mean limited. With InsightsTrack you still get:

- Real-time visitors and a live world map
- Pageviews, sessions, bounce rate, top pages
- Conversion funnels and goals
- Click heatmaps
- Core Web Vitals and JS error tracking

## Why it matters

For the schema-level view, see [privacy-first database design](/blog/privacy-first-analytics-database-design) and the [GDPR guide](/blog/gdpr-compliant-analytics-guide). Cookieless, privacy-first analytics respects your visitors **and** simplifies your compliance — no banner, no data-sharing agreements, no risk. You understand your traffic; your visitors keep their privacy.

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
        readingMinutes: 3,
        tags: ["DuckDB","Architecture"],
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

On a single node, a 90-day KPI aggregation reads only the columns it needs rather than whole rows, which is what makes this shape of query cheap on a columnar engine. Actual latency depends on dataset size, hardware, and query shape.

## The sync pipeline (and how we made it correct)

The naive sync — "copy every row newer than the last timestamp" — has two classic bugs:

1. **Duplicates on crash.** If the process dies mid-sync and the high-water mark was only written at the end, the next run re-copies rows.
2. **Lost rows at the boundary.** If many rows share the same millisecond timestamp, a \`timestamp > last\` cursor can skip some.

We fixed both with a **keyset cursor on the monotonic event id** (the [incremental sync guide](/blog/incremental-sync-postgres-to-duckdb) walks through the implementation): page by \`id > last_id ORDER BY id\`, and persist the cursor **after every batch**. A re-run resumes exactly where it left off — idempotent, and no boundary gaps. Bulk inserts (one multi-row INSERT per batch) make it fast.

## Hot + cold for scale (appsv2)

For very large datasets, the v2 layout adds a **hot/cold** tier: the last 30 days live in a DuckDB hot table (RAM-speed), and older data is exported to **Parquet files** (optionally on S3 or Cloudflare R2). A transparent \`UNION ALL\` view stitches them together, so queries still just say \`FROM events\` and get the full history — recent data fast, historical data cheap.

## What this buys you

- Fast dashboards at any scale, on a single node
- No separate analytics database server to operate
- Clean separation: durable writes in PG, fast reads in DuckDB
- A read-only SQL editor that lets power users query their own data directly

It is the kind of architecture that used to require a data warehouse — running in one open-source container you can self-host. Further reading: [why columnar storage is faster](/blog/columnar-vs-row-storage-explained), [DuckDB vs ClickHouse vs Postgres](/blog/duckdb-vs-clickhouse-vs-postgres-analytics), and [Parquet cold storage](/blog/duckdb-parquet-cold-storage).

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
        readingMinutes: 5,
        tags: ["Google Analytics"],
        body: `
## Should you migrate off Google Analytics?

If any of these apply, migrating is worth it:

- You want to **own your data** instead of sending it to Google.
- You are tired of the **cookie consent banner** GA4 forces.
- You find GA4's interface slow and confusing.
- You need **GDPR compliance** without legal gymnastics.
- You want analytics that load fast and do not bloat your site.

Self-hosted, cookieless analytics solves all of these — see [the open-source alternatives compared](/blog/open-source-google-analytics-alternative). Here is how to switch cleanly.

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

Once you trust the new numbers, delete the GA4 script. Bonus: your site gets lighter — GA4's gtag.js is substantially larger than a privacy-first tracking script — and you can revisit whether your consent banner is still required for your jurisdiction.

## Exporting your GA4 history first

Your historical data does not migrate — the schemas are fundamentally different — but you should not lose it either. Before you remove GA4:

- **Export the reports you actually reference** as CSV from the GA4 UI: acquisition by channel, top pages, conversions, and monthly totals for the last two or three years.
- **Use the BigQuery export** if you already have it linked. That is the only way to get event-level GA4 data out in bulk.
- **Screenshot your annotated milestones** — launches, campaigns, redesigns — so future-you can explain a spike in the archive.

Keep those exports somewhere durable. The practical goal is being able to answer "how did last year compare" without keeping GA4 alive to do it.

## Running the numbers side by side

During the parallel period, build one small comparison table each week rather than staring at two dashboards:

| Week | GA4 sessions | New tool sessions | Ratio |
|---|---|---|---|
| W1 | 4,210 | 4,980 | 1.18 |
| W2 | 3,940 | 4,610 | 1.17 |
| W3 | 4,530 | 5,290 | 1.17 |

A **stable ratio** is the signal you want. It means both tools are seeing the same reality and simply counting differently — usually ad-blocker recovery on the self-hosted side. A ratio that swings week to week means something is genuinely misconfigured: a missing script on some templates, a SPA route change not firing, or a tag firing twice.

## Common migration mistakes

- **Removing GA4 on day one.** Without an overlap you have no way to tell a tracking bug from a real traffic change.
- **Not tagging the script on every template.** Blog, docs, checkout, and error pages are the ones people forget. Crawl your own sitemap and confirm the script is present on each.
- **Ignoring SPA route changes.** If your app is client-routed, confirm virtual pageviews fire on navigation, not just first load.
- **Forgetting server-side events.** Purchases and signups should fire from your backend where they cannot be blocked or double-fired.
- **Comparing bounce rate across tools.** GA4's definition is engagement-based and not comparable — see [bounce rate explained](/blog/bounce-rate-explained).

## Migration checklist

- [ ] Install new analytics alongside GA4
- [ ] Verify pageviews and events are recording
- [ ] Recreate key reports and goals
- [ ] Compare trends for 1–2 weeks
- [ ] Remove GA4 + cookie banner
- [ ] Enjoy owning your data

Related: [what cookieless tracking actually measures](/blog/cookieless-analytics-explained) and [how metric definitions differ between tools](/blog/website-analytics-metrics-explained). Want a low-risk way to evaluate first? Explore the InsightsTrack live demo before you touch your site.
`,
    },
    {
        slug: 'core-web-vitals-monitoring-guide',
        title: 'Monitoring Core Web Vitals (LCP, CLS, INP) From Your Own Analytics',
        description:
            'Learn what Core Web Vitals are, the thresholds Google uses, and how to monitor LCP, CLS, and INP from real users with self-hosted, privacy-first analytics.',
        keyword: 'core web vitals monitoring',
        date: '2026-06-29',
        readingMinutes: 7,
        tags: ["Metrics","Performance"],
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

## What the tracking script actually sends

Each metric arrives as a small event tied to the page and session, so you can slice performance the same way you slice traffic:

\`\`\`json
{
  "event": "web_vital",
  "properties": {
    "name": "LCP",
    "value": 2140,
    "rating": "good",
    "path": "/pricing",
    "device_type": "mobile",
    "connection": "4g"
  }
}
\`\`\`

Two details make this data trustworthy. Metrics are reported **on page hide**, not on load — LCP and CLS can both change right up until the user leaves, so reporting early understates them. And they are sent with \`navigator.sendBeacon\` so the report survives the page being torn down, which is exactly the moment these values become final.

## Querying your own Web Vitals

Because the metrics land in the same event table as everything else, p75 by page is one query:

\`\`\`sql
SELECT path,
       count(*) AS samples,
       round(quantile_cont(value, 0.75)) AS p75_lcp
FROM events
WHERE event_name = 'web_vital'
  AND properties->>'name' = 'LCP'
  AND device_type = 'mobile'
  AND timestamp >= current_date - 28
GROUP BY path
HAVING count(*) > 100
ORDER BY p75_lcp DESC
LIMIT 20;
\`\`\`

The \`HAVING\` clause is not optional. A p75 computed from nine samples is noise, and it will sort straight to the top of your "worst pages" list. See [12 SQL queries every dashboard needs](/blog/sql-queries-for-web-analytics) for more in this shape.

## Reading the numbers: use p75, not averages

Google scores Web Vitals at the **75th percentile** of your traffic. Averages hide your slowest 25% of users (often mobile / slow networks). Always look at **p75**: "75% of my users had an LCP under X." InsightsTrack's Performance page scores each metric Good / Needs-Improvement / Poor against Google's thresholds at p75.

## Turning metrics into fixes

- **High LCP?** Optimize your largest image/hero, preload critical assets, reduce server TTFB.
- **High CLS?** Set explicit width/height on images and embeds; avoid injecting content above existing content.
- **High INP?** Break up long JavaScript tasks, defer non-critical work, avoid heavy event handlers.

## Catching regressions after a deploy

The reason to keep Web Vitals next to your traffic data is that it turns a vague question into a dated one. Plot p75 LCP by day and mark your deploys; a regression shows up as a step change, not a slow drift.

\`\`\`sql
SELECT timestamp::DATE AS day,
       round(quantile_cont(value, 0.75)) AS p75_lcp,
       count(*) AS samples
FROM events
WHERE event_name = 'web_vital' AND properties->>'name' = 'LCP'
  AND timestamp >= current_date - 60
GROUP BY 1 ORDER BY 1;
\`\`\`

Watch for the pattern where p75 LCP degrades and **conversion on the same pages drops a day later**. That correlation is the argument that gets performance work prioritised, and you can only make it when both numbers live in the same place. [Funnel analysis](/blog/funnel-analysis-guide) is where to look next when it happens.

## Field data will disagree with Lighthouse

Expect it, and do not treat it as a bug:

- **Lighthouse is one run** on one simulated device and network. Your field p75 spans real phones on real connections.
- **Lighthouse cannot see** logged-in pages, personalised content, or third-party scripts that only load in production.
- **Google ranks on field data** (CrUX), not lab data.

Use Lighthouse to *diagnose* a page you already know is slow from field data. Use field data to decide which page that is.

## Why monitor it from your own analytics

Monitoring Web Vitals inside the same tool you already use for traffic means you can correlate performance with behaviour: did a deploy regress LCP? Did a slow page hurt conversions? And because it is self-hosted and cookieless, you collect this real-user data without sending anything to a third party.

See live Core Web Vitals (LCP, CLS, INP, TTFB) scored against Google's thresholds in the InsightsTrack demo. Related: [which metrics actually matter](/blog/website-analytics-metrics-explained) and [reading bounce rate correctly](/blog/bounce-rate-explained).
`,
    },
    {
        slug: 'duckdb-vs-clickhouse-vs-postgres-analytics',
        title: 'DuckDB vs ClickHouse vs PostgreSQL for Analytics: How to Choose',
        description:
            'A practical comparison of DuckDB, ClickHouse, and PostgreSQL for analytical workloads — operational cost, query shape, concurrency, and when each one is the right call.',
        keyword: 'duckdb vs clickhouse',
        date: '2026-07-02',
        readingMinutes: 4,
        tags: ["DuckDB","Architecture"],
        body: `
## The question behind the question

"Which database should I use for analytics?" is usually really three questions: how much data do I have, how many concurrent readers, and how much operational work am I willing to take on. Answer those and the choice mostly makes itself.

## PostgreSQL: the default that is often enough

PostgreSQL is a row store. It reads whole rows off disk, which is perfect for \`SELECT * FROM events WHERE id = 42\` and wasteful for \`SELECT country, count(*) FROM events GROUP BY country\` over 20 million rows — that query touches two columns but pays for all thirty.

Postgres is still the right answer when:

- Your event table fits comfortably in a few million rows.
- You already run Postgres and do not want a second system.
- Your dashboards are heavily filtered (a day at a time, one site at a time) so indexes do the heavy lifting.

Extensions change the calculus. \`pg_stat_statements\` will tell you which aggregations hurt, and columnar extensions exist — but at that point you are adopting a second storage engine anyway.

## DuckDB: columnar without the server

DuckDB is an **embedded** columnar engine — the analytics equivalent of SQLite. It runs inside your application process, reads and writes a single file, and needs no daemon, no cluster, and no configuration.

For a dashboard workload it is a remarkably good fit:

- **Vectorized columnar execution.** A \`GROUP BY country\` reads the country column and nothing else.
- **Zero operations.** No service to monitor, restart, or upgrade separately from your app.
- **Reads Parquet natively.** You can keep cold history as files and query it in place.

Its constraint is the flip side of its strength: it is a single process. One writer, and readers share the host's CPU and RAM with your application. That is fine for a self-hosted analytics dashboard where a handful of people query at once. It is not a multi-tenant query service for hundreds of concurrent analysts.

## ClickHouse: built for scale, priced in operations

ClickHouse is a distributed columnar database designed for very large event volumes and high read concurrency. It has excellent compression, materialized views that maintain rollups on insert, and a mature sharding/replication story.

The cost is real: it is a service you run. Cluster sizing, replication topology, merge tuning, schema migrations that behave differently from Postgres, and a query dialect with its own sharp edges. That is a reasonable trade when you are ingesting billions of rows — and heavy overhead when you are ingesting a few million.

## Side by side

| | PostgreSQL | DuckDB | ClickHouse |
|---|---|---|---|
| Storage model | Row | Columnar | Columnar |
| Deployment | Server | Embedded (in-process) | Server / cluster |
| Ops burden | Moderate | Effectively none | High |
| Concurrent readers | High | Low–moderate | Very high |
| Good at wide aggregations | No | Yes | Yes |
| Good at single-row lookups | Yes | Adequate | Weak |
| Natural ceiling | Millions of rows | Hundreds of millions on one node | Billions+ |

## Why InsightsTrack uses Postgres *and* DuckDB

Analytics has two workloads with opposite shapes. Writes are single-row, frequent, and must be durable — that is Postgres. Reads are wide aggregations over date ranges — that is DuckDB. Trying to serve both from one engine means one of them is always compromised.

So writes land in PostgreSQL, a background job syncs new rows into DuckDB, and every dashboard query reads from DuckDB — see the [full architecture](/blog/postgres-duckdb-analytics-architecture) and the [sync implementation](/blog/incremental-sync-postgres-to-duckdb). You get transactional durability and columnar read speed without running a data warehouse.

## A decision rule

- Under ~5 million events, dashboards feel fine, and you already run Postgres: **stay on Postgres**, add indexes.
- Self-hosted product, single node, aggregations feel slow: **add DuckDB as a read layer**.
- Billions of events, many concurrent analysts, a team to operate it: **ClickHouse**.

If you want the underlying mechanics, read [columnar vs row storage](/blog/columnar-vs-row-storage-explained). The mistake is reaching for the third option while you are still living in the first. Pick the smallest system that comfortably serves your query shape, and revisit when the numbers actually change.
`,
    },
    {
        slug: 'duckdb-parquet-cold-storage',
        title: 'DuckDB + Parquet: Cheap Cold Storage for Analytics Data',
        description:
            'How to tier analytics data between a hot DuckDB table and cold Parquet files on S3 or R2, and stitch them into one queryable view with UNION ALL.',
        keyword: 'duckdb parquet s3',
        date: '2026-07-04',
        readingMinutes: 4,
        tags: ["DuckDB","Architecture"],
        body: `
## The cost curve nobody plans for

Event data grows linearly and gets read logarithmically. Yesterday's pageviews are queried constantly; the same rows from fourteen months ago are queried once a quarter, if that. Keeping both in the same hot storage means paying hot prices for cold data forever.

The fix is tiering: keep recent data in a fast local table, push older data to compressed files, and make the split invisible to queries.

## Why Parquet is the right cold format

Parquet is a columnar file format with per-column compression and embedded statistics. Two properties matter here:

- **Compression.** Event data has low-cardinality columns — country, browser, path — that compress extremely well. 5–10× reduction over raw rows is typical.
- **Predicate pushdown.** Each row group stores min/max per column. A query filtered to March skips every row group whose timestamp range does not overlap March, without decompressing it.

DuckDB reads Parquet natively, including over HTTP and S3-compatible object storage.

## Exporting cold partitions

Export by month so each file is a natural pruning unit:

\`\`\`sql
COPY (
  SELECT * FROM events
  WHERE timestamp >= DATE '2026-01-01'
    AND timestamp <  DATE '2026-02-01'
)
TO 'cold/events_2026_01.parquet'
(FORMAT PARQUET, COMPRESSION ZSTD);
\`\`\`

Or let DuckDB write a partitioned directory tree in one statement:

\`\`\`sql
COPY (
  SELECT *, year(timestamp) AS y, month(timestamp) AS m
  FROM events WHERE timestamp < current_date - INTERVAL 30 DAY
)
TO 'cold/events'
(FORMAT PARQUET, PARTITION_BY (y, m), COMPRESSION ZSTD);
\`\`\`

Hive-style partitioning means a query filtered on a date range only opens the directories it needs.

## Querying object storage directly

DuckDB's httpfs extension reads S3, Cloudflare R2, and any S3-compatible endpoint:

\`\`\`sql
INSTALL httpfs; LOAD httpfs;
SET s3_endpoint = 'ACCOUNT.r2.cloudflarestorage.com';
SET s3_access_key_id = '...';
SET s3_secret_access_key = '...';

SELECT count(*) FROM read_parquet('s3://analytics/cold/events/*/*/*.parquet');
\`\`\`

R2 is a common choice for this because it does not charge egress, which matters when a query scans historical files.

## Stitching hot and cold into one view

The important part: queries should not know about the tiering.

\`\`\`sql
CREATE OR REPLACE VIEW events AS
  SELECT * FROM events_hot
  UNION ALL
  SELECT * FROM read_parquet('s3://analytics/cold/events/**/*.parquet');
\`\`\`

Now \`SELECT count(*) FROM events WHERE timestamp > current_date - 7\` reads only the hot table — DuckDB prunes the cold side on the timestamp predicate — while a two-year trend query transparently spans both.

Two rules keep this correct:

1. **The tiers must not overlap.** Export a window, verify the file, then delete from hot inside a transaction. An overlap double-counts every metric.
2. **Schemas must match exactly**, column order included. Adding a column means either rewriting old files or using \`union_by_name = true\` in \`read_parquet\`.

## What this looks like in practice

InsightsTrack's v2 storage layer runs exactly this shape: the last 30 days in a DuckDB hot table, older months exported to Parquet on S3 or R2, and a \`UNION ALL\` view named \`events\` that every analytics query reads from. Dashboards stay fast on recent windows, historical queries still work, and storage cost stops tracking data volume linearly.

## When not to bother

If your entire dataset is under a few gigabytes, skip this. A single DuckDB file handles it, and tiering only adds failure modes. Reach for it when cold data is meaningfully larger than hot, or when object storage is genuinely cheaper than the disk you are paying for. See also [running a warehouse on one server](/blog/analytics-data-warehouse-on-a-budget) and [DuckDB performance tuning](/blog/duckdb-query-optimization-tips).
`,
    },
    {
        slug: 'star-schema-for-web-analytics',
        title: 'Designing a Star Schema for Web Analytics Data',
        description:
            'How to model pageviews, sessions, and events as facts and dimensions — grain, surrogate keys, slowly changing dimensions, and where to denormalize for a columnar engine.',
        keyword: 'star schema web analytics',
        date: '2026-07-06',
        readingMinutes: 10,
        tags: ["Data Modeling","SQL"],
        body: `
## Why schema design still matters in a columnar world

Columnar engines are fast enough that people skip modelling entirely and dump everything into one wide table. That works until you need to answer a question the table cannot express — "what was this page's title *at the time* it was viewed?" — or until every query re-derives the same joins.

A star schema gives you a shared vocabulary: **facts** are things that happened, **dimensions** are the things they happened to.

## Start with the grain

The grain is the single most important decision: what does one row in the fact table represent? Get it wrong and every metric downstream is subtly incorrect.

For web analytics there are usually three fact tables at three grains:

- \`fact_pageview\` — one row per pageview
- \`fact_session\` — one row per session (derived)
- \`fact_event\` — one row per custom event (click, signup, purchase)

Resist the urge to fold sessions into pageviews. "Bounce rate" is a session-grain metric; computing it from a pageview table means a \`count(distinct)\` gymnastics routine in every query.

## The dimensions

\`\`\`sql
CREATE TABLE dim_page (
  page_key    BIGINT PRIMARY KEY,
  site_id     INTEGER NOT NULL,
  path        VARCHAR NOT NULL,
  title       VARCHAR,
  section     VARCHAR,
  valid_from  TIMESTAMP NOT NULL,
  valid_to    TIMESTAMP,
  is_current  BOOLEAN NOT NULL
);

CREATE TABLE dim_device (
  device_key  BIGINT PRIMARY KEY,
  browser     VARCHAR,
  browser_ver VARCHAR,
  os          VARCHAR,
  device_type VARCHAR,   -- desktop | mobile | tablet
  is_bot      BOOLEAN
);

CREATE TABLE dim_geo (
  geo_key     BIGINT PRIMARY KEY,
  country     VARCHAR,
  region      VARCHAR,
  timezone    VARCHAR
);

CREATE TABLE dim_source (
  source_key   BIGINT PRIMARY KEY,
  referrer_host VARCHAR,
  channel       VARCHAR,  -- direct | organic | social | referral | paid
  utm_source    VARCHAR,
  utm_medium    VARCHAR,
  utm_campaign  VARCHAR
);
\`\`\`

And the fact:

\`\`\`sql
CREATE TABLE fact_pageview (
  pageview_id   BIGINT PRIMARY KEY,
  date_key      INTEGER NOT NULL,     -- 20260706
  timestamp     TIMESTAMP NOT NULL,
  site_id       INTEGER NOT NULL,
  visitor_key   BIGINT NOT NULL,
  session_id    BIGINT NOT NULL,
  page_key      BIGINT NOT NULL,
  device_key    BIGINT NOT NULL,
  geo_key       BIGINT NOT NULL,
  source_key    BIGINT NOT NULL,
  duration_ms   INTEGER,              -- measures
  scroll_pct    SMALLINT
);
\`\`\`

Facts hold keys and measures. Nothing else. If you find yourself adding a descriptive string to a fact table, it belongs in a dimension. Naming the events that feed these tables is its own discipline — see [event schema design](/blog/event-schema-design-analytics).

## Why a date dimension earns its keep

\`\`\`sql
CREATE TABLE dim_date (
  date_key    INTEGER PRIMARY KEY,   -- 20260706
  date        DATE,
  day_of_week SMALLINT,
  week_of_year SMALLINT,
  month       SMALLINT,
  quarter     SMALLINT,
  year        SMALLINT,
  is_weekend  BOOLEAN,
  is_holiday  BOOLEAN
);
\`\`\`

It looks redundant next to a timestamp column, but it lets you answer "weekday vs weekend conversion" or "fiscal quarter" with a join instead of a pile of date arithmetic — and it makes the fiscal calendar a data problem rather than a code problem.

## Slowly changing dimensions

When a page's title changes, do you want old pageviews to show the old title or the new one?

- **Type 1** — overwrite. Simple, loses history. Fine for correcting a typo in a browser name.
- **Type 2** — new row with \`valid_from\` / \`valid_to\` and a new surrogate key. History preserved. This is why \`dim_page\` above has validity columns.

Type 2 is why facts reference a surrogate \`page_key\` rather than the path string: the key pins the row to the version of the page that existed at that moment.

## Where to denormalize for DuckDB

Textbook star schemas assume join cost matters. On a columnar engine, small dimension joins are cheap — but not free, and they add query complexity.

Practical compromise: keep the star as the model of record, and materialize a **wide view** for the dashboard.

\`\`\`sql
CREATE OR REPLACE VIEW v_pageview_wide AS
SELECT f.timestamp, f.site_id, f.session_id, f.visitor_key,
       p.path, p.title, d.browser, d.device_type,
       g.country, s.channel, s.utm_source,
       f.duration_ms, f.scroll_pct
FROM fact_pageview f
JOIN dim_page   p USING (page_key)
JOIN dim_device d USING (device_key)
JOIN dim_geo    g USING (geo_key)
JOIN dim_source s USING (source_key);
\`\`\`

Dashboard queries hit the view. Because DuckDB pushes projections down, selecting three columns from the view does not materialize all twenty.

## Deriving the session fact

Sessions are computed, not tracked. A standard 30-minute inactivity rule:

\`\`\`sql
CREATE OR REPLACE TABLE fact_session AS
WITH marked AS (
  SELECT visitor_key, timestamp, page_key, source_key,
         CASE WHEN timestamp - lag(timestamp) OVER w > INTERVAL 30 MINUTE
                OR lag(timestamp) OVER w IS NULL
              THEN 1 ELSE 0 END AS is_new
  FROM fact_pageview
  WINDOW w AS (PARTITION BY visitor_key ORDER BY timestamp)
),
grouped AS (
  SELECT *, sum(is_new) OVER (PARTITION BY visitor_key ORDER BY timestamp) AS sess_num
  FROM marked
)
SELECT visitor_key, sess_num,
       min(timestamp) AS started_at,
       max(timestamp) AS ended_at,
       count(*)       AS pageviews,
       count(*) = 1   AS is_bounce
FROM grouped
GROUP BY visitor_key, sess_num;
\`\`\`

Now bounce rate is \`avg(is_bounce)\` — one column, no subquery. The [window-function guide](/blog/sql-window-functions-sessionization) covers this sessionization pattern in depth.

## Rules that keep the model honest

1. **One grain per fact table**, declared in a comment at the top of the DDL.
2. **Facts contain keys and numbers only.**
3. **Every dimension gets a surrogate key**, never a natural key like a URL string.
4. **Add an "unknown" row** (key \`-1\`) to every dimension so facts never carry NULL keys.
5. **Additive measures where possible.** Ratios like bounce rate are computed at query time from additive parts, never stored pre-divided — averaging averages is how dashboards start lying.
`,
    },
    {
        slug: 'columnar-vs-row-storage-explained',
        title: 'Columnar vs Row Storage: Why OLAP Queries Get 100× Faster',
        description:
            'A from-first-principles explanation of columnar storage — how data layout, compression, and vectorized execution combine to make analytical queries dramatically faster.',
        keyword: 'columnar vs row storage',
        date: '2026-07-08',
        readingMinutes: 3,
        tags: ["DuckDB","Architecture"],
        body: `
## The same data, two layouts

Consider a table of pageviews with thirty columns and ten million rows. A **row store** writes each record contiguously:

\`\`\`
[id=1, ts=…, path=/home, country=IN, browser=Chrome, …30 fields]
[id=2, ts=…, path=/blog, country=US, browser=Safari, …30 fields]
\`\`\`

A **column store** writes each column contiguously:

\`\`\`
id:      [1, 2, 3, 4, …]
ts:      [1719…, 1719…, …]
country: [IN, US, US, IN, …]
browser: [Chrome, Safari, Safari, …]
\`\`\`

Identical information. The layout is the entire difference.

## Why layout decides the winner

Now run \`SELECT country, count(*) FROM pageviews GROUP BY country\`.

The row store must read every row to reach the country field in each — thirty columns' worth of bytes to use one. If a row is 300 bytes and only 8 of them matter, you have read 37× more data than the query needs.

The column store reads the country column and nothing else. Same answer, a fraction of the I/O. That is the bulk of the speedup, and it comes from nothing cleverer than not reading bytes you did not ask for.

## Compression compounds it

Sorted, homogeneous data compresses far better than mixed rows. A country column is a handful of distinct values repeated millions of times:

- **Dictionary encoding** — store \`['IN','US','GB']\` once, then indexes into it.
- **Run-length encoding** — \`IN × 40,000\` instead of forty thousand copies.
- **Bit packing** — a column with 200 distinct values needs 8 bits per value, not 64.

A country column that is 80 MB raw is often under 2 MB encoded. That is 2 MB moving from disk to memory instead of 300 MB of full rows — and it frequently means the working set fits in cache.

## Vectorized execution

The third multiplier is how the data is processed. Row engines typically evaluate one row at a time through the operator tree: a function call per row, per operator, with branch mispredictions throughout.

Columnar engines process **vectors** — batches of a few thousand values from one column — in tight loops over contiguous, uniformly typed memory. That is exactly what CPUs and SIMD instructions are built for. One function call amortized over 2,048 values instead of 2,048 calls.

Layout, compression, and vectorization stack. Together they explain order-of-magnitude differences, not a 20% edge.

## Where row stores still win

Columnar is not universally better. It loses badly at:

- **Single-row lookups.** \`SELECT * FROM users WHERE id = 42\` in a column store means touching every column's storage separately to reassemble one row. A row store fetches one contiguous block.
- **Frequent single-row updates.** Changing one field means rewriting a compressed block. Column stores generally prefer append-only or batch rewrite.
- **Transactional workloads.** Row-level locking, foreign keys, high-concurrency writes — this is what OLTP engines are built for.

This is the whole reason "just use one database" is an unsatisfying answer for analytics.

## The practical consequence

Serving a dashboard from a transactional row store means paying for full-row reads on every aggregation. Serving your application from a column store means paying for column reassembly on every lookup.

InsightsTrack keeps them separate: PostgreSQL takes the writes — single-row, transactional, durable — and a [sync feeds DuckDB](/blog/incremental-sync-postgres-to-duckdb), which serves every read. The [architecture deep-dive](/blog/postgres-duckdb-analytics-architecture) covers the full design. Each engine runs the workload its layout was designed for.

## Recognizing the symptom

If your dashboard queries scan large fractions of a table, touch a handful of columns out of many, aggregate rather than fetch, and get slower as data grows despite indexes — that is a storage-layout problem. More indexes will not fix it. Indexes help you find *rows*; the problem is that you are reading whole rows to use two fields.
`,
    },
    {
        slug: 'duckdb-nodejs-guide',
        title: 'Using DuckDB in Node.js: A Practical Guide',
        description:
            'How to run DuckDB inside a Node.js service — connection handling, parameterized queries, bulk inserts, Parquet, and the mistakes that cause corruption or leaks.',
        keyword: 'duckdb nodejs',
        date: '2026-07-10',
        readingMinutes: 7,
        tags: ["DuckDB"],
        body: `
## Why run DuckDB in your app process

DuckDB is embedded: no server, no port, no credentials. You get a columnar analytical engine as a library dependency, which is why it is such a natural fit for self-hosted tools where "run another service" is a real cost for every user.

## Installing and opening a database

\`\`\`bash
npm install @duckdb/node-api
\`\`\`

\`\`\`js
import { DuckDBInstance } from '@duckdb/node-api';

const instance = await DuckDBInstance.create('./analytics.duckdb', {
    threads: '4',
    memory_limit: '2GB',
});
const connection = await instance.connect();
\`\`\`

Passing a file path persists the database; passing \`':memory:'\` keeps it ephemeral. For an analytics read layer that is rebuilt from Postgres, in-memory is a legitimate option — but startup then costs a full re-sync.

## Connection model: one instance, pooled connections

The rule that saves the most pain: **one \`DuckDBInstance\` per process, per file.** Opening the same file twice from the same process — or from two processes — invites lock errors and, in the worst case, corruption.

Connections are cheap and are the unit of concurrency:

\`\`\`js
class Db {
    #instance;
    async init(path) {
        this.#instance = await DuckDBInstance.create(path);
    }
    async query(sql, params = []) {
        const conn = await this.#instance.connect();
        try {
            const reader = await conn.runAndReadAll(sql, params);
            return reader.getRowObjects();
        } finally {
            conn.closeSync();
        }
    }
}
export const db = new Db();
\`\`\`

The \`finally\` block matters. A connection leaked on an error path holds resources for the life of the process, and under load you will hit the limit during exactly the incident you are trying to debug.

## Parameterized queries, always

DuckDB uses positional \`?\` placeholders:

\`\`\`js
const rows = await db.query(
    \`SELECT country, count(*) AS views
       FROM events
      WHERE site_id = ? AND timestamp >= ? AND timestamp < ?
      GROUP BY country
      ORDER BY views DESC
      LIMIT 20\`,
    [siteId, from, to]
);
\`\`\`

Never build SQL with template literals or concatenation, even for values you believe are safe. Interpolating a "trusted" internal ID is how injection bugs get introduced two refactors later, when that ID starts coming from a query string.

Identifiers cannot be parameterized. If a column or table name must be dynamic, validate it against an allowlist:

\`\`\`js
const SORTABLE = new Set(['views', 'visitors', 'bounce_rate']);
if (!SORTABLE.has(sortColumn)) throw new Error('Invalid sort column');
const sql = \`SELECT … ORDER BY \${sortColumn} DESC\`;  // safe: allowlisted
\`\`\`

## Bulk inserts: batch or suffer

Inserting rows one at a time is the single most common DuckDB performance mistake. Each statement pays fixed overhead, and a column store is optimized for batch appends.

\`\`\`js
async function insertBatch(conn, rows) {
    if (!rows.length) return;
    const cols = 6;
    const placeholders = rows.map(() => \`(\${Array(cols).fill('?').join(',')})\`).join(',');
    const values = rows.flatMap(r => [r.id, r.siteId, r.ts, r.path, r.country, r.browser]);
    await conn.run(
        \`INSERT INTO events (id, site_id, timestamp, path, country, browser) VALUES \${placeholders}\`,
        values
    );
}
\`\`\`

The placeholder string is generated from the row *count*, not from row content — no user data reaches the SQL text. Batches of 1,000–5,000 rows are a good default.

For very large loads, skip the driver entirely and let DuckDB read the file:

\`\`\`sql
INSERT INTO events SELECT * FROM read_parquet('dump.parquet');
INSERT INTO events SELECT * FROM read_csv_auto('dump.csv');
\`\`\`

## Type conversions that surprise people

- **BIGINT arrives as a JavaScript \`BigInt\`.** \`count(*)\` returns \`42n\`, and \`JSON.stringify\` throws on it. Cast in SQL (\`count(*)::INTEGER\`) or convert explicitly (\`Number(v)\`) before serializing.
- **TIMESTAMP** comes back as a DuckDB timestamp object; call its conversion method rather than assuming a JS \`Date\`.
- **DECIMAL** is not a JS number. Cast to \`DOUBLE\` in the query if you want floats.

Normalizing these at the data-access boundary — one \`toPlain(row)\` helper — keeps BigInt surprises out of your route handlers.

## Reading Parquet and CSV in place

No import step needed:

\`\`\`js
await db.query(\`SELECT count(*) FROM read_parquet('archive/*.parquet')\`);
await db.query(\`SELECT * FROM read_csv_auto('report.csv') LIMIT 10\`);
\`\`\`

This is what makes [hot/cold tiering](/blog/duckdb-parquet-cold-storage) practical: cold data stays as files and is still queryable.

## A checklist

1. One \`DuckDBInstance\` per file per process.
2. Always close connections in \`finally\`.
3. Parameterize values; allowlist identifiers.
4. Batch inserts; never one row per statement.
5. Normalize BigInt and timestamps before they reach JSON.
6. Set \`memory_limit\` explicitly — the default may exceed your container's limit.
7. Wrap multi-statement work in \`BEGIN\` / \`COMMIT\` so a crash cannot leave a half-written table.
`,
    },
    {
        slug: 'incremental-sync-postgres-to-duckdb',
        title: 'Building an Incremental Sync from PostgreSQL to DuckDB',
        description:
            'How to stream new rows from PostgreSQL into DuckDB without duplicates or gaps — keyset cursors, batch checkpointing, backfills, and idempotent restarts.',
        keyword: 'postgres to duckdb sync',
        date: '2026-07-12',
        readingMinutes: 6,
        tags: ["DuckDB","Architecture"],
        body: `
## The job

You have a transactional table in PostgreSQL that grows constantly, and an analytical copy in DuckDB that dashboards read. Something has to move new rows from one to the other, continuously, and survive being killed halfway through.

That "survive being killed" clause is where most naive implementations fall apart.

## The timestamp cursor and why it leaks rows

The obvious approach:

\`\`\`sql
SELECT * FROM events WHERE created_at > $1 ORDER BY created_at;
\`\`\`

Two failure modes, both silent:

**Ties at the boundary.** If 400 rows share the timestamp \`12:00:00.000\` and your batch cuts through them, the next run asks for \`> 12:00:00.000\` and skips the remainder. You lose rows and nothing errors.

**Clock and commit-order skew.** \`created_at\` is set when the row is *built*, but the row becomes visible when the transaction *commits*. A long transaction can commit a row with an older timestamp after your cursor has moved past it. Gone.

## Keyset pagination on a monotonic id

Page on the primary key instead:

\`\`\`sql
SELECT id, site_id, timestamp, path, country, browser
  FROM events
 WHERE id > $1
 ORDER BY id
 LIMIT $2;
\`\`\`

A \`BIGSERIAL\` id is unique and totally ordered, so there are no ties to straddle. Each batch's last id becomes the next batch's cursor. It is also index-friendly — no \`OFFSET\` scan that degrades as the table grows.

\`\`\`js
async function syncBatch(pg, duck, state) {
    const { rows } = await pg.query(
        \`SELECT id, site_id, timestamp, path, country, browser
           FROM events WHERE id > $1 ORDER BY id LIMIT $2\`,
        [state.lastId, BATCH_SIZE]
    );
    if (rows.length === 0) return 0;

    await duck.run('BEGIN');
    try {
        await insertBatch(duck, rows);
        await duck.run(
            'UPDATE sync_state SET last_id = ?, updated_at = now() WHERE source = ?',
            [rows[rows.length - 1].id, 'events']
        );
        await duck.run('COMMIT');
    } catch (err) {
        await duck.run('ROLLBACK');
        throw err;
    }
    return rows.length;
}
\`\`\`

## Checkpoint inside the same transaction

This is the detail that makes restarts safe. The cursor update and the row insert commit **together**, in DuckDB. Either both happened or neither did.

Update the cursor only at the end of a full sync run and a crash re-copies everything since the last successful run — duplicates, and every metric inflated. Update it before inserting and a crash loses the batch entirely.

Because the checkpoint lives in the destination, the sync is idempotent under restart: it always resumes from the last row DuckDB actually has.

## Handling updates and deletes

The keyset cursor only sees inserts. If rows can change after insert, you need a second pass.

For an append-mostly analytics table, the pragmatic answer is a bounded reconciliation window: rows older than, say, 48 hours are treated as immutable; anything newer is re-checked on a slower cycle.

\`\`\`sql
-- reconcile recent mutable rows
SELECT id, … FROM events
 WHERE updated_at > now() - INTERVAL '48 hours';
\`\`\`

Then upsert into DuckDB by deleting the id range and re-inserting, inside one transaction. For hard deletes, either soft-delete in Postgres (a \`deleted_at\` column the sync can see) or periodically reconcile id sets for the recent window. A hard \`DELETE\` in Postgres is invisible to any cursor-based sync — there is no row left to observe.

## Backfilling without blocking live sync

Initial load of an existing table should not run through the same small-batch path. Export and bulk-load instead:

\`\`\`sql
-- in Postgres
COPY (SELECT * FROM events ORDER BY id) TO '/tmp/events.csv' CSV HEADER;
\`\`\`

\`\`\`sql
-- in DuckDB
INSERT INTO events SELECT * FROM read_csv_auto('/tmp/events.csv');
\`\`\`

Then set \`last_id\` to the max id in the export and start the incremental loop. DuckDB can also read from Postgres directly via its \`postgres\` extension, which skips the file entirely for moderate volumes.

## Operational details that matter

- **Batch size.** 1,000–10,000 rows. Larger batches amortize overhead; too large and a failure re-does more work and holds memory.
- **Adaptive polling.** Sleep longer when a batch comes back empty, shorter when it comes back full. Constant 1-second polling on an idle table is pure waste.
- **Single writer.** DuckDB allows one writer. Guard the sync with a lock so two instances cannot run concurrently.
- **Lag as a health metric.** Track \`max(id)\` in Postgres minus \`last_id\` in DuckDB. Growing lag is the earliest signal that sync is failing, and it is far more useful than "the process is running."
- **Log rows-per-second per batch.** When sync slows down, you want to know whether it is the read side or the write side before you start guessing.

## What good looks like

A correct sync has three properties, and you should be able to state why each holds:

1. **No gaps** — the cursor is on a unique, monotonic key, so nothing falls between batches.
2. **No duplicates** — the cursor advances in the same transaction as the insert.
3. **Resumable** — killing the process at any instant and restarting produces the same final state.

InsightsTrack's sync engine is built on exactly this: keyset cursor on the event id, per-batch checkpointing in DuckDB, bulk multi-row inserts, and a lag metric on the dashboard. See the [architecture overview](/blog/postgres-duckdb-analytics-architecture) for how it fits together, and the [Node.js guide](/blog/duckdb-nodejs-guide) for the driver details.
`,
    },
    {
        slug: 'event-schema-design-analytics',
        title: 'Event Schema Design: Naming, Properties, and Avoiding Analytics Debt',
        description:
            'How to design an analytics event taxonomy that survives three years — naming conventions, property design, versioning, and the anti-patterns that make data unqueryable.',
        keyword: 'analytics event schema design',
        date: '2026-07-14',
        readingMinutes: 7,
        tags: ["Data Modeling"],
        body: `
## Analytics debt is worse than technical debt

Bad code can be refactored. Bad event data cannot — you cannot retroactively fix eighteen months of events named \`button_click_2\`. Whatever taxonomy you ship is the taxonomy you analyze for as long as that history matters.

The good news is that most of the value comes from a handful of decisions made once.

## Name events object-action, in the past tense

Pick one convention and never deviate:

\`\`\`
object_action     signup_completed, checkout_started, video_played
\`\`\`

Object first, because it sorts usefully. In an alphabetical list of 200 events, \`checkout_started\` / \`checkout_completed\` / \`checkout_abandoned\` cluster together, while \`started_checkout\` / \`completed_checkout\` scatter across the alphabet.

Past tense, because an event is a record of something that already happened. \`signup_completed\`, not \`complete_signup\`.

Rules that prevent 90% of taxonomy rot:

- **snake_case everywhere.** Mixing \`SignupCompleted\` and \`signup_completed\` gives you two events for one thing.
- **No IDs in event names.** \`product_viewed\` with a \`product_id\` property, never \`product_1234_viewed\`. Names are a low-cardinality dimension; the moment they carry identifiers, every grouping breaks.
- **No versions in names.** \`checkout_started_v2\` fragments a metric permanently.

## Properties carry the detail

The event name answers *what happened*. Properties answer everything else.

\`\`\`json
{
  "event": "checkout_completed",
  "properties": {
    "order_id": "ord_8813",
    "revenue": 149.00,
    "currency": "USD",
    "item_count": 3,
    "payment_method": "card",
    "coupon_applied": true,
    "checkout_variant": "one_page"
  }
}
\`\`\`

Design guidance:

- **Type-stable.** A property must always be the same type. \`revenue\` as \`149.00\` in one event and \`"149.00"\` in another will break aggregations, and columnar engines will either reject the row or widen the column to text.
- **Units in the name.** \`duration_ms\`, \`revenue_usd\`, \`file_size_bytes\`. "Is this seconds or milliseconds?" should never be a question someone has to answer by reading tracking code.
- **Booleans stay boolean.** Not \`"yes"\`/\`"no"\`, not \`1\`/\`0\`.
- **Watch cardinality.** A property with millions of distinct values (a full URL with query string, a raw user agent) is not a useful dimension. Store the parsed pieces.
- **Never put PII in properties.** Emails, names, and raw IPs in an event payload turn your analytics store into a system of record for personal data, with every obligation that implies.

## Storing flexible properties in a columnar engine

Events have a fixed core and a variable tail. The pragmatic layout promotes the columns you filter on constantly and keeps the rest as JSON:

\`\`\`sql
CREATE TABLE events (
  id          BIGINT PRIMARY KEY,
  site_id     INTEGER   NOT NULL,
  timestamp   TIMESTAMP NOT NULL,
  visitor_id  VARCHAR   NOT NULL,
  session_id  VARCHAR   NOT NULL,
  event_name  VARCHAR   NOT NULL,
  path        VARCHAR,
  properties  JSON
);
\`\`\`

DuckDB queries JSON directly:

\`\`\`sql
SELECT properties->>'payment_method' AS method,
       sum((properties->>'revenue')::DOUBLE) AS revenue
FROM events
WHERE event_name = 'checkout_completed'
  AND timestamp >= current_date - 30
GROUP BY method
ORDER BY revenue DESC;
\`\`\`

When a JSON property becomes hot — queried in most dashboard loads — promote it to a real column. Extracting from JSON on every row is meaningfully slower than reading a native typed column, and you lose the compression benefits of a low-cardinality column.

## Version the schema, not the event name

When \`checkout_completed\` needs to change shape, add a \`schema_version\` property rather than minting \`checkout_completed_v2\`:

\`\`\`json
{ "event": "checkout_completed", "properties": { "schema_version": 2, … } }
\`\`\`

The metric stays continuous. Queries that care about the difference can branch on the version; queries that just count checkouts keep working.

Additive changes — new optional properties — need no version bump at all. Reserve versioning for changes in meaning: a property that changed units, or a definition that shifted.

## Maintain a tracking plan

A tracking plan is a single document listing every event, its properties, their types, and who owns it. It can be a Markdown table in the repo. What matters is that it exists and that adding an event means editing it.

| Event | Property | Type | Required | Notes |
|---|---|---|---|---|
| checkout_completed | order_id | string | yes | Unique per order |
| checkout_completed | revenue | number | yes | Post-discount, excl. tax |
| checkout_completed | currency | string | yes | ISO 4217 |

Validate against it in CI if you can. Even an unvalidated plan prevents the most common failure: two engineers instrumenting the same action differently, six months apart.

## The anti-patterns, listed

- **The kitchen-sink event.** One \`user_action\` event with an \`action_type\` property. You have re-implemented event names, worse, and lost every tool's ability to reason about them.
- **Tracking everything.** 400 events nobody has ever queried is not thoroughness; it is noise that makes the 12 events that matter harder to find.
- **Client-side revenue.** Money events belong on the server, where they cannot be blocked, spoofed, or double-fired by a retry.
- **Renaming in place.** Renaming an event splits its history at the rename date. If you must, keep emitting both for a transition window.

## Start small

Ten well-defined events beat two hundred vague ones. Instrument the handful of actions tied to your actual goals, name them consistently, document them, and add more only when a specific question demands it. The taxonomy you can explain in one page is the one that survives. Related: [star-schema modelling](/blog/star-schema-for-web-analytics) and [privacy-first schema design](/blog/privacy-first-analytics-database-design).
`,
    },
    {
        slug: 'sql-window-functions-sessionization',
        title: 'SQL Window Functions for Sessionization and Funnel Analysis',
        description:
            'How to turn a raw event stream into sessions, paths, and funnels using LAG, SUM OVER, and gap-and-island techniques — with runnable DuckDB SQL.',
        keyword: 'sql sessionization window functions',
        date: '2026-07-16',
        readingMinutes: 10,
        tags: ["SQL","Metrics"],
        body: `
## Raw events are not sessions

A tracking script emits one row per pageview. Almost every question you actually care about — bounce rate, session duration, entry and exit pages, funnel conversion — is defined over *sessions*, which do not exist in the raw data. Window functions are how you construct them in SQL.

Assume this table throughout:

\`\`\`sql
CREATE TABLE events (
  visitor_id VARCHAR,
  timestamp  TIMESTAMP,
  path       VARCHAR,
  event_name VARCHAR
);
\`\`\`

## The gap-and-island pattern

Sessionization is a gap-and-island problem: find the gaps, and everything between them is an island.

**Step one — measure the gap to the previous event per visitor.**

\`\`\`sql
SELECT visitor_id, timestamp, path,
       timestamp - lag(timestamp) OVER (
           PARTITION BY visitor_id ORDER BY timestamp
       ) AS gap
FROM events;
\`\`\`

**Step two — flag rows that start a new session.** The first event for a visitor has a NULL gap, which also counts as a start.

\`\`\`sql
CASE WHEN gap > INTERVAL 30 MINUTE OR gap IS NULL THEN 1 ELSE 0 END AS is_session_start
\`\`\`

**Step three — running sum of the flag gives each session a number.**

\`\`\`sql
sum(is_session_start) OVER (
    PARTITION BY visitor_id ORDER BY timestamp
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
) AS session_num
\`\`\`

That running sum is the trick worth remembering: it only increments at boundaries, so every row inside an island shares a value.

Put together:

\`\`\`sql
WITH gaps AS (
  SELECT visitor_id, timestamp, path,
         CASE WHEN timestamp - lag(timestamp) OVER w > INTERVAL 30 MINUTE
                OR lag(timestamp) OVER w IS NULL
              THEN 1 ELSE 0 END AS is_start
  FROM events
  WINDOW w AS (PARTITION BY visitor_id ORDER BY timestamp)
),
sessions AS (
  SELECT *, sum(is_start) OVER (
             PARTITION BY visitor_id ORDER BY timestamp
             ROWS UNBOUNDED PRECEDING) AS session_num
  FROM gaps
)
SELECT visitor_id, session_num,
       min(timestamp) AS started_at,
       max(timestamp) AS ended_at,
       count(*)       AS pageviews
FROM sessions
GROUP BY visitor_id, session_num;
\`\`\`

## Entry pages, exit pages, and bounces

With sessions in hand, \`first_value\` and \`last_value\` give you entry and exit paths directly:

\`\`\`sql
SELECT visitor_id, session_num,
       first_value(path) OVER w AS entry_page,
       last_value(path)  OVER w AS exit_page,
       count(*)          OVER (PARTITION BY visitor_id, session_num) AS depth
FROM sessions
WINDOW w AS (
  PARTITION BY visitor_id, session_num ORDER BY timestamp
  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
);
\`\`\`

The explicit frame on \`last_value\` is not optional. The default frame is \`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`, so without it \`last_value\` returns the *current* row — one of the most common window-function bugs, and it fails silently.

Bounce rate is then a session-level average:

\`\`\`sql
SELECT round(100.0 * avg(CASE WHEN depth = 1 THEN 1 ELSE 0 END), 1) AS bounce_rate_pct
FROM session_summary;
\`\`\`

## Time on page

Time on page is the gap to the *next* event in the same session:

\`\`\`sql
SELECT path,
       median(seconds) AS median_seconds
FROM (
  SELECT path,
         epoch(lead(timestamp) OVER (
             PARTITION BY visitor_id, session_num ORDER BY timestamp
         ) - timestamp) AS seconds
  FROM sessions
)
WHERE seconds IS NOT NULL AND seconds < 1800
GROUP BY path;
\`\`\`

Two deliberate choices: the last page in each session has no next event, so its duration is unknowable — \`NULL\`, not zero. And use the **median**, because a handful of abandoned tabs will drag any mean into fiction.

## Funnels with ordered steps

A funnel asks: of the people who did step 1, how many went on to step 2, then step 3 — **in order**.

\`\`\`sql
WITH steps AS (
  SELECT visitor_id, session_num, timestamp,
         CASE path
           WHEN '/pricing'  THEN 1
           WHEN '/signup'   THEN 2
           WHEN '/checkout' THEN 3
           WHEN '/success'  THEN 4
         END AS step
  FROM sessions
  WHERE path IN ('/pricing','/signup','/checkout','/success')
),
progress AS (
  SELECT visitor_id, session_num,
         max(CASE WHEN step = 1 THEN 1 ELSE 0 END) AS s1,
         max(CASE WHEN step = 2 AND timestamp > min_ts_1 THEN 1 ELSE 0 END) AS s2
  FROM (
    SELECT *, min(CASE WHEN step = 1 THEN timestamp END)
                OVER (PARTITION BY visitor_id, session_num) AS min_ts_1
    FROM steps
  )
  GROUP BY visitor_id, session_num
)
SELECT sum(s1) AS reached_step_1,
       sum(s2) AS reached_step_2,
       round(100.0 * sum(s2) / nullif(sum(s1), 0), 1) AS step_1_to_2_pct
FROM progress;
\`\`\`

The \`timestamp > min_ts_1\` condition enforces ordering. Without it you are counting people who hit \`/signup\` *before* \`/pricing\` as converters, which inflates every funnel.

## Returning-visitor cohorts

\`\`\`sql
SELECT visitor_id,
       min(started_at)::DATE AS first_seen,
       count(*)              AS total_sessions,
       datediff('day', min(started_at), max(started_at)) AS lifespan_days
FROM session_summary
GROUP BY visitor_id;
\`\`\`

Group by \`first_seen\` week and you have a retention cohort table without leaving SQL.

## Why DuckDB is pleasant for this

These queries scan a lot of rows, touch few columns, and sort within partitions — precisely the shape a vectorized columnar engine handles well. Sessionizing tens of millions of events on a laptop is routine, which means you can iterate on the logic interactively instead of submitting jobs.

For ready-made queries see [12 SQL queries every dashboard needs](/blog/sql-queries-for-web-analytics), and for the funnel metric itself, [funnel analysis](/blog/funnel-analysis-guide). InsightsTrack's SQL Editor exposes exactly this: read-only DuckDB access to your own event data, so you can write sessionization and funnel queries directly rather than waiting for a feature to be built.
`,
    },
    {
        slug: 'duckdb-query-optimization-tips',
        title: 'DuckDB Performance Tuning: Ten Techniques That Work',
        description:
            'Practical DuckDB optimization — memory limits, projection and filter pushdown, reading EXPLAIN ANALYZE, join order, Parquet pruning, and when materialization beats views.',
        keyword: 'duckdb performance tuning',
        date: '2026-07-18',
        readingMinutes: 6,
        tags: ["DuckDB","Performance"],
        body: `
## Start by measuring

Guessing at optimizations wastes time. DuckDB's profiler tells you exactly where a query spends itself:

\`\`\`sql
EXPLAIN ANALYZE
SELECT country, count(*) FROM events
WHERE timestamp >= current_date - 30 GROUP BY country;
\`\`\`

Read the output bottom-up. The scan node reports how many rows it produced and how many it filtered out. Two numbers matter most: **rows scanned versus rows returned** (a large gap means the filter is not being pushed down), and **which node dominates the time**.

## 1. Set memory_limit and threads explicitly

\`\`\`sql
SET memory_limit = '4GB';
SET threads = 4;
\`\`\`

DuckDB sizes defaults from the host machine, which is wrong inside a container with a lower cgroup limit — it will happily try to use memory it cannot have and get OOM-killed. Set both to match the container, not the host.

## 2. Select only the columns you need

\`SELECT *\` defeats the main advantage of columnar storage. On a 30-column table, selecting the 4 columns you actually use can be close to an order of magnitude less I/O. This matters far more here than it does on a row store, where the difference is marginal.

## 3. Filter early, and filter on the partitioning column

Put the most selective predicate on the column your data is ordered or partitioned by — usually the timestamp. Filters on the scan node prune whole row groups before decompression. Filters applied after a join or an aggregation have already paid for the rows they discard.

## 4. Avoid functions on filtered columns

\`\`\`sql
-- prevents pushdown: the function must run on every row
WHERE date_trunc('day', timestamp) = DATE '2026-07-18'

-- allows pruning on min/max statistics
WHERE timestamp >= DATE '2026-07-18' AND timestamp < DATE '2026-07-19'
\`\`\`

Wrapping a column in a function makes its statistics unusable. Rewriting to a plain range predicate is often the single largest win available in a slow query.

## 5. Let small tables drive joins

DuckDB's optimizer generally picks a sensible join order when it has statistics. It has statistics on tables; it has fewer on subqueries and CTEs. When joining a filtered event set to a small dimension, filter the events *first*, in a CTE, so the join sees a small input:

\`\`\`sql
WITH recent AS (
  SELECT * FROM events WHERE timestamp >= current_date - 7
)
SELECT d.country, count(*)
FROM recent r JOIN dim_geo d USING (geo_key)
GROUP BY d.country;
\`\`\`

## 6. Reduce cardinality before aggregating

\`count(DISTINCT visitor_id)\` over hundreds of millions of rows builds a large hash set. When exactness is not required, approximate counting is dramatically cheaper:

\`\`\`sql
SELECT approx_count_distinct(visitor_id) FROM events WHERE …;
\`\`\`

Typical error is around 1–2%. For a "unique visitors" tile on a dashboard that is entirely acceptable; for billing it is not. Know which one you are building.

## 7. Materialize what you query repeatedly

Views are re-executed on every query. If ten dashboard tiles all read from the same expensive view, you compute it ten times.

\`\`\`sql
CREATE OR REPLACE TABLE daily_rollup AS
SELECT site_id, timestamp::DATE AS day, country, device_type,
       count(*) AS pageviews,
       approx_count_distinct(visitor_id) AS visitors
FROM events
GROUP BY 1,2,3,4;
\`\`\`

A daily rollup refreshed hourly turns most dashboard queries into scans of thousands of rows instead of millions. The trade is staleness — make the refresh interval an explicit product decision, not an accident.

## 8. Prune Parquet with partitioned paths

When reading files, directory structure is part of the query plan:

\`\`\`sql
SELECT count(*) FROM read_parquet('cold/y=2026/m=07/*.parquet');
-- or with hive partitioning inferred from the paths
SELECT count(*) FROM read_parquet('cold/**/*.parquet', hive_partitioning = true)
WHERE y = 2026 AND m = 7;
\`\`\`

With hive partitioning, a predicate on \`y\`/\`m\` skips entire directories without opening a single file. Also keep files reasonably sized — hundreds of tiny Parquet files cost more in per-file overhead than they save.

## 9. Sort data on the column you filter by

Row-group min/max statistics only prune well when data is clustered. If rows arrive in timestamp order, they already are. If you bulk-load out of order, sorting on insert restores pruning:

\`\`\`sql
CREATE OR REPLACE TABLE events AS SELECT * FROM events ORDER BY site_id, timestamp;
\`\`\`

## 10. Batch writes, and checkpoint

Single-row inserts are the most common cause of "DuckDB is slow" reports, and it is a write-path problem masquerading as a read-path one. Insert in batches of thousands. After a large load, run \`CHECKPOINT\` to flush the write-ahead log into the main file so subsequent reads are not replaying it.

## A tuning order of operations

1. \`EXPLAIN ANALYZE\` the slow query — find the dominant node.
2. Cut columns (\`SELECT *\` → explicit list).
3. Make filters pushable — no functions on filtered columns.
4. Check rows-scanned vs rows-returned; if the gap is large, the filter is not pruning.
5. Only then consider rollups, approximation, or restructuring.

Most "DuckDB is slow" cases resolve at step 2 or 3. Reach for architecture changes after you have confirmed the query is not simply reading far more than it needs. See also [Parquet cold storage](/blog/duckdb-parquet-cold-storage) and [why columnar is fast](/blog/columnar-vs-row-storage-explained).
`,
    },
    {
        slug: 'privacy-first-analytics-database-design',
        title: 'Privacy-First Database Design for Analytics',
        description:
            'How to design an analytics schema that cannot leak personal data — pseudonymous IDs, salt rotation, aggregation at write time, retention windows, and deletion by design.',
        keyword: 'privacy first analytics database',
        date: '2026-07-20',
        readingMinutes: 6,
        tags: ["Privacy","Data Modeling"],
        body: `
## Privacy as a schema property

Most privacy work happens at the policy layer: a retention rule, a deletion endpoint, an access review. All useful, all bypassable by a single ad-hoc query.

The stronger approach is to make the schema itself incapable of holding the data you promised not to keep. If there is no column for an IP address, no code path can accidentally store one, no backup contains one, and no subpoena can produce one.

## Never store the raw identifiers

The three fields that turn analytics into personal data are the IP address, the full user agent, and any raw user identifier. Handle each at ingestion, before the first write.

**IP address.** Use it in memory to derive coarse geography, then discard it. Do not log it, do not put it in the request trace, do not keep it in an nginx access log you forgot about.

**User agent.** Parse to browser family, major version, OS, and device type. The parsed tuple is a useful dimension; the raw string is a fingerprint.

**Visitor identity.** This is the hard one, and the next section covers it.

## Rotating-salt visitor identifiers

You need to recognize that two pageviews came from the same person today, without being able to recognize that same person next month.

\`\`\`js
const dailySalt = getSalt(todayUtc());   // rotated every 24h, never persisted
const visitorId = sha256(dailySalt + siteId + ip + userAgent).slice(0, 32);
\`\`\`

The properties that make this work:

- The raw inputs are never stored — only the digest.
- The salt rotates daily and old salts are destroyed, so yesterday's IDs cannot be linked to today's.
- The site ID is in the hash, so the same person on two sites gets unrelated IDs. No cross-site profile is constructible.
- Without the salt, the digest is not reversible even with the original IP and user agent in hand.

The cost is honest and worth stating: unique-visitor counts reset at the salt boundary, so a visitor returning across days counts more than once. You are trading a metric's precision for an unlinkability guarantee, and for most sites that is the right trade.

An alternative is a random ID in \`localStorage\`. It gives better cross-day counting, but note that it is still device storage — several regulators treat that as in scope regardless of whether it is technically a cookie.

## Design the schema to have nowhere to put PII

\`\`\`sql
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  site_id     INTEGER   NOT NULL,
  timestamp   TIMESTAMP NOT NULL,
  visitor_id  CHAR(32)  NOT NULL,   -- rotating-salt hash
  session_id  CHAR(32)  NOT NULL,
  path        VARCHAR   NOT NULL,   -- query string stripped
  referrer_host VARCHAR,            -- host only, never the full URL
  country     CHAR(2),              -- coarse; no city, no coordinates
  browser     VARCHAR(32),
  os          VARCHAR(32),
  device_type VARCHAR(16)
);
\`\`\`

Note what is absent: no \`ip\`, no \`user_agent\`, no \`email\`, no \`user_id\`, no city, no coordinates. There is no column to misuse.

Two details worth calling out. **Strip query strings** before storing paths — they routinely carry tokens, emails, and session identifiers pasted into shared links. Keep an allowlist of UTM parameters and drop the rest. And **store the referrer host, not the full referrer URL**, which can encode a search query or an internal path from another system.

## Coarse geography

Country from timezone or a country-level IP lookup performed in memory. Not city, not coordinates, not postal code. Country is enough to answer "where is my audience" and not enough to locate a person.

Consider suppressing geography entirely for very small counts. A single visitor from a country with one user is identifying in a way that a thousand visitors from the same country are not.

## Retention as an enforced constraint

A retention policy that lives in a document is a suggestion. One that runs on a schedule is a control:

\`\`\`sql
DELETE FROM events WHERE timestamp < now() - INTERVAL '14 months';
\`\`\`

Run it as a scheduled job, log what it deleted, and alert if it stops running. Aggregate before you delete so trend history survives:

\`\`\`sql
INSERT INTO daily_rollup
SELECT site_id, timestamp::DATE, country, device_type,
       count(*), approx_count_distinct(visitor_id)
FROM events
WHERE timestamp < now() - INTERVAL '14 months'
GROUP BY 1,2,3,4;
\`\`\`

Rollups hold no visitor identifiers at all, so they can be kept indefinitely without holding personal data.

## Honour browser signals at the edge

**DNT** (\`navigator.doNotTrack\`) and **GPC** (\`navigator.globalPrivacyControl\`) should be checked in the tracking script *and* re-checked at the API, using the \`Sec-GPC\` header. Client-side checks alone are trivially bypassed by a modified script; server-side alone means the request still left the browser. Do both.

## Aggregate at write time where you can

The strongest guarantee is not storing event-level rows at all. For metrics that only ever get viewed in aggregate — daily pageviews per path, for instance — increment a counter instead of appending a row. There is then no individual record to leak, subpoena, or misuse.

Keep event-level rows only where a genuine product feature needs them: funnels, path analysis, session replay-style aggregates. Then make sure those rows expire.

## The design checklist

- [ ] No IP, raw user agent, or email column exists in any table
- [ ] Visitor IDs are salted hashes with a rotating, unpersisted salt
- [ ] Salt includes site ID so cross-site linkage is impossible
- [ ] Query strings stripped; referrer reduced to host
- [ ] Geography at country level only
- [ ] Retention job scheduled, monitored, and alerting on failure
- [ ] Rollups written before raw deletion
- [ ] DNT and GPC honoured client-side *and* server-side
- [ ] Backups and logs subject to the same retention rules as the tables

That last one catches people. A 14-month retention policy means nothing if you keep 5 years of nightly database dumps.

InsightsTrack implements this schema directly: no IPs, no cookies, rotating-salt visitor IDs, country-level geography, and DNT/GPC honoured in both the script and the API. See also the [GDPR guide](/blog/gdpr-compliant-analytics-guide) and [how cookieless tracking works](/blog/cookieless-analytics-explained).
`,
    },
    {
        slug: 'bounce-rate-explained',
        title: 'What Is a Good Bounce Rate? (And Why the Metric Misleads You)',
        description:
            'How bounce rate is actually calculated, what counts as good by page type, why GA4 changed the definition, and the cases where a high bounce rate is fine.',
        keyword: 'what is a good bounce rate',
        date: '2026-07-22',
        readingMinutes: 5,
        tags: ["Metrics"],
        body: `
## The definition, precisely

A **bounce** is a session with exactly one interaction — the visitor arrived, viewed one page, and left without triggering anything else. **Bounce rate** is bounced sessions divided by total sessions.

\`\`\`sql
SELECT round(100.0 * sum(CASE WHEN pageviews = 1 THEN 1 ELSE 0 END) / count(*), 1)
       AS bounce_rate_pct
FROM sessions
WHERE started_at >= current_date - 30;
\`\`\`

Note what it is *not*: it is not "left quickly" and not "did not convert." A visitor who reads a 3,000-word article for eleven minutes and leaves satisfied is a bounce.

## Why GA4 inverted it

Universal Analytics reported bounce rate. GA4 reports **engagement rate** and defines an engaged session as one lasting over 10 seconds, or with a conversion, or with 2+ pageviews. Bounce rate in GA4 is simply the inverse of that.

The consequence: **GA4 bounce rates are not comparable to Universal Analytics bounce rates**, and neither is directly comparable to most privacy-first tools, which typically use the simpler single-pageview definition. If your bounce rate "changed" when you switched tools, check the definition before you investigate the site.

## Reasonable ranges by page type

Benchmarks vary widely by source and industry; treat these as orientation, not targets:

| Page type | Typical range | Reading |
|---|---|---|
| Blog post / article | 65–90% | High is normal — one page *is* the visit |
| Landing page (single-CTA) | 60–90% | High is expected by design |
| Homepage | 30–55% | Above ~60% suggests unclear navigation |
| Product / pricing | 25–55% | High is a genuine problem |
| Ecommerce category | 20–45% | High suggests search or filter issues |
| Checkout | 10–30% | High is urgent |

Comparing your blog's bounce rate to your pricing page's tells you nothing. Compare each page to itself over time, and to similar pages.

## When high bounce is fine

- **A reference page that answered the question.** Someone searching "postgres default port" who finds 5432 and leaves got exactly what they came for.
- **A single-purpose landing page** where the CTA is an outbound link or a phone number.
- **A contact page** where the conversion is a phone call your analytics cannot see.

Before treating bounce rate as a problem, ask what a *successful* visit to this page looks like. If the answer is "read it and leave," bounce rate is not measuring failure.

## When high bounce is a real signal

Investigate when it is high *and* one of these holds:

- **A specific page regressed.** Bounce jumped from 45% to 78% after a deploy — that is a bug, a broken layout, or a performance regression, and the deploy is your prime suspect.
- **One traffic source bounces far worse than others.** Usually a messaging mismatch: the ad promised something the page does not deliver.
- **Mobile bounces much higher than desktop.** Almost always layout or load time. Check LCP on mobile specifically.
- **High-intent pages bounce.** Pricing, product, checkout — people arrived intending to act and did not.

## Segment before you conclude

A single site-wide bounce rate is nearly useless. The number becomes actionable when you split it:

\`\`\`sql
SELECT device_type, channel,
       count(*) AS sessions,
       round(100.0 * avg(CASE WHEN pageviews = 1 THEN 1.0 ELSE 0 END), 1) AS bounce_pct
FROM sessions
WHERE started_at >= current_date - 30
GROUP BY 1, 2
HAVING count(*) > 100
ORDER BY sessions DESC;
\`\`\`

The \`HAVING\` clause matters. A 100% bounce rate over 3 sessions is noise, and it will otherwise sort straight to the top of your "worst pages" table.

## Better metrics to pair it with

Bounce rate is a blunt instrument on its own. Read it alongside:

- **Scroll depth** — did they read the page, or leave at the fold? This separates "satisfied reader" from "wrong page" far better than bounce alone.
- **Time on page** (median, not mean) — for the sessions where it is measurable.
- **Scroll-adjusted bounce** — sessions with one pageview *and* under 25% scroll depth. That is much closer to what people mean when they say "bounce."
- **Return rate** — did they come back later? A bounce followed by a return visit two days later is not a failure.

## Fixing genuinely bad bounce rates

In rough order of impact:

1. **Load time.** LCP over 2.5s on mobile drives bounces more than any copy change will fix.
2. **Message match.** The page headline should echo the ad, link, or search query that brought them.
3. **Above-the-fold clarity.** What this is and what to do next, without scrolling.
4. **Interstitials.** Popups and consent walls that fire immediately are bounce machines.
5. **Internal links.** Give a satisfied reader somewhere to go next.

Then measure the specific page, segmented by device and source, before and after. Site-wide bounce rate will barely move; the page you fixed will. Related: [scroll depth and heatmaps](/blog/heatmaps-and-session-insights), [what each metric means](/blog/website-analytics-metrics-explained), and [funnel drop-off](/blog/funnel-analysis-guide).
`,
    },
    {
        slug: 'funnel-analysis-guide',
        title: 'Funnel Analysis: Finding Where Your Users Actually Drop Off',
        description:
            'How to build conversion funnels that reveal real drop-off — choosing steps, strict vs loose ordering, attribution windows, segmenting, and avoiding the survivorship traps.',
        keyword: 'conversion funnel analysis',
        date: '2026-07-24',
        readingMinutes: 6,
        tags: ["Metrics"],
        body: `
## What a funnel actually answers

A funnel measures how many people who completed step N go on to complete step N+1. Its value is not the final conversion number — it is knowing *which step* is losing people, so you fix the right thing.

"Our signup conversion is 3%" is not actionable. "62% of people who reach the pricing page start signup, but only 31% of those finish the email verification" tells you where to spend the week.

## Choosing your steps

Good funnels have three properties:

- **Sequential and required.** Each step must genuinely precede the next. If users can reach checkout without the pricing page, pricing does not belong as a prior step — you will report a fictional drop-off that is really just an alternate path.
- **Few.** Three to five steps. A twelve-step funnel splinters into numbers too small to be significant at every level.
- **Meaningful.** Each step should map to something you could plausibly change.

A workable SaaS funnel:

\`\`\`
Visited pricing → Started signup → Verified email → Completed onboarding → Activated
\`\`\`

## Strict vs loose ordering

This choice changes your numbers substantially, so make it deliberately.

**Strict ordering** requires steps in exact sequence with nothing in between. Accurate for rigid flows like checkout; too rigid for exploratory products where people wander back to pricing mid-signup.

**Loose ordering** requires only that step N happened before step N+1, with anything allowed in between. This is the right default for most product funnels.

In SQL, loose ordering means comparing timestamps rather than adjacency:

\`\`\`sql
WITH first_touch AS (
  SELECT visitor_id,
         min(CASE WHEN event_name = 'pricing_viewed'     THEN timestamp END) AS t1,
         min(CASE WHEN event_name = 'signup_started'      THEN timestamp END) AS t2,
         min(CASE WHEN event_name = 'email_verified'      THEN timestamp END) AS t3,
         min(CASE WHEN event_name = 'onboarding_completed'THEN timestamp END) AS t4
  FROM events
  WHERE timestamp >= current_date - 30
  GROUP BY visitor_id
)
SELECT
  count(*) FILTER (WHERE t1 IS NOT NULL)                 AS step_1,
  count(*) FILTER (WHERE t2 > t1)                        AS step_2,
  count(*) FILTER (WHERE t3 > t2 AND t2 > t1)            AS step_3,
  count(*) FILTER (WHERE t4 > t3 AND t3 > t2 AND t2 > t1) AS step_4
FROM first_touch;
\`\`\`

The chained conditions are what enforce order. Dropping them — just counting who did each event — is the most common funnel bug, and it always overstates conversion.

## The attribution window

Over what period must the whole funnel complete? A checkout funnel might use one session. A B2B trial-to-paid funnel might reasonably use 30 days.

Pick a window that matches your actual sales cycle, and state it on the chart. A funnel with no stated window silently reports "ever," which makes recent cohorts look worse than old ones purely because they have had less time.

## Read the conversion between steps, not from the top

Two ways to express the same funnel:

| Step | Users | % of step 1 | % of previous |
|---|---|---|---|
| Pricing viewed | 10,000 | 100% | — |
| Signup started | 3,200 | 32% | 32% |
| Email verified | 2,900 | 29% | 91% |
| Onboarding done | 1,100 | 11% | 38% |

The "% of previous" column is where the answer is. From the top, step 4 looks like the disaster at 11%. Step-over-step reveals that email verification is nearly fine at 91%, and **onboarding is losing 62% of the people who already verified their email**. Those are people who wanted the product enough to confirm an email address. That is the expensive leak.

## Segment the funnel

An aggregate funnel is an average of several different funnels. Split it:

- **By source.** Paid traffic often converts step 1→2 well and 3→4 badly — this depends on [clean UTM tagging](/blog/utm-parameters-guide).
- **By device.** Mobile drop-off at a form step usually means the form is the problem.
- **By first-time vs returning.**
- **By cohort week.** Did the funnel change after last month's redesign?

\`\`\`sql
SELECT device_type,
       count(*) FILTER (WHERE t2 > t1) * 100.0
         / nullif(count(*) FILTER (WHERE t1 IS NOT NULL), 0) AS step_1_to_2_pct
FROM first_touch JOIN sessions USING (visitor_id)
GROUP BY device_type;
\`\`\`

## Traps worth knowing

**Survivorship in the denominator.** Comparing this week's completed funnels to this week's step-1 entries penalizes recent entries that have not finished yet. Use completed cohorts: only count visitors whose full attribution window has elapsed.

**Counting events instead of people.** Someone who reloads checkout four times is one person, not four. Deduplicate by visitor before counting.

**Optional steps modelled as required.** If 40% of users legitimately skip a step, your funnel reports a 40% drop-off that represents nothing.

**Small numbers.** Below a few hundred entrants per step, week-to-week movement is mostly noise. Widen the window rather than reacting to it.

## Turning drop-off into a fix

Once you have found the leaking step, get specific:

1. **Look at the page** in a heatmap or a session view. Where do they stop scrolling? What do they click that is not clickable?
2. **Check performance** on that step, on mobile specifically.
3. **Check for errors.** A JS error on a form submit produces exactly this signature — high intent, zero completion.
4. **Count the required fields.** Form length is the most reliable single predictor of form abandonment.
5. **Ship one change**, then re-measure that step's conversion in isolation.

Funnels tell you *where*. Heatmaps, error tracking, and performance data tell you *why*. InsightsTrack ships all four in one place, which matters because the answer is usually in the correlation between them. Related: [heatmaps and rage clicks](/blog/heatmaps-and-session-insights), [the SQL behind funnels](/blog/sql-window-functions-sessionization), and [cohort retention](/blog/retention-cohort-analysis-sql).
`,
    },
    {
        slug: 'utm-parameters-guide',
        title: 'UTM Parameters: A Complete Guide to Campaign Tracking',
        description:
            'What each UTM parameter means, naming conventions that survive scale, common tagging mistakes, and how UTM data flows into attribution reports.',
        keyword: 'utm parameters guide',
        date: '2026-07-26',
        readingMinutes: 5,
        tags: ["Metrics"],
        body: `
## What UTM parameters are

UTM parameters are tags appended to a URL's query string that tell your analytics where a visitor came from:

\`\`\`
https://example.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=july_launch
\`\`\`

They exist because referrer headers are unreliable — stripped by HTTPS-to-HTTP transitions, absent from apps and email clients, and useless for distinguishing two campaigns from the same source. UTMs put the attribution in the link itself.

## The five parameters

| Parameter | Answers | Example |
|---|---|---|
| \`utm_source\` | Which specific site or sender? | \`newsletter\`, \`twitter\`, \`google\` |
| \`utm_medium\` | What kind of channel? | \`email\`, \`cpc\`, \`social\`, \`referral\` |
| \`utm_campaign\` | Which initiative? | \`july_launch\`, \`black_friday_2026\` |
| \`utm_content\` | Which variant or placement? | \`header_cta\`, \`variant_b\` |
| \`utm_term\` | Which keyword? (paid search) | \`self+hosted+analytics\` |

The first three are effectively required. \`utm_content\` earns its place for A/B testing link placement; \`utm_term\` is mostly a paid-search artifact.

The distinction people get wrong is source vs medium. **Medium is the category, source is the instance.** Email is a medium; your Tuesday newsletter is a source. Getting this backwards makes channel-level reporting impossible, because you can no longer group all email traffic together.

## Naming conventions that hold up

UTM values are case-sensitive and exact-match. \`Email\`, \`email\`, and \`e-mail\` are three different mediums in your reports, and there is no way to merge them retroactively without rewriting history.

Adopt these rules and enforce them:

- **Lowercase everything, always.**
- **Underscores or hyphens — pick one.** Never mix.
- **No spaces.** They encode as \`%20\` and look broken in reports.
- **A fixed medium vocabulary.** Publish the list; do not let it grow ad hoc:

\`\`\`
email, cpc, social, organic_social, referral, affiliate,
display, video, podcast, qr, print
\`\`\`

- **Date-stamp campaigns.** \`black_friday_2026\`, not \`black_friday\`. Next year you will want to compare them.
- **Keep a shared spreadsheet or a link builder.** Every UTM'd link in one place, with an owner. This is the single highest-leverage habit; freehand tagging is where taxonomies die.

## Mistakes that corrupt your data

**Tagging internal links.** This is the big one. Putting UTMs on a link from your own homepage to your own pricing page starts a *new session* attributed to that campaign, destroying the real acquisition source. Never UTM-tag internal navigation. Use event tracking for internal clicks.

**Tagging in a way that breaks canonicals.** UTM'd URLs are distinct URLs to a crawler. Make sure your canonical tag points to the clean URL, or you will fragment your SEO signals across dozens of query-string variants.

**Inconsistent medium for the same channel.** \`social\` in one campaign, \`social_media\` in the next, \`Social\` in a third. Three rows in every report that should be one.

**Leaving UTMs on shared links.** Someone copies a UTM'd URL from their address bar and posts it. Now organic word-of-mouth is attributed to your July email campaign. Some sites strip UTMs from the URL client-side after recording them, which is a reasonable mitigation.

**Putting PII in \`utm_content\`.** Personalized links with an email address or user ID in a parameter put personal data in your analytics store and in every referrer log downstream.

## What happens on the receiving end

A tracking script reads the query string on pageview, records the parameters, and — critically — associates them with the **session**, not just that pageview. If a visitor lands with UTMs, browses five pages, and converts on the sixth, the conversion should still be attributed to the campaign.

\`\`\`sql
SELECT utm_source, utm_medium, utm_campaign,
       count(DISTINCT session_id) AS sessions,
       count(*) FILTER (WHERE event_name = 'signup_completed') AS signups,
       round(100.0 * count(*) FILTER (WHERE event_name = 'signup_completed')
             / nullif(count(DISTINCT session_id), 0), 2) AS conv_pct
FROM events
WHERE timestamp >= current_date - 30 AND utm_source IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY sessions DESC;
\`\`\`

## UTMs and attribution models

UTMs record the touch; the **attribution model** decides which touch gets credit when there are several.

- **Last-touch** — credit the final campaign before conversion. Simple, and the usual default. Overcredits bottom-of-funnel channels like branded search.
- **First-touch** — credit the campaign that first brought them. Better for measuring awareness. Overcredits top-of-funnel.
- **Linear / position-based** — split credit across touches. More honest, harder to explain, and requires stitching sessions across days.

Most self-hosted, privacy-first tools do last-touch by session, because multi-touch attribution across weeks requires persistent cross-session identity — exactly the thing cookieless analytics deliberately avoids. That is a real limitation, and worth being explicit about rather than pretending the numbers mean more than they do.

## A tagging checklist

- [ ] Source, medium, campaign on every external campaign link
- [ ] Lowercase, one separator style, no spaces
- [ ] Medium drawn from a fixed published list
- [ ] Campaign names include the year
- [ ] Zero UTMs on internal links
- [ ] Canonical tags point to clean URLs
- [ ] All links logged in a shared builder with an owner
- [ ] No personal data in any parameter

Related: [funnel analysis by channel](/blog/funnel-analysis-guide) and [retention by acquisition source](/blog/retention-cohort-analysis-sql).
`,
    },
    {
        slug: 'heatmaps-and-session-insights',
        title: 'Click Heatmaps and Scroll Depth: Reading What Users Actually Do',
        description:
            'How click, move, and scroll heatmaps are captured and rendered, what rage clicks and dead clicks reveal, and how to act on the patterns without over-reading them.',
        keyword: 'click heatmap analytics',
        date: '2026-07-28',
        readingMinutes: 6,
        tags: ["Metrics"],
        body: `
## Why heatmaps complement numbers

Analytics tells you a page has a 71% bounce rate. It does not tell you that visitors are repeatedly clicking a bolded phrase that is not a link, or that 80% never scroll past the hero. Heatmaps answer the *why* behind the metric.

Three kinds, each answering a different question:

- **Click maps** — where people click, including where they click things that do nothing.
- **Scroll maps** — how far down the page people actually get.
- **Move maps** — where the cursor travels. Loosely correlated with attention on desktop, meaningless on touch devices. Treat it as the weakest of the three.

## Capturing clicks that survive a redesign

Storing raw \`(x, y)\` pixel coordinates is the naive approach and it breaks immediately: a 1920px desktop and a 390px phone produce incomparable coordinates, and any layout change invalidates all historical data.

Two better strategies, used together:

**Relative coordinates.** Store x as a fraction of viewport width and y as a fraction of document height, plus the viewport width bucket. Now data from different screen sizes can be rendered onto a single normalized canvas.

\`\`\`js
document.addEventListener('click', (e) => {
    track('click', {
        x_pct: +(e.clientX / window.innerWidth).toFixed(4),
        y_pct: +((e.pageY) / document.documentElement.scrollHeight).toFixed(4),
        viewport_bucket: bucketWidth(window.innerWidth),  // 'mobile' | 'tablet' | 'desktop'
        selector: cssPath(e.target),
        text: e.target.textContent?.trim().slice(0, 60),
    });
}, { capture: true, passive: true });
\`\`\`

**Element selectors.** A stable CSS path to the clicked element. This is what survives redesigns — "the primary CTA got 3,400 clicks" remains true even when it moves 200px down the page.

Bucket by viewport and always render heatmaps per device class. A combined desktop-and-mobile heatmap is an average of two different layouts and shows patterns that exist on neither.

## Scroll depth

Track milestone thresholds rather than continuous position — it is a fraction of the events and answers the same questions:

\`\`\`js
const marks = [25, 50, 75, 90, 100];
const fired = new Set();
window.addEventListener('scroll', throttle(() => {
    const pct = (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100;
    for (const m of marks) {
        if (pct >= m && !fired.has(m)) { fired.add(m); track('scroll_depth', { pct: m }); }
    }
}, 250), { passive: true });
\`\`\`

Two details that matter: **throttle the handler** — an unthrottled scroll listener fires dozens of times per second and will show up in your INP numbers — and pass \`{ passive: true }\` so the listener cannot block scrolling.

A typical healthy article shows 100% at the top, 60–75% at the 50% mark, and 25–40% reaching 90%. A sharp cliff at a specific point is the interesting signal: something at that position is stopping people.

## Rage clicks and dead clicks

These two derived signals are usually the highest-value output of click tracking.

**Rage click** — three or more clicks within roughly 1 second inside a small radius. It means something looked interactive and did not respond. Common causes: a slow AJAX action with no loading state, a disabled button with no explanation, a broken handler.

**Dead click** — a click on an element with no handler, no link, and no state change. Usually means something *looks* clickable but is not: a bolded phrase, a styled card, an image that users expect to enlarge.

\`\`\`sql
SELECT path, selector, text, count(*) AS rage_clicks
FROM events
WHERE event_name = 'rage_click' AND timestamp >= current_date - 7
GROUP BY 1, 2, 3
ORDER BY rage_clicks DESC
LIMIT 20;
\`\`\`

Both are unusually actionable because they point at a specific element, not a vague page-level metric. A dead-click cluster on a non-linked card is a five-minute fix that removes a real frustration.

## Reading heatmaps without fooling yourself

**Sample size.** Under a few hundred sessions per page per device class, you are looking at noise arranged decoratively. Wait for volume.

**Position bias.** Things at the top get more clicks because they are at the top. A heavily-clicked hero button is not proof of good copy — compare against what the same element does after being moved.

**Dynamic content.** If a page renders different content per visitor, a single averaged heatmap overlays incompatible layouts. Segment, or exclude those pages.

**Correlation, not causation.** A scroll cliff at 40% might be a boring paragraph, an intrusive embed, a slow-loading image causing a layout shift, or a natural stopping point where the question was answered. The heatmap identifies the location; you still have to diagnose it.

## Acting on what you find

- **Scroll cliff before your CTA** → move the CTA above the cliff, or shorten what precedes it.
- **Dead clicks on a non-link** → make it a link, or restyle it so it does not read as one.
- **Rage clicks on a real button** → add a loading state; check the network call's latency and error rate.
- **Nav items with near-zero clicks** → candidates for removal; every extra option costs attention.
- **Heavy clicking below the fold on mobile** → your mobile layout is burying something people want.

## Privacy considerations

Heatmap capture is where analytics most easily drifts into collecting personal data. Keep it bounded:

- Record **selectors and coordinates**, never form field values.
- Exclude \`input\`, \`textarea\`, and \`select\` contents entirely — capture that a field was clicked, never what was typed.
- Truncate captured element text and skip anything inside a container marked sensitive.
- Do not build full session replay unless you are prepared to handle the consent and data-protection obligations that come with recording someone's screen.

InsightsTrack's heatmaps store relative coordinates plus element selectors, bucketed by device class, with rage-click and dead-click detection — and no form contents, ever. Pair this with [funnel analysis](/blog/funnel-analysis-guide) to find *why* a step leaks, and [bounce rate](/blog/bounce-rate-explained) for the page-level signal.
`,
    },
    {
        slug: 'retention-cohort-analysis-sql',
        title: 'Cohort Retention Analysis in SQL: Building the Triangle Chart',
        description:
            'How to compute cohort retention from raw events — the classic triangle table, N-day vs unbounded retention, and reading the curve without fooling yourself.',
        keyword: 'cohort retention analysis sql',
        date: '2026-07-30',
        readingMinutes: 7,
        tags: ["SQL","Metrics"],
        body: `
## What retention actually measures

Acquisition metrics tell you people arrived. Retention tells you whether the product was worth coming back to. It is the single hardest metric to fake and the one most predictive of whether anything else you do matters.

A **cohort** is a group of users who first appeared in the same period. **Retention** is the fraction of that cohort still active N periods later. Grouping by cohort is what separates "we grew" from "we churned and replaced."

## Building it in three steps

Assume an \`events\` table with \`visitor_id\` and \`timestamp\`.

**Step 1 — assign every user to a cohort.**

\`\`\`sql
CREATE OR REPLACE VIEW user_cohorts AS
SELECT visitor_id,
       date_trunc('week', min(timestamp))::DATE AS cohort_week
FROM events
GROUP BY visitor_id;
\`\`\`

**Step 2 — record each user's activity periods.**

\`\`\`sql
CREATE OR REPLACE VIEW user_activity AS
SELECT DISTINCT visitor_id,
       date_trunc('week', timestamp)::DATE AS active_week
FROM events;
\`\`\`

**Step 3 — join and compute the period offset.**

\`\`\`sql
CREATE OR REPLACE VIEW cohort_retention AS
SELECT c.cohort_week,
       datediff('week', c.cohort_week, a.active_week) AS week_number,
       count(DISTINCT a.visitor_id) AS active_users
FROM user_cohorts c
JOIN user_activity a USING (visitor_id)
GROUP BY 1, 2;
\`\`\`

Then pivot into the familiar triangle:

\`\`\`sql
SELECT cohort_week,
       max(active_users) FILTER (WHERE week_number = 0) AS w0,
       round(100.0 * max(active_users) FILTER (WHERE week_number = 1)
             / nullif(max(active_users) FILTER (WHERE week_number = 0), 0), 1) AS w1_pct,
       round(100.0 * max(active_users) FILTER (WHERE week_number = 2)
             / nullif(max(active_users) FILTER (WHERE week_number = 0), 0), 1) AS w2_pct,
       round(100.0 * max(active_users) FILTER (WHERE week_number = 4)
             / nullif(max(active_users) FILTER (WHERE week_number = 0), 0), 1) AS w4_pct,
       round(100.0 * max(active_users) FILTER (WHERE week_number = 8)
             / nullif(max(active_users) FILTER (WHERE week_number = 0), 0), 1) AS w8_pct
FROM cohort_retention
GROUP BY cohort_week
ORDER BY cohort_week DESC;
\`\`\`

Result:

| Cohort | Users | W1 | W2 | W4 | W8 |
|---|---|---|---|---|---|
| 2026-06-01 | 1,240 | 42.1% | 31.8% | 24.9% | 21.3% |
| 2026-06-08 | 1,388 | 44.6% | 33.2% | 26.1% | 22.0% |
| 2026-06-15 | 1,502 | 39.2% | 28.4% | 21.7% | — |
| 2026-06-22 | 1,610 | 46.8% | 35.9% | — | — |

## Reading the triangle

**Read down a column** to compare cohorts at the same age. This is the only fair comparison — it holds age constant. W1 dropping from 44.6% to 39.2% then recovering to 46.8% is a real week-over-week signal about acquisition quality or onboarding.

**Read across a row** to see one cohort's decay curve.

**The shape of the curve is the whole story.** Healthy retention drops sharply at first and then **flattens**. That flat portion is your durable user base. A curve that keeps declining toward zero means you have no retained users at all — you are renting attention, not building an audience.

The staircase of blanks in the bottom-right is expected: recent cohorts have not lived long enough. Never compare a partial cell to a complete one.

## N-day vs unbounded retention

Two definitions, and they answer different questions:

- **Bounded (classic) retention** — active *in* week N specifically. Stricter, standard for products with a natural usage rhythm.
- **Unbounded ("rolling") retention** — active in week N *or any week after*. More forgiving, better for products used irregularly.

\`\`\`sql
-- unbounded: was the user ever seen at or after week N?
SELECT c.cohort_week, n.week_number,
       count(DISTINCT a.visitor_id) AS retained
FROM user_cohorts c
CROSS JOIN generate_series(0, 12) AS n(week_number)
JOIN user_activity a
  ON a.visitor_id = c.visitor_id
 AND datediff('week', c.cohort_week, a.active_week) >= n.week_number
GROUP BY 1, 2;
\`\`\`

Pick one, label the chart with which it is, and never switch silently. Unbounded retention always looks better, and comparing an unbounded number to a bounded benchmark is how teams accidentally convince themselves things are fine.

## Traps

**Incomplete cohorts.** The current week's cohort is still filling. Excluding it is not optional — plotted alongside complete cohorts it always looks like a collapse.

**Cohorting on the wrong event.** For a product, cohort on activation, not first pageview. A cohort of people who bounced off your homepage will show terrible retention and tell you nothing you can act on.

**Weekly boundaries and seasonality.** A cohort starting on a holiday week behaves differently. Use enough cohorts that one anomaly does not drive the read.

**Small cohorts.** Under ~100 users, a single-digit change in retained users swings the percentage wildly.

**Survivorship in segments.** "Users who did feature X retain better" is usually backwards — engaged users try more features. Correlation, not a causal reason to push feature X.

## From cohorts to action

Split cohorts by acquisition channel and the chart starts paying for itself:

\`\`\`sql
SELECT s.channel, n.week_number,
       round(100.0 * count(DISTINCT a.visitor_id)
             / nullif(count(DISTINCT c.visitor_id), 0), 1) AS retention_pct
FROM user_cohorts c
JOIN first_session s USING (visitor_id)
…
GROUP BY 1, 2;
\`\`\`

If paid social retains at 8% by week 4 and organic search retains at 31%, your acquisition spend is buying a metric, not a business. That comparison changes budgets in a way that a blended CAC number never will.

Cohort retention runs well on a columnar engine — it is a large scan over few columns with a distinct count, exactly the shape DuckDB is built for. In InsightsTrack you can write these queries directly in the SQL Editor against your own data. See also [window functions for sessionization](/blog/sql-window-functions-sessionization) and [12 dashboard SQL queries](/blog/sql-queries-for-web-analytics).
`,
    },
    {
        slug: 'gdpr-compliant-analytics-guide',
        title: 'GDPR-Compliant Web Analytics: What the Rules Actually Require',
        description:
            'A practical walkthrough of GDPR and ePrivacy as they apply to web analytics — lawful basis, the cookie rule, data minimisation, transfers, and what self-hosting changes.',
        keyword: 'gdpr compliant analytics',
        date: '2026-08-02',
        readingMinutes: 6,
        tags: ["Privacy"],
        body: `
> This article is general information for engineers and product teams, not legal advice. Requirements vary by jurisdiction and by how you deploy. Confirm your specific situation with qualified counsel.

## Two separate rules, often conflated

Most confusion about "GDPR-compliant analytics" comes from treating one question as two, or two as one.

**The ePrivacy rule (the "cookie rule")** governs *storing or accessing information on a user's device*. It is triggered by the storage itself, regardless of whether the stored data is personal. Consent is generally required unless the storage is strictly necessary for a service the user requested.

**The GDPR** governs *processing personal data*. It is triggered by the data being about an identifiable person, wherever it is stored.

You can be subject to one, both, or neither. A tool that stores nothing on the device but records IP addresses server-side escapes the first and is squarely inside the second.

## The "no cookies means no banner" claim

This is the most common overstatement in the privacy-analytics market, and it is worth being precise about.

The ePrivacy rule covers storing *or accessing information* on terminal equipment. Several data protection authorities have taken the position that this covers \`localStorage\` and similar mechanisms, not only HTTP cookies. So "we use localStorage instead of cookies" is not automatically a consent exemption.

What genuinely reduces the question is **storing nothing on the device at all** — deriving a visitor identifier server-side from a rotating salt, with nothing written to the browser. Some regulators have published guidance describing conditions under which certain audience-measurement analytics may be exempt from consent; those conditions are specific and vary by country.

The honest position: not storing on the device and not retaining identifiers puts you in a much better place, and whether a banner is required is still a question for your counsel and your jurisdiction.

## Lawful basis under GDPR

If you process personal data, you need a lawful basis. For analytics the realistic options are:

- **Consent** — explicit, informed, freely given, as easy to withdraw as to give. Required if you are doing anything resembling profiling or cross-site tracking.
- **Legitimate interests** — available for genuinely limited, privacy-protective measurement, and requires a documented **Legitimate Interests Assessment** balancing your interest against the user's rights. It is not a checkbox; it is a document you write and keep.

If you have designed the data out — no IPs, no cross-site linkage, no device storage, coarse geography — you may not be processing personal data at all, which is the strongest position available. That is a design outcome, not a policy one.

## Data minimisation in practice

Article 5 requires data be *adequate, relevant and limited to what is necessary*. Translated into schema decisions:

| Field | Necessary for analytics? | What to do |
|---|---|---|
| IP address | No | Use in memory for country, then discard |
| Full user agent | No | Parse to browser/OS/device, discard the string |
| Full URL with query string | Rarely | Strip query params except an allowlist |
| Full referrer URL | No | Keep the host only |
| City / coordinates | Almost never | Country level is sufficient |
| Persistent visitor ID | No | Rotating-salt hash, or nothing |

Every row of that table is a design decision you make once. Retroactive minimisation means deleting data you should never have collected.

## Storage limitation

Personal data must not be kept longer than necessary, and "necessary" must be a period you can justify. Implement it as an enforced job, not a policy document:

\`\`\`sql
DELETE FROM events WHERE timestamp < now() - INTERVAL '14 months';
\`\`\`

Aggregate into rollups first so trend history survives without retaining event-level rows. And apply the same window to **backups and logs** — a 14-month retention policy is void if you hold three years of nightly dumps, or if your reverse proxy is quietly logging IPs to disk.

## International transfers

Chapter V restricts sending personal data outside the EEA without an adequate safeguard. Using a US-based analytics SaaS has been the subject of several national DPA decisions concerning EU-US transfers, and the legal framework here has changed more than once.

**Self-hosting removes the question entirely.** If the data never leaves a server you control in a region you chose, there is no transfer to assess, no processor agreement to negotiate, and no dependency on the current state of an adequacy decision. This is one of the strongest practical arguments for self-hosted analytics, and it is structural rather than contractual.

## Data subject rights

Even with minimal data, be able to answer:

- **Access / portability** — what do you hold about this person? With rotating pseudonymous IDs the honest answer is often "we cannot identify you in our data," which is a valid response under Article 11 if genuinely true.
- **Erasure** — you must be able to delete. If you cannot link data to a person, you cannot delete selectively, and you should say so plainly rather than implying a capability you lack.
- **Objection** — honour DNT and GPC signals, server-side as well as client-side.

Do not claim you can service a right that your architecture makes impossible. Explain the architecture instead.

## Records and documentation

Keep, and actually maintain:

- A **record of processing activities** (Article 30) covering analytics.
- A **Legitimate Interests Assessment**, if that is your basis.
- A **privacy policy** that names the tool, the data, the retention period, and the basis.
- A **DPA** with any processor. Self-hosting means there is no processor for this data — one fewer agreement to maintain.

## A practical checklist

- [ ] Nothing written to the visitor's device, or a documented basis for what is
- [ ] No IP addresses stored anywhere, including proxy and application logs
- [ ] User agent parsed and discarded
- [ ] Query strings stripped; referrer reduced to host
- [ ] Country-level geography only
- [ ] Visitor IDs pseudonymous with a rotating, unpersisted salt
- [ ] Retention window enforced by a monitored scheduled job
- [ ] Backups and logs on the same retention window
- [ ] Data stays in a region you chose (self-hosting)
- [ ] DNT and GPC honoured client-side and server-side
- [ ] Privacy policy accurate about what is actually collected
- [ ] LIA or consent flow documented

InsightsTrack is built to satisfy the technical rows of this list by construction: self-hosted, no IP storage, no cookies, rotating-salt IDs, country-level geo, configurable retention, and DNT/GPC honoured in both the script and the API. The documentation rows are still yours to complete. For the technical detail, see [privacy-first database design](/blog/privacy-first-analytics-database-design) and [cookieless analytics explained](/blog/cookieless-analytics-explained).
`,
    },
    {
        slug: 'realtime-analytics-pipeline-design',
        title: 'Designing a Real-Time Analytics Pipeline (Without Kafka)',
        description:
            'How to build a real-time analytics pipeline on a single node — ingestion, batching, backpressure, freshness budgets, and delivering live dashboards with SSE.',
        keyword: 'real time analytics pipeline',
        date: '2026-08-05',
        readingMinutes: 7,
        tags: ["Architecture"],
        body: `
## "Real-time" needs a number

Before designing anything, define your **freshness budget**: how stale can a dashboard number be before it is wrong for its purpose?

- **Live visitor counter** — a few seconds. This is the only genuinely real-time surface most analytics products have.
- **Today's traffic chart** — 30–60 seconds is imperceptible.
- **Weekly trends** — hourly is fine.

Almost every over-engineered analytics pipeline comes from applying the first budget to all three. A 60-second budget is dramatically cheaper than a 1-second budget, and for most panels nobody can tell the difference.

## The single-node pipeline

You do not need Kafka, Flink, and a streaming warehouse to serve real-time analytics for a normal website. The shape that works:

\`\`\`
Tracking script
   │ POST /api/track  (sendBeacon)
   ▼
Ingest endpoint ──▶ in-memory queue ──▶ batch INSERT ──▶ PostgreSQL
                                                            │
                                              keyset sync (every ~5s)
                                                            ▼
Dashboard ◀── SSE / poll ◀── analytics API ◀────────────  DuckDB
\`\`\`

Every arrow here is a place where you choose between latency and cost. Being explicit about that is the whole design.

## Ingestion: make it cheap and non-blocking

The tracking endpoint should do as little as possible synchronously — validate, enqueue, return.

\`\`\`js
app.post('/api/track', (req, res) => {
    const event = validate(req.body);          // cheap, synchronous
    if (!event) return res.status(204).end();  // never leak validation detail
    queue.push(event);                          // in-memory
    res.status(204).end();                      // respond immediately
});
\`\`\`

Return **204 immediately**. The browser does not need a result, and holding the connection open while you write to a database makes your ingest latency a function of your database's worst moment.

On the client, use \`navigator.sendBeacon\` so events survive page unload:

\`\`\`js
navigator.sendBeacon('/api/track', JSON.stringify(payload));
\`\`\`

\`sendBeacon\` is queued by the browser and delivered even as the page is being torn down — which is exactly when your most interesting events (exit page, time on page, final scroll depth) fire.

## Batching: the single biggest lever

Writing one row per request is what turns a modest traffic spike into an outage. Accumulate and flush on whichever comes first — size or time:

\`\`\`js
const BATCH_SIZE = 500;
const FLUSH_MS = 1000;

setInterval(async () => {
    if (!queue.length) return;
    const batch = queue.splice(0, BATCH_SIZE);
    try {
        await bulkInsert(batch);
    } catch (err) {
        if (queue.length < MAX_QUEUE) queue.unshift(...batch);  // bounded retry
        logger.error({ err, size: batch.length }, 'flush failed');
    }
}, FLUSH_MS);
\`\`\`

A dual trigger matters: size alone means a low-traffic site never flushes; time alone means a spike builds an unbounded batch.

## Backpressure, honestly handled

An in-memory queue must be bounded. When the database is slow and events keep arriving, you have exactly three options, and you must pick one deliberately:

1. **Drop new events** when the queue is full. Preserves history, loses the present.
2. **Drop oldest events.** Preserves the present, loses history.
3. **Spill to disk** and drain later. Preserves everything, adds a failure mode.

For analytics, dropping is usually acceptable — losing 0.5% of pageviews during an incident is not a correctness problem. What is *not* acceptable is an unbounded queue, which converts a slow database into an OOM kill and loses everything.

Whichever you choose, **count what you dropped** and expose it as a metric. Silent data loss is how dashboards start lying without anyone noticing.

## Sync to the read layer

Writes land in Postgres; reads come from DuckDB. The sync interval *is* your freshness budget for everything except the live counter — a 5-second keyset-cursor sync means dashboard numbers are at most 5 seconds stale, which is well inside any reasonable budget.

Use a keyset cursor on the event id and checkpoint after every batch, so a restart resumes exactly where it stopped without duplicating or skipping rows.

## The live counter is a special case

"Visitors in the last 5 minutes" does not need to go through the whole pipeline. Keep it in memory or in Redis as a sliding window, updated at ingest:

\`\`\`js
liveWindow.add(event.visitorId, Date.now());
// count = distinct visitor ids seen in the last 300s
\`\`\`

This is the one surface where sub-second freshness is genuinely visible to the user, and it is cheap precisely because it is separated from the durable path.

## Delivering updates to the browser

**Server-Sent Events** are the right default. One-directional, plain HTTP, automatic reconnection built into the browser, and no protocol upgrade:

\`\`\`js
app.get('/api/realtime/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    const timer = setInterval(async () => {
        const snapshot = await getLiveSnapshot(req.siteId);
        res.write(\`data: \${JSON.stringify(snapshot)}\\n\\n\`);
    }, 5000);
    req.on('close', () => clearInterval(timer));
});
\`\`\`

The \`req.on('close')\` cleanup is mandatory. Without it every disconnected client leaves a timer running forever, and the leak only becomes visible under real traffic.

WebSockets are the wrong tool here — you gain bidirectionality you do not need and take on connection management you would rather avoid. Plain polling every 10 seconds is also perfectly respectable and simpler still.

## When you do need the heavy machinery

Reach for Kafka and a streaming engine when you actually have:

- **Multiple independent consumers** of the same event stream.
- **Ingest beyond what one node can absorb** — sustained tens of thousands of events per second.
- **Replay requirements** — reprocessing history after a logic change.
- **Cross-datacenter durability** guarantees.

Below that, a bounded in-memory queue, batched inserts, a [keyset sync](/blog/incremental-sync-postgres-to-duckdb), and SSE will serve a real-time dashboard on hardware that costs less per month than the streaming platform's documentation is long. InsightsTrack runs this exact pipeline — see [the architecture](/blog/postgres-duckdb-analytics-architecture).
`,
    },
    {
        slug: 'sql-queries-for-web-analytics',
        title: '12 SQL Queries Every Web Analytics Dashboard Needs',
        description:
            'Copy-paste DuckDB SQL for the core web analytics metrics — traffic KPIs, top pages, referrers, entry and exit pages, new vs returning, growth, and anomaly detection.',
        keyword: 'sql queries web analytics',
        date: '2026-08-08',
        readingMinutes: 13,
        tags: ["SQL"],
        body: `
Every query below runs on DuckDB against an \`events\` table with \`site_id\`, \`timestamp\`, \`visitor_id\`, \`session_id\`, \`path\`, \`referrer_host\`, \`country\`, \`device_type\`, and \`event_name\`. Adjust names to your schema; the shapes transfer.

## 1. Headline KPIs

\`\`\`sql
SELECT count(*)                        AS pageviews,
       count(DISTINCT session_id)      AS sessions,
       count(DISTINCT visitor_id)      AS visitors,
       round(count(*)::DOUBLE / nullif(count(DISTINCT session_id), 0), 2)
                                       AS pages_per_session
FROM events
WHERE site_id = ? AND timestamp >= ? AND timestamp < ?;
\`\`\`

Use half-open ranges (\`>= start AND < end\`). \`BETWEEN\` on timestamps includes the end boundary and double-counts the instant where two periods meet.

## 2. Daily trend with gap filling

\`\`\`sql
WITH days AS (
  SELECT unnest(generate_series(?::DATE, ?::DATE, INTERVAL 1 DAY))::DATE AS day
)
SELECT d.day,
       count(e.session_id)             AS pageviews,
       count(DISTINCT e.visitor_id)    AS visitors
FROM days d
LEFT JOIN events e
       ON e.timestamp::DATE = d.day AND e.site_id = ?
GROUP BY d.day
ORDER BY d.day;
\`\`\`

The generated date series is what stops a zero-traffic day from vanishing and making your chart lie about the shape of the trend.

## 3. Top pages

\`\`\`sql
SELECT path,
       count(*)                     AS pageviews,
       count(DISTINCT visitor_id)   AS unique_visitors
FROM events
WHERE site_id = ? AND timestamp >= ? AND event_name = 'pageview'
GROUP BY path
ORDER BY pageviews DESC
LIMIT 25;
\`\`\`

## 4. Top referrers, excluding self

\`\`\`sql
SELECT coalesce(nullif(referrer_host, ''), '(direct)') AS source,
       count(DISTINCT session_id) AS sessions
FROM events
WHERE site_id = ? AND timestamp >= ?
  AND (referrer_host IS NULL OR referrer_host NOT LIKE '%yourdomain.com')
GROUP BY 1
ORDER BY sessions DESC
LIMIT 20;
\`\`\`

Filtering your own domain is essential — internal navigation otherwise dominates the referrer report and hides every real source.

## 5. Sessions, bounce rate, and duration

\`\`\`sql
WITH s AS (
  SELECT session_id,
         min(timestamp) AS started_at,
         max(timestamp) AS ended_at,
         count(*)       AS depth
  FROM events
  WHERE site_id = ? AND timestamp >= ?
  GROUP BY session_id
)
SELECT count(*)                                        AS sessions,
       round(100.0 * avg(CASE WHEN depth = 1 THEN 1.0 ELSE 0 END), 1) AS bounce_pct,
       round(median(epoch(ended_at - started_at)), 0)  AS median_seconds
FROM s;
\`\`\`

Median, not mean. One tab left open overnight destroys an average session duration.

## 6. Entry pages

\`\`\`sql
SELECT path, count(*) AS entries
FROM (
  SELECT session_id, path,
         row_number() OVER (PARTITION BY session_id ORDER BY timestamp) AS rn
  FROM events WHERE site_id = ? AND timestamp >= ?
)
WHERE rn = 1
GROUP BY path
ORDER BY entries DESC
LIMIT 20;
\`\`\`

## 7. Exit pages with exit rate

\`\`\`sql
WITH ranked AS (
  SELECT session_id, path, timestamp,
         row_number() OVER (PARTITION BY session_id ORDER BY timestamp DESC) AS rn_desc
  FROM events WHERE site_id = ? AND timestamp >= ?
)
SELECT path,
       count(*) FILTER (WHERE rn_desc = 1) AS exits,
       count(*)                            AS views,
       round(100.0 * count(*) FILTER (WHERE rn_desc = 1) / count(*), 1) AS exit_rate_pct
FROM ranked
GROUP BY path
HAVING count(*) > 50
ORDER BY exits DESC
LIMIT 20;
\`\`\`

Exit rate without the view count is a trap — a page viewed twice with two exits is 100% and means nothing. Hence the \`HAVING\`.

## 8. New vs returning visitors

\`\`\`sql
WITH firsts AS (
  SELECT visitor_id, min(timestamp)::DATE AS first_day
  FROM events WHERE site_id = ? GROUP BY visitor_id
)
SELECT CASE WHEN f.first_day >= current_date - 0 THEN 'new' ELSE 'returning' END AS type,
       count(DISTINCT e.visitor_id) AS visitors
FROM events e JOIN firsts f USING (visitor_id)
WHERE e.site_id = ? AND e.timestamp::DATE = current_date
GROUP BY 1;
\`\`\`

With rotating-salt visitor IDs this is bounded by the salt window — worth stating on the chart rather than letting people over-read it.

## 9. Geography

\`\`\`sql
SELECT country,
       count(DISTINCT session_id) AS sessions,
       round(100.0 * count(DISTINCT session_id)
             / sum(count(DISTINCT session_id)) OVER (), 1) AS share_pct
FROM events
WHERE site_id = ? AND timestamp >= ? AND country IS NOT NULL
GROUP BY country
ORDER BY sessions DESC;
\`\`\`

The empty \`OVER ()\` window computes the grand total alongside each row — one pass, no self-join.

## 10. Period-over-period growth

\`\`\`sql
WITH periods AS (
  SELECT CASE WHEN timestamp >= current_date - 7  THEN 'current'
              WHEN timestamp >= current_date - 14 THEN 'previous' END AS period,
         session_id, visitor_id
  FROM events
  WHERE site_id = ? AND timestamp >= current_date - 14
)
SELECT
  count(DISTINCT visitor_id) FILTER (WHERE period = 'current')  AS current_visitors,
  count(DISTINCT visitor_id) FILTER (WHERE period = 'previous') AS previous_visitors,
  round(100.0 * (count(DISTINCT visitor_id) FILTER (WHERE period = 'current')
               - count(DISTINCT visitor_id) FILTER (WHERE period = 'previous'))
        / nullif(count(DISTINCT visitor_id) FILTER (WHERE period = 'previous'), 0), 1)
        AS change_pct
FROM periods;
\`\`\`

## 11. Pages growing fastest

\`\`\`sql
SELECT path,
       count(*) FILTER (WHERE timestamp >= current_date - 7)  AS this_week,
       count(*) FILTER (WHERE timestamp >= current_date - 14
                          AND timestamp <  current_date - 7)  AS last_week,
       round(100.0 * (count(*) FILTER (WHERE timestamp >= current_date - 7)
                    - count(*) FILTER (WHERE timestamp >= current_date - 14
                                         AND timestamp < current_date - 7))
             / nullif(count(*) FILTER (WHERE timestamp >= current_date - 14
                                         AND timestamp < current_date - 7), 0), 1)
             AS growth_pct
FROM events
WHERE site_id = ? AND timestamp >= current_date - 14
GROUP BY path
HAVING last_week > 20
ORDER BY growth_pct DESC
LIMIT 20;
\`\`\`

The \`HAVING last_week > 20\` filter is what keeps this list useful. Without it, every page that went from 1 view to 4 shows +300% and buries the real movers.

## 12. Traffic anomaly detection

\`\`\`sql
WITH daily AS (
  SELECT timestamp::DATE AS day, count(*) AS views
  FROM events WHERE site_id = ? AND timestamp >= current_date - 60
  GROUP BY 1
),
stats AS (
  SELECT day, views,
         avg(views)    OVER w AS ma,
         stddev(views) OVER w AS sd
  FROM daily
  WINDOW w AS (ORDER BY day ROWS BETWEEN 28 PRECEDING AND 1 PRECEDING)
)
SELECT day, views, round(ma, 0) AS baseline,
       round((views - ma) / nullif(sd, 0), 2) AS z_score
FROM stats
WHERE abs((views - ma) / nullif(sd, 0)) > 2.5
ORDER BY day DESC;
\`\`\`

The window frame ends at \`1 PRECEDING\` deliberately — including today in its own baseline dampens exactly the spike you are trying to detect.

## A note on running these safely

If you expose SQL to users, run it on a **read-only connection**, enforce a statement timeout and a row limit, and parameterize every value. Never build these strings by interpolation — not even for internal IDs, which have a way of becoming user input later.

InsightsTrack's SQL Editor runs queries against a read-only DuckDB connection with those guards in place, so you can run all twelve against your own data without building a query service first. For deeper patterns see [window functions](/blog/sql-window-functions-sessionization), [cohort retention](/blog/retention-cohort-analysis-sql), and [DuckDB tuning](/blog/duckdb-query-optimization-tips).
`,
    },
    {
        slug: 'website-analytics-metrics-explained',
        title: 'Website Analytics Metrics Explained: What Each One Really Means',
        description:
            'A reference for the core web analytics metrics — pageviews, sessions, users, bounce and exit rate, engagement, conversion — how each is defined and where each misleads.',
        keyword: 'website analytics metrics explained',
        date: '2026-08-12',
        readingMinutes: 5,
        tags: ["Metrics"],
        body: `
## Why definitions matter more than numbers

Two analytics tools pointed at the same website will report different numbers for almost every metric. Neither is broken. They are counting different things and calling them the same name.

Before comparing anything, know exactly what each metric counts and where it breaks down.

## Pageviews

**Definition:** one row per page load recorded by the tracking script.

Sounds simple, and is the metric most distorted by modern web architecture. In a single-page app, client-side navigation fires no page load, so unless the script hooks the History API you record one pageview for an entire visit. Conversely, a script that re-fires on every route change *and* on browser back can double-count.

Also affected by ad blockers (typically 10–30% of technical audiences), prerendering, and bots.

**Use it for:** relative popularity of pages.
**Do not use it for:** absolute traffic claims, or comparison across tools.

## Sessions (visits)

**Definition:** a group of a single visitor's activity, ended by a period of inactivity — conventionally 30 minutes.

The 30-minute rule is convention, not physics, and the edges are arbitrary in ways that matter:

- Someone reading for 45 minutes without clicking gets split into two sessions.
- Some tools also break sessions at midnight, or when a new campaign parameter appears mid-visit.
- A returning visitor after 31 minutes is a new session; after 29, the same one.

**Use it for:** measuring visit volume and comparing it over time on one tool.
**Do not use it for:** comparing across tools without checking both timeout rules.

## Users / visitors

**Definition:** distinct identifiers seen in a period.

This is the metric most people trust most and should trust least. It counts *identifiers*, not people. One person on a phone, a laptop, and a work machine is three visitors. Cleared storage is a new visitor. A shared family device is one visitor for several people.

In privacy-first tools using rotating-salt IDs, the identifier deliberately resets on a schedule, so "unique visitors this month" counts each returning person multiple times. That is a real trade for unlinkability, and the number should be labelled accordingly.

**Use it for:** trend direction on a consistent methodology.
**Do not use it for:** headcount, or anything requiring cross-device identity.

## Bounce rate

**Definition:** sessions with a single interaction, divided by total sessions.

Definitions diverge badly here. Classic analytics used single-pageview. GA4 reports the inverse of engagement rate, where an engaged session is 10+ seconds, or a conversion, or 2+ pageviews. These produce very different numbers for the same site.

Critically, it does not measure satisfaction. A visitor who read your whole article and left happy is a bounce.

**Use it for:** comparing a page to itself over time; spotting regressions after a deploy.
**Do not use it for:** cross-tool comparison, or as a quality score for content pages.

## Exit rate

**Definition:** for a given page, the share of views of that page that were the last in their session.

Constantly confused with bounce rate. Bounce rate is a property of the *session's entry*; exit rate is a property of *a page*. A page can have a high exit rate and be doing its job perfectly — an order confirmation page should have a near-100% exit rate.

**Use it for:** finding unexpected drop-off points in a multi-step flow.
**Do not use it for:** judging pages that are supposed to be the last step.

## Session duration and time on page

**Definition:** time between the first and last recorded event in a session (or on a page).

The structural flaw: the last page in a session has no subsequent event, so its duration is unmeasurable. Different tools handle this differently — some record zero, some exclude it, some use engagement pings. A tool that records zero systematically understates time on page for exactly the pages where people stopped to read.

Always read the **median**, never the mean. Abandoned tabs produce multi-hour outliers that make averages meaningless.

**Use it for:** relative engagement comparison between similar pages.
**Do not use it for:** claims about how long people actually read.

## Pages per session

**Definition:** pageviews divided by sessions.

Interpretation is genuinely ambiguous. High can mean engaged exploration — or that people cannot find what they need and are clicking around in frustration. Read it alongside conversion rate: high pages-per-session with low conversion is usually a navigation problem, not engagement.

## Conversion rate

**Definition:** sessions (or visitors) completing a goal, divided by sessions (or visitors).

The denominator is where this metric goes wrong. Session-based and visitor-based conversion rates differ substantially, and neither is "correct" — but comparing one to the other, or switching silently, produces changes that look like performance shifts and are not.

Segment before you conclude anything. A blended 2.4% conversion rate across paid, organic, and direct is an average of three unrelated numbers.

## Scroll depth

**Definition:** the furthest point down the page a visitor reached, usually at 25/50/75/90/100% milestones.

One of the most honest engagement signals available, because it is hard to fake and directly observable. Especially valuable paired with bounce rate: a "bounce" that reached 90% scroll depth is a satisfied reader, not a failure.

## Core Web Vitals (LCP, CLS, INP)

**Definition:** real-user performance measurements — largest content paint, layout shift, interaction responsiveness.

Always read at the **75th percentile**, which is what Google uses. Averages hide the slowest quarter of your users, which is disproportionately mobile traffic on poor networks — the segment most likely to leave.

Field data (real users) and lab data (Lighthouse) will disagree. Field data is what ranks.

## The metrics worth watching

If you track only five things, track these:

1. **Sessions over time**, segmented by channel — volume and where it comes from.
2. **Conversion rate per channel** — whether that volume is worth anything.
3. **Scroll depth on key pages** — whether content is being read.
4. **p75 LCP on mobile** — the performance number most tied to abandonment.
5. **Week-4 retention by cohort** — whether any of it compounds.

Everything else is diagnostic: useful when one of these five moves and you need to find out why. Go deeper on [bounce rate](/blog/bounce-rate-explained), [funnels](/blog/funnel-analysis-guide), [cohort retention](/blog/retention-cohort-analysis-sql), and [Core Web Vitals](/blog/core-web-vitals-monitoring-guide).
`,
    },
    {
        slug: 'analytics-data-warehouse-on-a-budget',
        title: 'Building an Analytics Data Warehouse on a Single Server',
        description:
            'How to run a complete analytics warehouse — ingestion, transformation, rollups, tiered storage, and BI — on one machine, and the signals that mean it is time to scale out.',
        keyword: 'analytics data warehouse single server',
        date: '2026-08-16',
        readingMinutes: 8,
        tags: ["Architecture","Self-Hosting"],
        body: `
## The default architecture is usually oversized

The reference architecture for analytics — a streaming bus, a distributed warehouse, an orchestration platform, a transformation framework, a BI layer — was designed for organizations with petabytes and a data platform team. Adopting it for 50 GB of event data means paying that complexity tax with none of the benefit.

Modern hardware and embedded columnar engines have moved the threshold dramatically. A single server with 16 GB of RAM handles a workload that would have required a cluster a decade ago.

## What one server actually holds

Rough sizing for web analytics events, assuming a normalized schema and columnar compression:

| Events/month | Raw size | Compressed (Parquet/DuckDB) | Comfortable? |
|---|---|---|---|
| 1M | ~300 MB | ~30 MB | Trivially |
| 10M | ~3 GB | ~300 MB | Easily |
| 100M | ~30 GB | ~3 GB | Yes |
| 1B | ~300 GB | ~30 GB | Yes, with tiering |

The compression ratio is not optimistic. Event data is dominated by low-cardinality columns — country, browser, device type, path — and dictionary plus run-length encoding handles those extremely well.

A billion events is more than most websites will ever generate. If you are below it, a single node is not a compromise.

## The stack

\`\`\`
Ingest (Express)  ──▶  PostgreSQL  ──▶  DuckDB  ──▶  Dashboard
   validate            durable          columnar      API + SQL editor
   batch               source of        read layer
                       truth                │
                                            ▼
                                    Parquet on S3/R2
                                      (cold tier)
\`\`\`

Four components, two of which are databases you were probably going to run anyway.

**PostgreSQL** is the write path and source of truth. Everything durable lands here first — see [designing the ingestion pipeline](/blog/realtime-analytics-pipeline-design).

**DuckDB** is the read layer. Embedded, so there is no service to operate — it is a library your API imports.

**Parquet on object storage** is the cold tier for data older than the hot window.

**The API** serves aggregates and, optionally, read-only SQL.

## Transformation without an orchestrator

You need scheduled transformations — rollups, sessionization, cohort tables. You very likely do not need Airflow to run them.

A SQL file per model plus a small runner covers most of it:

\`\`\`js
const MODELS = [
    'models/sessions.sql',
    'models/daily_rollup.sql',
    'models/cohort_retention.sql',
];

async function runModels(conn) {
    for (const file of MODELS) {
        const sql = await readFile(file, 'utf8');
        const t0 = Date.now();
        await conn.run(sql);
        logger.info({ file, ms: Date.now() - t0 }, 'model built');
    }
}
\`\`\`

Each model is a \`CREATE OR REPLACE TABLE … AS SELECT\`, ordered by dependency. Run it on a cron. Log durations so you can see a model getting slower before it becomes an incident.

This handles ordered dependencies, is debuggable by reading one file, and has no infrastructure. Graduate to a real orchestrator when you have branching dependency graphs, retries with backfill semantics, or several people editing models concurrently — not before.

## Rollups are where the performance comes from

The single highest-leverage optimization is not query tuning. It is not querying raw events for things that can be pre-aggregated.

\`\`\`sql
CREATE OR REPLACE TABLE daily_rollup AS
SELECT site_id,
       timestamp::DATE AS day,
       path, country, device_type, referrer_host,
       count(*)                          AS pageviews,
       count(DISTINCT session_id)        AS sessions,
       approx_count_distinct(visitor_id) AS visitors
FROM events
GROUP BY 1,2,3,4,5,6;
\`\`\`

A year of raw events might be 200 million rows; the same year rolled up is a few hundred thousand. Dashboard queries hit the rollup and return instantly regardless of underlying volume.

Keep raw events for the queries that genuinely need them — funnels, path analysis, ad-hoc investigation — and serve every standard dashboard tile from rollups. The distinction is worth being deliberate about: a rollup cannot answer a question about sequence, only about totals.

## Tiering keeps storage cost flat

Once the hot window is defined — 30 days is a reasonable default — everything older moves to Parquet:

\`\`\`sql
COPY (SELECT * FROM events WHERE timestamp < current_date - 30)
  TO 's3://analytics/cold/' (FORMAT PARQUET, PARTITION_BY (year, month));

CREATE OR REPLACE VIEW events AS
  SELECT * FROM events_hot
  UNION ALL
  SELECT * FROM read_parquet('s3://analytics/cold/**/*.parquet');
\`\`\`

Queries keep saying \`FROM events\`. Recent windows never touch object storage; historical queries transparently span both tiers. Export, verify, then delete from hot — in that order, inside a transaction, because an overlap between tiers double-counts every metric.

## Operational essentials

Running this on one machine means the machine's failure modes are yours:

- **Backups.** \`pg_dump\` on a schedule to off-box storage. DuckDB is derived state and can be rebuilt from Postgres, so it needs no backup — but only if you have actually tested the rebuild.
- **Monitoring.** Sync lag, queue depth, dropped-event count, model build durations, disk free. Sync lag is the earliest indicator of nearly every problem.
- **Resource limits.** Set DuckDB's \`memory_limit\` and \`threads\` to match the container, not the host. Defaults sized from the host will get you OOM-killed inside a constrained container.
- **A tested restore.** An untested backup is a hypothesis. Restore it somewhere, at least once, before you need it.

## When to scale out

Honest signals that a single node is no longer right:

- **Sustained ingest exceeding what one node absorbs** — tens of thousands of events per second, not a lunchtime spike.
- **Many concurrent analysts.** DuckDB is one process sharing CPU with your app; dozens of simultaneous heavy queries is not its shape.
- **Multiple independent consumers** of the raw event stream, needing replay.
- **Availability requirements** that a single machine cannot meet regardless of capacity.
- **Working set genuinely exceeding RAM** after rollups and tiering — and note that rollups and tiering usually fix this before hardware does.

Notably absent: "we have a lot of data." Volume alone is handled by tiering. Scale out for concurrency, availability, and organizational structure — those are the constraints a bigger machine cannot solve.

## The point

The complexity of your data stack should track the complexity of your problems, not the size of the companies whose blog posts you read. Start on one server, measure, and add distribution when a specific limit forces it. InsightsTrack ships this architecture in a single \`docker-compose up\` — Postgres, DuckDB, rollups, optional Parquet tiering, and a SQL editor — because for most sites, that is genuinely the right size. See [Parquet cold storage](/blog/duckdb-parquet-cold-storage), [the sync engine](/blog/incremental-sync-postgres-to-duckdb), and [DuckDB vs ClickHouse](/blog/duckdb-vs-clickhouse-vs-postgres-analytics).
`,
    },
    {
        slug: 'posthog-alternative',
        title: 'PostHog Alternative: A Lighter Self-Hosted Option (Honest Comparison)',
        description:
            'Looking for a PostHog alternative? An honest comparison of features, operational cost, and licensing — including when PostHog is still the right choice.',
        keyword: 'posthog alternative',
        date: '2026-08-20',
        readingMinutes: 9,
        tags: ['Comparison', 'Self-Hosting'],
        body: `
## The short version

PostHog is a product-analytics platform: session replay, feature flags, experiments, surveys, and analytics in one suite. It is genuinely good at that, and if you need those things you should probably use it.

Most people searching for a PostHog alternative are not rejecting the features. They are reacting to one of three things: the **ClickHouse cluster** they now have to operate, the **cost at scale**, or the realisation that they wanted **website analytics** and bought a product-analytics platform.

If that is you, InsightsTrack is a much smaller tool that covers the web-analytics half properly. If you need feature flags, stop reading — PostHog is the right answer and nothing here changes that.

## Where PostHog is genuinely better

Stating this plainly, because a comparison that claims to win everything is worthless:

- **Session replay.** PostHog records and replays real sessions. InsightsTrack does not, deliberately — see the privacy note below.
- **Feature flags.** A core PostHog product with no equivalent here.
- **Experiment framework.** PostHog assigns variants and computes statistical significance. InsightsTrack has path-based A/B tests (compare two URLs against a goal) but does not split traffic for you or report confidence intervals.
- **Surveys and product tooling.** Not something InsightsTrack attempts.
- **Autocapture.** PostHog can retrofit events onto an app without instrumentation.
- **Scale and team.** A funded company with a large engineering team behind it.

If two or more of those matter to you, use PostHog.

## Where a lighter tool wins

### Operational cost

This is the real difference, and it is architectural.

PostHog self-hosted means **ClickHouse**, plus Kafka, Redis, Postgres, and a set of workers. PostHog's own documentation is candid that self-hosting is for teams prepared to operate that — they steer most users to their cloud precisely because the stack is heavy.

InsightsTrack uses **DuckDB**, which is embedded. There is no analytics database service: it runs inside the API process and reads a single file. Writes go to PostgreSQL, a background sync feeds DuckDB, reads come from DuckDB.

| | PostHog (self-hosted) | InsightsTrack |
|---|---|---|
| Services to run | ClickHouse, Kafka, Redis, Postgres, workers | Postgres + API + dashboard |
| Analytics DB to operate | Yes (ClickHouse cluster) | No (embedded DuckDB) |
| Realistic minimum RAM | 16 GB+ | 2 GB |
| Deploy | Helm / k8s recommended | \`docker-compose up\` |
| Upgrade path | Coordinated, multi-service | Pull and restart |

The [architecture deep-dive](/blog/postgres-duckdb-analytics-architecture) explains the dual-database design, and [DuckDB vs ClickHouse vs Postgres](/blog/duckdb-vs-clickhouse-vs-postgres-analytics) covers when a cluster is genuinely warranted.

### Licensing

PostHog's core is MIT, but significant parts of the product live under a separate enterprise licence, and the self-hosted edition is not feature-equivalent to cloud. Read their licence before assuming self-hosted parity.

InsightsTrack is **MIT throughout**. There is no enterprise tier, no gated feature, and no seat limit.

### Privacy posture

PostHog is a product-analytics tool: it identifies users, persists them across sessions, and records replays. That is what makes it useful, and it is also a meaningful data-protection surface — replays capture what people typed unless carefully masked.

InsightsTrack does not record sessions, store IPs, or use cookies. Identifiers are pseudonymous with a rolling expiry. That is a deliberate ceiling on what the tool can tell you, in exchange for a much smaller compliance surface. See [privacy-first database design](/blog/privacy-first-analytics-database-design).

## Feature comparison

| | PostHog | InsightsTrack |
|---|---|---|
| Pageviews, sessions, sources | ✅ | ✅ |
| Funnels | ✅ | ✅ |
| Click heatmaps | ✅ | ✅ |
| Core Web Vitals | Partial | ✅ |
| JS error tracking | ✅ | ✅ |
| Raw SQL access | ✅ (HogQL) | ✅ (read-only DuckDB) |
| Session replay | ✅ | ❌ |
| Feature flags | ✅ | ❌ |
| Experiments / A-B | ✅ Full framework | ⚠️ Path-based split tests |
| Cohort retention | ✅ | ✅ |
| Cookieless by default | ❌ | ✅ |
| Embedded analytics DB | ❌ | ✅ |
| Licence | MIT core + enterprise | MIT |

## Cost

PostHog Cloud is generous at low volume and priced per event after that, which is fine until a traffic spike or a chatty autocapture configuration lands. Self-hosting removes the per-event bill and replaces it with an infrastructure bill and your team's time.

InsightsTrack has no per-event pricing because there is no vendor. Your cost is the server, and a single modest node handles volumes most sites never reach — see [running a warehouse on one server](/blog/analytics-data-warehouse-on-a-budget).

## How to decide

Choose **PostHog** if you need session replay, feature flags, or experiments; if you are doing product analytics on a logged-in app; or if you want a managed cloud with a free tier.

Choose **InsightsTrack** if you want website analytics rather than product analytics; if you are unwilling to operate ClickHouse; if cookieless and self-hosted is a requirement; or if you want raw SQL over your own data without a query service.

Plenty of teams run both — PostHog on the authenticated product, a light cookieless tool on the marketing site. That is a legitimate setup, not a compromise.

## Migrating

Historical data does not transfer; the event models are too different. The practical approach is the one in [the GA4 migration guide](/blog/migrate-from-google-analytics): install alongside, run parallel for two weeks, compare trends rather than absolute totals, then decide.

Setup is one \`docker-compose up\` — the [Docker guide](/blog/self-host-analytics-with-docker) walks through it.

Also worth reading: [the full open-source roundup](/blog/best-open-source-analytics-tools-compared) and [vs Plausible](/blog/plausible-alternative).
`,
    },
    {
        slug: 'plausible-alternative',
        title: 'Plausible Alternative: When You Need More Than Pageviews',
        description:
            'An honest comparison of Plausible and InsightsTrack — simplicity vs depth, heatmaps, SQL access, and the architectural difference between ClickHouse and embedded DuckDB.',
        keyword: 'plausible alternative',
        date: '2026-08-22',
        updated: '2026-09-01',
        readingMinutes: 8,
        tags: ['Comparison', 'Privacy'],
        body: `
## The short version

Plausible is a well-built, deliberately simple, privacy-first analytics tool. Its whole design philosophy is restraint: one lightweight script, one page of numbers, no configuration. For many sites that is exactly right, and if it is right for you there is no reason to switch.

People look for a Plausible alternative for two reasons: they hit the ceiling of what a deliberately simple tool reports, or they do not want to run **ClickHouse** to self-host it.

## Where Plausible is genuinely better

- **Simplicity.** The dashboard is one screen and needs no explanation. That is a real feature.
- **Maturity.** Years of production use, a funded team, an established hosted service.
- **Script size.** Around 1 KB — meaningfully smaller than InsightsTrack's ~9 KB gzipped, because Plausible collects far less. If script weight is your binding constraint, that gap is real and it favours Plausible.
- **Reputation.** Well known and widely trusted in the privacy community.

If "one page of numbers, nothing to think about" describes what you want, use Plausible.

## Where InsightsTrack goes further

### Depth beyond traffic

Plausible's restraint means some things are simply out of scope. InsightsTrack covers them:

- **Click heatmaps** with rage-click and dead-click detection — see [reading heatmaps](/blog/heatmaps-and-session-insights)
- **Core Web Vitals** at p75, scored against Google's thresholds
- **JS error tracking** alongside traffic
- **A read-only SQL editor** over your own event data
- **Scheduled reports and custom dashboards**

That is the trade: more to look at, and more that could be ignored.

### No ClickHouse

Self-hosting Plausible means running ClickHouse alongside Postgres. It works well, and it is a real operational commitment — sizing, merges, upgrades, and a second database's failure modes.

InsightsTrack's read layer is **embedded DuckDB**: no service, no cluster, one file on a volume. The stack is Postgres, the API, and the dashboard.

| | Plausible (self-hosted) | InsightsTrack |
|---|---|---|
| Analytics store | ClickHouse (service) | DuckDB (embedded) |
| Services to run | Postgres + ClickHouse + app | Postgres + API + dashboard |
| Licence | AGPL-3.0 | MIT |
| Heatmaps | ❌ | ✅ |
| Web Vitals | Partial | ✅ |
| Raw SQL access | Via ClickHouse directly | Built-in SQL editor |
| Script size | ~1 KB | ~9 KB gzipped |

### Licensing

Plausible is **AGPL-3.0**. For self-hosting on your own site that is fine. If you intend to build a product on top of it or offer it as a service, the AGPL's network clause has real consequences worth reading carefully.

InsightsTrack is **MIT** — no such clause.

## Both get privacy right

This is not a differentiator, and it would be dishonest to claim it is. Both tools are cookieless, both avoid fingerprinting, both are self-hostable, and neither sells data. Choose between them on depth and operations, not on privacy.

One nuance that applies to both: "no cookies" does not automatically mean "no consent banner." Several regulators treat any storage on a visitor's device as in scope regardless of mechanism. See [the GDPR guide](/blog/gdpr-compliant-analytics-guide).

## The ClickHouse question, in detail

"Run ClickHouse" is easy to write and does not convey much, so here is what it actually means.

ClickHouse is an excellent column store and Plausible uses it well. Self-hosting it means owning:

- **Sizing and memory.** ClickHouse is memory-hungry by design; under-provisioning surfaces as query failures rather than slow queries.
- **Merges and parts.** The storage engine merges data parts in the background. High insert rates with small batches produce many parts, and "too many parts" is a real error you can hit.
- **Upgrades.** A second database with its own release cadence, migration notes, and failure modes.
- **Backups.** A separate backup path from your Postgres backups, because Plausible needs both.

For a team that already runs ClickHouse, none of this is a burden. For a solo developer or a small team, it is a second database to become competent in.

InsightsTrack's DuckDB read layer is embedded — it runs inside the API process and reads one file. There is no cluster, no merge tuning, and no separate backup, because the file is derived from Postgres and rebuilds if lost.

The honest counterpoint: embedded means the read layer scales with one machine. ClickHouse scales across many. At genuinely large volumes, ClickHouse's ceiling is much higher, and that is a point in Plausible's favour rather than against it. [DuckDB vs ClickHouse vs Postgres](/blog/duckdb-vs-clickhouse-vs-postgres-analytics) covers where each engine stops being the right answer.

## Hosted vs self-hosted

This is a real difference and it mostly favours Plausible.

Plausible offers a mature, paid, hosted service run by the people who build it. If you would rather not operate anything, that is the strongest reason in this comparison to choose Plausible, and no amount of feature comparison changes it.

InsightsTrack is self-hosted. You run it, you own the uptime, and you also own the data and pay no per-pageview fee. That trade suits people who already run infrastructure and dislike usage-based pricing; it suits people who want a vendor to page at 3am considerably less.

## Migrating from Plausible

Plausible exports cleanly, which makes evaluation easy:

1. Export your Plausible stats to CSV from the dashboard, or pull them via its stats API.
2. Add the InsightsTrack script alongside the Plausible one — both are async and cookieless.
3. Run both for two to four weeks and compare trends, not totals.
4. Keep the CSV export as your historical archive. There is no importer that reconstructs Plausible's history inside InsightsTrack, and a lossy import would produce numbers that disagree with your old reports.

Expect small discrepancies. Every tool defines a session and filters bots differently ([metrics explained](/blog/website-analytics-metrics-explained)); differences under about 15% are normal.

## Frequently asked questions

### Is InsightsTrack a drop-in Plausible replacement?

For traffic reporting, broadly yes — pageviews, sources, pages, countries, devices, and goals all have equivalents. It is not a replacement for Plausible's hosted service, and it is a heavier script.

### Do I need ClickHouse for InsightsTrack?

No. The read layer is embedded DuckDB, which is a file rather than a service. The stack is Postgres, the API, and the dashboard.

### Which has the smaller tracking script?

Plausible, clearly — roughly 1 KB against InsightsTrack's ~9 KB gzipped. InsightsTrack's script also captures heatmap, scroll-depth, Web Vitals, and error data, so it is doing more work, but if script weight is your constraint then Plausible wins that point outright.

### Can I self-host Plausible for free?

Yes. Plausible Community Edition is self-hostable under AGPL-3.0. Note the AGPL's network clause if you plan to build a product on top of it or offer it as a service — for running analytics on your own site it is not a concern.

### Does either need a cookie banner?

Neither sets cookies. Whether a banner is still required depends on your jurisdiction and what else your site stores. See [the GDPR guide](/blog/gdpr-compliant-analytics-guide).

### Which should I pick for a small personal site?

Probably Plausible, especially hosted. The depth InsightsTrack adds — heatmaps, funnels, SQL, Web Vitals — pays off when you have enough traffic to act on it. On a low-traffic personal site, the simpler tool is the better tool.

## How to decide

Choose **Plausible** if you want the simplest possible dashboard, prefer a mature hosted option, need the smallest possible script, or are happy running ClickHouse.

Choose **InsightsTrack** if you want heatmaps, Web Vitals, and error tracking in the same tool; if you want SQL access to your own data; if you would rather not operate a second database; or if AGPL is a problem for your use case.

## Trying both

Both install as a single script tag, so run them side by side for a week. Expect small differences in totals — session rules and bot filtering differ between every analytics tool ([metrics explained](/blog/website-analytics-metrics-explained) covers why). Compare what you can *do* with the data, which is the actual decision. See also [the full roundup](/blog/best-open-source-analytics-tools-compared) and [vs Umami](/blog/umami-alternative).
`,
    },
    {
        slug: 'matomo-alternative',
        title: 'Matomo Alternative: Lighter Self-Hosted Analytics',
        description:
            'Comparing Matomo and InsightsTrack — feature breadth vs operational weight, MySQL vs columnar reads, licensing, and when Matomo is still the better fit.',
        keyword: 'matomo alternative',
        date: '2026-08-24',
        updated: '2026-09-01',
        readingMinutes: 8,
        tags: ['Comparison', 'Self-Hosting'],
        body: `
## The short version

Matomo is the most feature-complete open-source analytics platform there is. It has been going since 2007, it is the closest thing to a genuine Google Analytics replacement, and it has ecommerce, tag management, goals, custom dimensions, and a large plugin marketplace.

That completeness is also why people look for an alternative. Matomo is **heavy** — to run, to configure, and to navigate. The common complaint is not that it lacks features; it is that reports slow down as data grows, and that the interface carries fifteen years of accumulated surface area.

## Where Matomo is genuinely better

- **Feature breadth.** Ecommerce tracking, tag manager, custom reports, roll-up reporting, A/B testing plugins. Nothing here matches that catalogue.
- **Maturity.** Nearly two decades of production use and a large plugin ecosystem.
- **GA feature parity.** If you need a specific GA4 report reproduced, Matomo most likely has it.
- **Log importing.** It can ingest server logs, which is genuinely useful for tracking-blocked traffic.

If you need ecommerce analytics or a tag manager, use Matomo.

## Where a lighter tool wins

### Query performance as data grows

Matomo stores analytics in **MySQL/MariaDB** — a row store. Row stores read whole rows to answer questions that only touch a few columns, which is exactly the shape of a dashboard query. Matomo compensates with a heavy pre-aggregation system (archiving), which works but adds its own operational burden: archiving cron jobs that must keep up, and reports that are stale or slow when they do not.

InsightsTrack serves reads from **DuckDB**, a columnar engine. A \`GROUP BY country\` reads the country column and nothing else. There is no archiving system to keep running, because the aggregation is cheap enough to do at query time. [Columnar vs row storage](/blog/columnar-vs-row-storage-explained) explains why the difference is large rather than marginal.

| | Matomo | InsightsTrack |
|---|---|---|
| Storage | MySQL/MariaDB (row) | Postgres writes + DuckDB reads (columnar) |
| Pre-aggregation | Required (archiving cron) | Optional rollups |
| Typical footprint | PHP + MySQL + cron workers | Node API + Postgres |
| Licence | GPL-3.0 | MIT |
| Cookies | Cookies by default (configurable) | Cookieless |
| Feature breadth | Very high | Focused |

### Cookies and consent

Matomo uses cookies by default. It **can** be configured for cookieless tracking and offers a consent-mode setup, but that is a configuration you must get right rather than the default.

InsightsTrack has no cookie mode to configure — there are no cookies, no IP storage, and no fingerprinting. Fewer knobs, fewer ways to get compliance wrong.

### Licensing

Matomo is **GPL-3.0**; some official plugins are commercially licensed. InsightsTrack is **MIT** with no paid tier.

### The archiving problem, concretely

Matomo's archiving is the part that surprises people, so it is worth being specific about what it is.

Because MySQL cannot aggregate raw hits fast enough for interactive reports, Matomo pre-computes them into summary tables on a schedule. On a small site this is invisible. As traffic grows, three things tend to happen:

- **The cron run stops finishing** before the next one starts, and reports fall behind.
- **Browser-triggered archiving** (the default on some installs) makes whoever opens the dashboard pay for the computation, so the first view of the day is slow.
- **Re-processing history** — after a segment change or a data fix — becomes an expensive batch job rather than an instant re-query.

None of this is a flaw in Matomo so much as the cost of serving column-shaped questions from a row store. The standard fixes are real work: tune the cron cadence, disable browser archiving, add segment pre-processing, and give MySQL more memory.

InsightsTrack does not have an archiving layer, because DuckDB aggregates at query time cheaply enough not to need one. That removes a category of operational failure; it also means there is no pre-computed cache to fall back on if a query is genuinely expensive. Optional rollups exist for very large datasets. [Columnar vs row storage](/blog/columnar-vs-row-storage-explained) covers the underlying reason.

## What migrating actually involves

Matomo has years of history in it, and that history is the main reason to stay. Be clear-eyed about what moves and what does not.

**What does not transfer:** historical reports. The schemas are structurally different — Matomo stores pre-aggregated archive tables keyed to its own segment and session definitions. There is no faithful mapping, and a lossy import would give you numbers that silently disagree with your old dashboards.

**What you can do instead:**

1. Keep the Matomo instance running read-only. It costs little and stays authoritative for historical questions.
2. Run both trackers in parallel for a full reporting cycle, then cut over new reporting to the new tool.
3. Export the Matomo reports you actually reference — usually a handful of monthly summaries — to CSV for the archive.
4. Expect different absolute numbers. Matomo counts cookie-based returning visitors by default; a cookieless tool cannot, so your returning-visitor rate will drop even though real behaviour has not changed.

That last point causes the most confusion in migrations. It is a definition change, not a traffic change. [The GA4 migration guide](/blog/migrate-from-google-analytics) covers the same parallel-run method in more detail.

## Frequently asked questions

### Is InsightsTrack a drop-in Matomo replacement?

No, and it would be misleading to claim otherwise. Matomo has ecommerce tracking, a tag manager, log importing, and a plugin marketplace that InsightsTrack does not attempt to match. It is a replacement for the traffic-and-behaviour subset of Matomo, not for the whole catalogue.

### Can I import my Matomo history?

Not faithfully. The archive schemas do not map cleanly. Keep the old instance running read-only for historical lookups and run the two in parallel going forward.

### Will my visitor numbers change after switching?

Almost certainly, and mostly in returning-visitor metrics. Matomo's default cookie-based visitor identification recognises people across sessions in ways cookieless tracking deliberately does not. Pageviews should stay close; unique and returning visitors will not.

### Does Matomo require a cookie banner?

By default Matomo sets cookies, which generally puts it in scope. It can be configured for cookieless tracking, and Matomo documents a consent mode — but it is a configuration you have to apply and verify, rather than the default state.

### Which is cheaper to run?

For a small site, both are inexpensive. Matomo's PHP + MySQL + archiving-worker footprint is heavier at the same traffic level, mainly because archiving needs headroom. The larger cost difference is usually operator time, not hosting.

### Is GPL vs MIT a practical difference?

For running analytics on your own site, no. It matters if you intend to modify the code and distribute it, or build a product on top — GPL-3.0 carries obligations MIT does not. Check with whoever handles licensing at your organisation rather than taking a blog's word for it.

## How to decide

Choose **Matomo** if you need ecommerce tracking, a tag manager, or specific GA4 reports reproduced; if you want log importing; if you need the historical continuity of an existing install; or if plugin breadth matters more than speed.

Choose **InsightsTrack** if you want fast reports without an archiving system to babysit; if cookieless-by-default matters; if you prefer a small stack; or if you want raw SQL over your own data.

## Migrating

Matomo's data does not import cleanly — the schemas differ fundamentally. Run both in parallel for a couple of weeks and compare trends, as in [the GA4 migration guide](/blog/migrate-from-google-analytics). Expect different absolute numbers, particularly if your Matomo install counts cookie-based returning visitors. See also [the full roundup](/blog/best-open-source-analytics-tools-compared) and [vs Plausible](/blog/plausible-alternative).
`,
    },
    {
        slug: 'umami-alternative',
        title: 'Umami Alternative: Same Simplicity, More Depth',
        description:
            'Comparing Umami and InsightsTrack — both lightweight and privacy-first, but differing on heatmaps, Web Vitals, SQL access, and read performance at scale.',
        keyword: 'umami alternative',
        date: '2026-08-26',
        updated: '2026-09-01',
        readingMinutes: 7,
        tags: ['Comparison', 'Privacy'],
        body: `
## The short version

Umami is a lightweight, MIT-licensed, privacy-first analytics tool that runs on Postgres or MySQL. It is genuinely pleasant: easy to deploy, clean dashboard, no cookies, no bloat. Of all the tools in this space it is the closest to InsightsTrack in philosophy.

The reason to look elsewhere is usually depth. Umami answers "how much traffic, from where, to which pages" very well, and stops there by design.

## Where Umami is genuinely better

- **Deployment simplicity.** One Node app plus one database. Marginally simpler than this stack.
- **Maturity and adoption.** Larger community and longer track record.
- **Script size.** Umami's tracker is roughly 2 KB; InsightsTrack's is ~9 KB gzipped, because it also captures heatmap, scroll, Web Vitals, and error data. Umami is the lighter script by a clear margin.
- **Multi-tenancy.** Well-established patterns for running many sites.

Both tools are MIT, both are cookieless, both are self-hosted. This is a close comparison, not a lopsided one.

## Where InsightsTrack goes further

### Behavioural data, not just traffic counts

Umami reports what happened. InsightsTrack also reports *how* it happened:

- **Click heatmaps** with rage-click and dead-click detection
- **Scroll depth** per page
- **Core Web Vitals** at p75 against Google's thresholds
- **JS error tracking**
- **Multi-step funnels** with per-step drop-off

If you have ever looked at a high bounce rate in Umami and wanted to know *why*, that gap is the difference. [Reading heatmaps](/blog/heatmaps-and-session-insights) covers what that data actually tells you.

### Read performance as data grows

Umami queries the same **row-store** database it writes to — Postgres or MySQL. That is simple and correct, and it means dashboard aggregations get slower as the events table grows, because answering "unique visitors per day over 90 days" walks a lot of rows.

InsightsTrack splits the workloads: PostgreSQL takes writes, a background sync feeds **DuckDB**, and every dashboard read hits the columnar engine. More moving parts in the design; considerably better read behaviour as the table grows. See [the architecture](/blog/postgres-duckdb-analytics-architecture) and [the sync engine](/blog/incremental-sync-postgres-to-duckdb).

| | Umami | InsightsTrack |
|---|---|---|
| Licence | MIT | MIT |
| Cookieless | ✅ | ✅ |
| Storage | Postgres/MySQL (row) | Postgres + DuckDB (columnar reads) |
| Heatmaps | ❌ | ✅ |
| Scroll depth / rage clicks | ❌ | ✅ |
| Web Vitals | ❌ | ✅ |
| Error tracking | ❌ | ✅ |
| Funnels | Basic | Multi-step with drop-off |
| SQL editor | ❌ | ✅ (read-only) |

### SQL access

Umami has a clean API but no built-in query surface. InsightsTrack ships a **read-only SQL editor** over DuckDB, so you can answer questions the UI does not have a screen for — see [12 SQL queries every dashboard needs](/blog/sql-queries-for-web-analytics).

## What each one costs to run

Both are modest, but they are not identical. Umami is one Node process and one database. InsightsTrack is a Node API, Postgres, and a DuckDB file on a volume — the DuckDB part is embedded, so it is a file rather than a service, but the API process needs enough memory to hold query working sets.

| | Umami | InsightsTrack |
|---|---|---|
| Processes to run | App + database | API + dashboard + Postgres |
| Extra analytics service | None | None (DuckDB is embedded) |
| Realistic small-site footprint | ~512 MB RAM | ~1 GB RAM |
| Backup surface | One database dump | Postgres dump (DuckDB rebuilds from it) |

The DuckDB file is a derived cache, not a source of truth — every event lives in Postgres first. If the file is lost, the sync rebuilds it. That means your backup story stays "back up Postgres," same as Umami.

## Data ownership and export

Both tools keep data on your infrastructure, so neither locks you in. The practical difference is how you get data *out*.

Umami exposes a documented REST API and you can always query its Postgres/MySQL tables directly with standard SQL — a genuine advantage of storing analytics in a database you already know.

InsightsTrack has the same property plus a built-in read-only SQL editor, so exploratory queries do not require database credentials or a separate client. Results export to CSV, and scheduled reports can email them on a cadence. Both are honest answers; Umami's is simpler, InsightsTrack's is more self-service.

## Migrating between them

There is no importer in either direction, and building one is harder than it sounds — the session definitions differ, so historical numbers would not line up even with a perfect row-for-row copy.

The workable approach is to run both for two to four weeks:

1. Add the second script alongside the first. Both are async and cookieless; two trackers will not meaningfully affect page performance.
2. Compare *trends*, not absolute totals. Direction and relative page rankings should agree closely.
3. Expect 5–15% differences in visitor counts. Bot filtering and session-timeout rules differ between every analytics tool ([metrics explained](/blog/website-analytics-metrics-explained)).
4. Keep the old tool running through at least one full monthly reporting cycle before cutting over.

If the two disagree by more than about 20%, something is misconfigured — usually a script missing from a subset of pages, or one tool filtering bots the other counts.

## Frequently asked questions

### Is Umami or InsightsTrack faster?

For collection, both are negligible — Umami's script is smaller. For *reporting*, it depends on data volume. Below a few hundred thousand events, both feel instant. Above that, InsightsTrack's columnar reads pull ahead on wide date ranges, because a 90-day aggregation reads only the columns it needs instead of walking rows. Below that threshold the difference is not worth switching for.

### Can I use Umami and InsightsTrack together?

Yes, and it is the recommended way to evaluate them. Both are cookieless and async, so running both costs one extra network request per page.

### Does either require a cookie banner?

Neither sets cookies. Whether you still need a banner depends on your jurisdiction and what else your site stores — several regulators treat any device storage as in scope regardless of mechanism. See [the GDPR guide](/blog/gdpr-compliant-analytics-guide).

### Which has better support for multiple sites?

Umami's multi-tenancy is more established. InsightsTrack supports multiple sites with per-site team roles, but Umami has more production mileage running many sites on one install.

### Why would I pick Umami over InsightsTrack?

If traffic counts answer your questions, Umami is the smaller, simpler, more proven tool, with a lighter script. That is a good reason and this comparison should not talk you out of it.

## How to decide

Choose **Umami** if traffic numbers are all you need, if you want the smallest possible stack, if script weight matters, or if you value a larger community.

Choose **InsightsTrack** if you want heatmaps, Web Vitals, and error tracking in one place; if you want SQL access; or if your event volume is large enough that row-store aggregations have started to drag.

## Running both

Both are a single script tag and both are MIT, so trying them together costs nothing but a week. The numbers will differ slightly — every tool defines sessions and filters bots differently ([metrics explained](/blog/website-analytics-metrics-explained)). See also [the full roundup](/blog/best-open-source-analytics-tools-compared) and [vs Plausible](/blog/plausible-alternative).
`,
    },
    {
        slug: 'best-open-source-analytics-tools-compared',
        title: 'The Best Open-Source Analytics Tools Compared (2026)',
        description:
            'An honest side-by-side comparison of Matomo, Plausible, Umami, PostHog, and InsightsTrack — features, storage engines, operational cost, and which to pick for which job.',
        keyword: 'best open source analytics tools',
        date: '2026-08-28',
        readingMinutes: 10,
        tags: ['Comparison', 'Google Analytics'],
        body: `
## How to read this comparison

Every tool here is open source, self-hostable, and a credible Google Analytics replacement. None is best at everything, and a comparison claiming otherwise is marketing.

The useful question is not "which is best" but **which job are you hiring it for**. Three different jobs show up repeatedly:

1. *"Replace GA4, keep the features."* → Matomo
2. *"Just tell me my traffic, simply and privately."* → Plausible or Umami
3. *"Understand behaviour in my product."* → PostHog

InsightsTrack sits between 2 and 3: web analytics with behavioural depth, without product-analytics weight.

## The table

| | Matomo | Plausible | Umami | PostHog | InsightsTrack |
|---|---|---|---|---|---|
| Licence | GPL-3.0 | AGPL-3.0 | MIT | MIT + enterprise | MIT |
| Storage engine | MySQL (row) | ClickHouse | Postgres/MySQL (row) | ClickHouse | Postgres + DuckDB |
| Analytics DB to operate | MySQL | ClickHouse | Same DB | ClickHouse + Kafka | None (embedded) |
| Cookieless default | Configurable | ✅ | ✅ | ❌ | ✅ |
| Heatmaps | Paid plugin | ❌ | ❌ | ✅ | ✅ |
| Session replay | Paid plugin | ❌ | ❌ | ✅ | ❌ |
| Funnels | ✅ | Basic | Basic | ✅ | ✅ |
| Web Vitals | ❌ | Partial | ❌ | Partial | ✅ |
| Error tracking | ❌ | ❌ | ❌ | ✅ | ✅ |
| Feature flags | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ecommerce | ✅ | Basic goals | ❌ | ✅ | Goals + funnels |
| Tag manager | ✅ | ❌ | ❌ | ❌ | ❌ |
| SQL access | Limited | Via ClickHouse | ❌ | ✅ HogQL | ✅ Built-in editor |
| Minimum realistic RAM | 2–4 GB | 4 GB+ | 1 GB | 16 GB+ | 2 GB |

## Storage engine is the decision nobody makes deliberately

It is worth understanding, because it determines both your dashboard speed and your weekend.

**Row stores** (Matomo, Umami) read entire rows to answer a question about two columns. Simple to operate — it is the database you already run — but aggregations get slower as data grows. Matomo compensates with a pre-aggregation cron; Umami largely does not, which is fine until it isn't.

**ClickHouse** (Plausible, PostHog) is a columnar database built for this workload and very good at it. The cost is that it is a distributed system you now operate: sizing, merges, replication, upgrades.

**Embedded columnar** (InsightsTrack) uses DuckDB inside the API process — columnar read performance with no service to run. The ceiling is lower than a ClickHouse cluster: it is one process, so it suits a handful of concurrent dashboard users rather than hundreds of analysts.

[Columnar vs row storage](/blog/columnar-vs-row-storage-explained) covers the mechanics, and [DuckDB vs ClickHouse vs Postgres](/blog/duckdb-vs-clickhouse-vs-postgres-analytics) covers when to pick which.

## Picking by job

**Replacing GA4 feature-for-feature, ecommerce included** → **Matomo**. Nothing else has the catalogue. Budget for the operational weight and the archiving system.

**A public site where you want traffic numbers and nothing else** → **Plausible** if you want polish and a hosted option, **Umami** if you want the smallest stack and MIT.

**Product analytics on a logged-in app** → **PostHog**. Session replay, flags, and experiments are the product. Use their cloud unless you are prepared to run ClickHouse.

**Web analytics with behavioural depth, minimal ops** → **InsightsTrack**. Heatmaps, Web Vitals, error tracking, funnels, and raw SQL, from Postgres plus an embedded engine. See [the full comparison against GA4](/blog/open-source-google-analytics-alternative).

## What "open source" hides

Three things to check before committing, regardless of which you pick:

- **Licence terms.** AGPL (Plausible) has a network clause that matters if you build a service on it. MIT (Umami, InsightsTrack) does not.
- **Self-hosted parity.** PostHog's self-hosted edition is not feature-equivalent to cloud, and some Matomo capabilities are paid plugins. "Open source" does not always mean "everything, free."
- **Who operates it.** The honest cost of self-hosting is your team's time, not the server. A tool needing one container is a genuinely different commitment from one needing a cluster.

## Try before committing

All of these install as a single script tag and can run in parallel. Two weeks of overlap tells you more than any comparison table, this one included — including how each tool's numbers differ, which they will ([metrics explained](/blog/website-analytics-metrics-explained)).
`,
    },
];

export function getPost(slug) {
    return BLOG_POSTS.find((p) => p.slug === slug);
}

/** URL-safe slug for a tag, e.g. "Data Modeling" -> "data-modeling". */
export function tagSlug(tag) {
    return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** All tags, sorted by post count (desc) then name. */
export function getTags() {
    const counts = new Map();
    for (const p of BLOG_POSTS) for (const t of p.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()]
        .map(([tag, count]) => ({ tag, slug: tagSlug(tag), count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Posts carrying a tag, newest first. Accepts the tag's slug. */
export function getPostsByTag(slug) {
    return BLOG_POSTS
        .filter((p) => (p.tags || []).some((t) => tagSlug(t) === slug))
        .sort((a, b) => b.date.localeCompare(a.date));
}
