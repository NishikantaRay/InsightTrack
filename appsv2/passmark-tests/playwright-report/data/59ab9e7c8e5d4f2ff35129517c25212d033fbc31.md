# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/analytics-sections.spec.ts >> Audience (/audience) >> renders heading and audience breakdown
- Location: tests/dashboard/analytics-sections.spec.ts:54:3

# Error details

```
Error: The accessibility snapshot and current URL do not show any heading with text similar to 'Audience' or 'New vs Returning Visitors'. Therefore, the assertion that such a heading is visible does not hold based on the provided data.

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - navigation [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - img [ref=e10]
        - generic [ref=e12]: InsightTrack
      - generic [ref=e13]:
        - link "Features" [ref=e14] [cursor=pointer]:
          - /url: "#features"
        - link "How It Works" [ref=e15] [cursor=pointer]:
          - /url: "#how-it-works"
        - link "Tech Stack" [ref=e16] [cursor=pointer]:
          - /url: "#tech-stack"
      - generic [ref=e17]:
        - button "Toggle theme" [ref=e18] [cursor=pointer]:
          - img [ref=e19]
        - link "Sign In" [ref=e21] [cursor=pointer]:
          - /url: /login
        - link "Get Started" [ref=e22] [cursor=pointer]:
          - /url: /register
  - generic [ref=e26]:
    - generic [ref=e29]: Open-Source & Self-Hosted
    - heading "Web analytics that respect your users" [level=1] [ref=e30]:
      - text: Web analytics that
      - text: respect your users
    - paragraph [ref=e31]: Powerful, real-time website analytics without cookies or personal data tracking. Self-hosted, open source, and blazingly fast with DuckDB-powered queries.
    - generic [ref=e32]:
      - link "Start Tracking Free" [ref=e33] [cursor=pointer]:
        - /url: /register
        - text: Start Tracking Free
        - img [ref=e34]
      - link "See How It Works" [ref=e36] [cursor=pointer]:
        - /url: "#how-it-works"
    - generic [ref=e38]:
      - generic [ref=e43]: localhost:5173
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic [ref=e46]:
            - img [ref=e48]
            - generic [ref=e50]: InsightTrack
          - generic [ref=e51]: Dashboard
          - generic [ref=e52]: Pages
          - generic [ref=e53]: Funnels
          - generic [ref=e54]: Realtime
          - generic [ref=e55]: Settings
        - generic [ref=e56]:
          - generic [ref=e57]:
            - generic [ref=e58]: Dashboard
            - generic [ref=e59]:
              - generic [ref=e60]: Today
              - generic [ref=e61]: 7d
              - generic [ref=e62]: 30d
              - generic [ref=e63]: 90d
          - generic [ref=e64]:
            - generic [ref=e65]:
              - paragraph [ref=e66]: Visitors
              - paragraph [ref=e67]: 12,847
              - text: ↑ 12.3%
              - img [ref=e68]
            - generic [ref=e70]:
              - paragraph [ref=e71]: Pageviews
              - paragraph [ref=e72]: 34,201
              - text: ↑ 8.7%
              - img [ref=e73]
            - generic [ref=e75]:
              - paragraph [ref=e76]: Bounce Rate
              - paragraph [ref=e77]: 42.5%
              - text: ↓ 2.1%
              - img [ref=e78]
            - generic [ref=e80]:
              - paragraph [ref=e81]: Avg. Duration
              - paragraph [ref=e82]: 3m 05s
              - text: ↑ 5.4%
              - img [ref=e83]
          - generic [ref=e85]:
            - generic [ref=e86]:
              - paragraph [ref=e87]: Traffic Over Time
              - img [ref=e88]
            - generic [ref=e92]:
              - paragraph [ref=e93]: Traffic Sources
              - generic [ref=e94]:
                - img [ref=e95]
                - generic [ref=e101]:
                  - generic [ref=e102]: Direct 35%
                  - generic [ref=e104]: Google 20%
                  - generic [ref=e106]: Social 15%
                  - generic [ref=e108]: Referral 13%
                  - generic [ref=e110]: Email 8%
            - generic [ref=e112]:
              - paragraph [ref=e113]: Top Pages
              - generic [ref=e114]:
                - generic [ref=e115]:
                  - generic [ref=e116]: /home
                  - generic [ref=e119]: 4,230
                - generic [ref=e120]:
                  - generic [ref=e121]: /pricing
                  - generic [ref=e124]: 2,810
                - generic [ref=e125]:
                  - generic [ref=e126]: /about
                  - generic [ref=e129]: 1,940
                - generic [ref=e130]:
                  - generic [ref=e131]: /blog
                  - generic [ref=e134]: 1,520
                - generic [ref=e135]:
                  - generic [ref=e136]: /contact
                  - generic [ref=e139]: "870"
            - generic [ref=e140]:
              - paragraph [ref=e141]: Devices
              - generic [ref=e142]:
                - img [ref=e143]
                - generic [ref=e147]:
                  - generic [ref=e148]: Desktop 60%
                  - generic [ref=e150]: Mobile 30%
                  - generic [ref=e152]: Tablet 10%
  - generic [ref=e155]:
    - generic [ref=e156]:
      - heading "Everything you need to understand your users" [level=2] [ref=e157]
      - paragraph [ref=e158]: A complete analytics suite that puts you in control — no third-party dependencies.
    - generic [ref=e159]:
      - generic [ref=e160]:
        - img [ref=e162]
        - heading "Real-Time Analytics" [level=3] [ref=e165]
        - paragraph [ref=e166]: See visitors on your site right now. Track pageviews, sessions, and engagement as they happen.
      - generic [ref=e167]:
        - img [ref=e169]
        - heading "Privacy-First" [level=3] [ref=e171]
        - paragraph [ref=e172]: No cookies, no fingerprinting, no personal data collection. Fully GDPR compliant out of the box.
      - generic [ref=e173]:
        - img [ref=e175]
        - heading "Lightweight Script" [level=3] [ref=e177]
        - paragraph [ref=e178]: Under 2KB tracking script. Zero impact on your site performance — no slowdowns, ever.
      - generic [ref=e179]:
        - img [ref=e181]
        - heading "Country Detection" [level=3] [ref=e184]
        - paragraph [ref=e185]: Automatic visitor country detection using timezone — no external GeoIP services required.
      - generic [ref=e186]:
        - img [ref=e188]
        - heading "Conversion Funnels" [level=3] [ref=e191]
        - paragraph [ref=e192]: Define multi-step funnels to track user journeys from landing to conversion.
      - generic [ref=e193]:
        - img [ref=e195]
        - heading "Multi-Site Support" [level=3] [ref=e199]
        - paragraph [ref=e200]: Manage unlimited websites from a single dashboard. Switch between sites instantly.
  - generic [ref=e202]:
    - generic [ref=e203]:
      - heading "Up and running in 3 steps" [level=2] [ref=e204]
      - paragraph [ref=e205]: From zero to full analytics in under 5 minutes.
    - generic [ref=e206]:
      - generic [ref=e207]:
        - generic [ref=e208]: "01"
        - generic [ref=e209]:
          - img [ref=e211]
          - heading "Create an Account" [level=3] [ref=e216]
        - paragraph [ref=e217]: Sign up and add your first website. Enter your site name and domain — that's it.
      - generic [ref=e218]:
        - generic [ref=e219]: "02"
        - generic [ref=e220]:
          - img [ref=e222]
          - heading "Add Tracking Script" [level=3] [ref=e225]
        - paragraph [ref=e226]: Copy the one-line script tag and paste it into your website's <head>. Under 2KB, no setup needed.
      - generic [ref=e227]:
        - generic [ref=e228]: "03"
        - generic [ref=e229]:
          - img [ref=e231]
          - heading "View Your Dashboard" [level=3] [ref=e234]
        - paragraph [ref=e235]: Traffic, pageviews, sources, devices, countries — all updating in real-time within seconds.
    - generic [ref=e236]:
      - generic [ref=e241]: index.html
      - code [ref=e243]: <head> <!-- One line — that's all you need --> <script src="https://your-server.com/api/sites/YOUR_SITE_ID/script"></script> </head>
  - generic [ref=e245]:
    - generic [ref=e246]:
      - heading "Built for speed & reliability" [level=2] [ref=e247]
      - paragraph [ref=e248]: "Dual-database architecture: PostgreSQL handles writes (tracking, auth), DuckDB powers lightning-fast analytical queries. Auto-synced every 60 seconds."
    - generic [ref=e249]:
      - generic [ref=e250]:
        - img [ref=e251]
        - heading "React 18" [level=4] [ref=e254]
        - paragraph [ref=e255]: Modern dashboard UI
      - generic [ref=e256]:
        - img [ref=e257]
        - heading "Express + Node.js" [level=4] [ref=e260]
        - paragraph [ref=e261]: Rock-solid backend
      - generic [ref=e262]:
        - img [ref=e263]
        - heading "PostgreSQL + DuckDB" [level=4] [ref=e267]
        - paragraph [ref=e268]: Dual-database architecture
      - generic [ref=e269]:
        - img [ref=e270]
        - heading "JWT Auth" [level=4] [ref=e273]
        - paragraph [ref=e274]: Secure authentication
      - generic [ref=e275]:
        - img [ref=e276]
        - heading "Open Source" [level=4] [ref=e280]
        - paragraph [ref=e281]: Self-hosted, full control
      - generic [ref=e282]:
        - img [ref=e283]
        - heading "Auto Sync" [level=4] [ref=e286]
        - paragraph [ref=e287]: PG → DuckDB every 60s
    - generic [ref=e288]:
      - heading "System Architecture" [level=3] [ref=e289]
      - generic [ref=e290]:
        - generic [ref=e291]:
          - generic [ref=e292]:
            - img [ref=e293]
            - generic [ref=e296]:
              - generic [ref=e297]: Your Website
              - generic [ref=e298]: (tracking)
          - generic [ref=e299]:
            - img [ref=e300]
            - generic [ref=e305]:
              - generic [ref=e306]: Dashboard
              - generic [ref=e307]: React SPA · port 5173
        - generic [ref=e308]:
          - generic [ref=e309]:
            - img [ref=e310]
            - generic [ref=e312]: POST /api/track/*
          - generic [ref=e313]:
            - img [ref=e314]
            - generic [ref=e316]: GET /api/analytics/*
        - generic [ref=e317]:
          - generic [ref=e318]:
            - img [ref=e319]
            - generic [ref=e322]:
              - generic [ref=e323]: Unified Backend
              - generic [ref=e324]: Express + Node.js · port 3001
          - generic [ref=e325]:
            - generic [ref=e326]:
              - img [ref=e327]
              - generic [ref=e331]:
                - generic [ref=e332]: PG
                - generic [ref=e333]: (writes)
            - generic [ref=e334]:
              - img [ref=e335]
              - generic [ref=e340]: sync
            - generic [ref=e341]:
              - img [ref=e342]
              - generic [ref=e344]:
                - generic [ref=e345]: DuckDB
                - generic [ref=e346]: (reads)
  - generic [ref=e348]:
    - heading "Why InsightTrack?" [level=2] [ref=e350]
    - table [ref=e352]:
      - rowgroup [ref=e353]:
        - row "Feature InsightTrack Google Analytics" [ref=e354]:
          - columnheader "Feature" [ref=e355]
          - columnheader "InsightTrack" [ref=e356]
          - columnheader "Google Analytics" [ref=e357]
      - rowgroup [ref=e358]:
        - row "Privacy-first (no cookies) —" [ref=e359]:
          - cell "Privacy-first (no cookies)" [ref=e360]
          - cell [ref=e361]:
            - img [ref=e362]
          - cell "—" [ref=e365]
        - row "Self-hosted / own your data —" [ref=e366]:
          - cell "Self-hosted / own your data" [ref=e367]
          - cell [ref=e368]:
            - img [ref=e369]
          - cell "—" [ref=e372]
        - row "Open source —" [ref=e373]:
          - cell "Open source" [ref=e374]
          - cell [ref=e375]:
            - img [ref=e376]
          - cell "—" [ref=e379]
        - row "Lightweight script (<2KB) —" [ref=e380]:
          - cell "Lightweight script (<2KB)" [ref=e381]
          - cell [ref=e382]:
            - img [ref=e383]
          - cell "—" [ref=e386]
        - row "Real-time dashboard" [ref=e387]:
          - cell "Real-time dashboard" [ref=e388]
          - cell [ref=e389]:
            - img [ref=e390]
          - cell [ref=e393]:
            - img [ref=e394]
        - row "No GDPR cookie banner needed —" [ref=e397]:
          - cell "No GDPR cookie banner needed" [ref=e398]
          - cell [ref=e399]:
            - img [ref=e400]
          - cell "—" [ref=e403]
        - row "Conversion funnels" [ref=e404]:
          - cell "Conversion funnels" [ref=e405]
          - cell [ref=e406]:
            - img [ref=e407]
          - cell [ref=e410]:
            - img [ref=e411]
        - row "DuckDB-powered analytics —" [ref=e414]:
          - cell "DuckDB-powered analytics" [ref=e415]
          - cell [ref=e416]:
            - img [ref=e417]
          - cell "—" [ref=e420]
        - row "Free forever —" [ref=e421]:
          - cell "Free forever" [ref=e422]
          - cell [ref=e423]:
            - img [ref=e424]
          - cell "—" [ref=e427]
  - generic [ref=e434]:
    - heading "Ready to take control of your analytics?" [level=2] [ref=e435]
    - paragraph [ref=e436]: Set up in minutes. No credit card required. Own your data, understand your audience.
    - generic [ref=e437]:
      - link "Create Free Account" [ref=e438] [cursor=pointer]:
        - /url: /register
        - text: Create Free Account
        - img [ref=e439]
      - link "Sign In" [ref=e441] [cursor=pointer]:
        - /url: /login
  - contentinfo [ref=e442]:
    - generic [ref=e443]:
      - generic [ref=e444]:
        - img [ref=e446]
        - generic [ref=e448]: InsightTrack
      - generic [ref=e449]:
        - link "Features" [ref=e450] [cursor=pointer]:
          - /url: "#features"
        - link "How It Works" [ref=e451] [cursor=pointer]:
          - /url: "#how-it-works"
        - link "Tech Stack" [ref=e452] [cursor=pointer]:
          - /url: "#tech-stack"
      - paragraph [ref=e453]: © 2026 InsightTrack. Open-source web analytics.
```

# Test source

```ts
  1   | /**
  2   |  * tests/dashboard/analytics-sections.spec.ts
  3   |  * Passmark AI-powered smoke tests for all remaining analytics sections:
  4   |  *   Conversions, Audience, Content, Acquisition, Performance,
  5   |  *   User Flow, Engagement, Reporting, Privacy.
  6   |  *
  7   |  * These tests verify that each page renders without an uncaught JS error,
  8   |  * shows its section heading, and has either data or a meaningful empty state.
  9   |  */
  10  | import { test, expect } from '@playwright/test';
  11  | import { runSteps } from 'passmark';
  12  | import { createTestSession, injectAuth } from '../../helpers/auth.js';
  13  | 
  14  | let _session: Awaited<ReturnType<typeof createTestSession>>;
  15  | 
  16  | test.beforeAll(async ({ request }) => {
  17  |   _session = await createTestSession(request, 'analytics-sections');
  18  | });
  19  | 
  20  | test.beforeEach(async ({ page }) => {
  21  |   await injectAuth(page, _session);
  22  | });
  23  | 
  24  | // ─── Conversions ──────────────────────────────────────────────────────────────
  25  | 
  26  | test.describe('Conversions (/conversions)', () => {
  27  |   test('renders heading and conversion metrics', async ({ page }) => {
  28  |     test.setTimeout(240_000);
  29  |     await runSteps({
  30  |       page,
  31  |       userFlow: 'Conversions section smoke test',
  32  |       steps: [
  33  |         {
  34  |           description: 'Navigate to /conversions',
  35  |           waitUntil: 'A heading containing the word Conversions is visible',
  36  |         },
  37  |       ],
  38  |       assertions: [
  39  |         { assertion: 'A heading with "Conversions" or "Conversions & Funnels" is visible' },
  40  |         {
  41  |           assertion:
  42  |             'Conversion goal metrics, a table, a chart, or an empty-state message is visible',
  43  |         },
  44  |       ],
  45  |       test,
  46  |       expect,
  47  |     });
  48  |   });
  49  | });
  50  | 
  51  | // ─── Audience ─────────────────────────────────────────────────────────────────
  52  | 
  53  | test.describe('Audience (/audience)', () => {
  54  |   test('renders heading and audience breakdown', async ({ page }) => {
  55  |     test.setTimeout(240_000);
> 56  |     await runSteps({
      |     ^ Error: The accessibility snapshot and current URL do not show any heading with text similar to 'Audience' or 'New vs Returning Visitors'. Therefore, the assertion that such a heading is visible does not hold based on the provided data.
  57  |       page,
  58  |       userFlow: 'Audience section smoke test',
  59  |       steps: [
  60  |         {
  61  |           description: 'Navigate to /audience',
  62  |           waitUntil: 'An "Audience" heading or an "New vs Returning Visitors" section heading is visible',
  63  |         },
  64  |       ],
  65  |       assertions: [
  66  |         { assertion: 'An "Audience" heading OR a "New vs Returning Visitors" heading is visible' },
  67  |         {
  68  |           assertion:
  69  |             'Device type, browser, or location breakdown charts or tables are visible, OR an empty-state placeholder',
  70  |         },
  71  |       ],
  72  |       test,
  73  |       expect,
  74  |     });
  75  |   });
  76  | });
  77  | 
  78  | // ─── Content ──────────────────────────────────────────────────────────────────
  79  | 
  80  | test.describe('Content (/content)', () => {
  81  |   test('renders heading and content analytics', async ({ page }) => {
  82  |     test.setTimeout(240_000);
  83  |     await runSteps({
  84  |       page,
  85  |       userFlow: 'Content section smoke test',
  86  |       steps: [
  87  |         {
  88  |           description: 'Navigate to /content',
  89  |           waitUntil: 'A heading containing the word Content is visible',
  90  |         },
  91  |       ],
  92  |       assertions: [
  93  |         { assertion: 'A "Content Analytics" or "Content" heading is visible' },
  94  |         {
  95  |           assertion:
  96  |             'Content performance data, top articles, or an empty-state placeholder is visible',
  97  |         },
  98  |       ],
  99  |       test,
  100 |       expect,
  101 |     });
  102 |   });
  103 | });
  104 | 
  105 | // ─── Acquisition ──────────────────────────────────────────────────────────────
  106 | 
  107 | test.describe('Acquisition (/acquisition)', () => {
  108 |   test('renders heading and traffic source breakdown', async ({ page }) => {
  109 |     test.setTimeout(240_000);
  110 |     await runSteps({
  111 |       page,
  112 |       userFlow: 'Acquisition section smoke test',
  113 |       steps: [
  114 |         {
  115 |           description: 'Navigate to /acquisition',
  116 |           waitUntil: 'An "Acquisition" heading is visible',
  117 |         },
  118 |       ],
  119 |       assertions: [
  120 |         { assertion: 'An "Acquisition" heading is visible' },
  121 |         {
  122 |           assertion:
  123 |             'Traffic source charts (direct, referral, social, organic) or an empty-state placeholder is visible',
  124 |         },
  125 |       ],
  126 |       test,
  127 |       expect,
  128 |     });
  129 |   });
  130 | });
  131 | 
  132 | // ─── Performance ──────────────────────────────────────────────────────────────
  133 | 
  134 | test.describe('Performance (/performance)', () => {
  135 |   test('renders heading and performance metrics', async ({ page }) => {
  136 |     test.setTimeout(240_000);
  137 |     await runSteps({
  138 |       page,
  139 |       userFlow: 'Performance section smoke test',
  140 |       steps: [
  141 |         {
  142 |           description: 'Navigate to /performance',
  143 |           waitUntil: 'A "Performance" heading is visible',
  144 |         },
  145 |       ],
  146 |       assertions: [
  147 |         { assertion: 'A "Performance" heading is visible' },
  148 |         {
  149 |           assertion:
  150 |             'Page load time, LCP, TTFB, or other web vitals metrics, OR an empty-state placeholder is visible',
  151 |         },
  152 |       ],
  153 |       test,
  154 |       expect,
  155 |     });
  156 |   });
```