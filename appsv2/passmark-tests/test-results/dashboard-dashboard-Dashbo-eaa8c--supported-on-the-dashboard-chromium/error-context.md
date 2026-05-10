# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/dashboard.spec.ts >> Dashboard — main analytics overview >> dark mode is supported on the dashboard
- Location: tests/dashboard/dashboard.spec.ts:150:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('div.dark').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('div.dark').first()

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
        - button "Toggle theme" [active] [ref=e18] [cursor=pointer]:
          - img [ref=e19]
        - link "Sign In" [ref=e25] [cursor=pointer]:
          - /url: /login
        - link "Get Started" [ref=e26] [cursor=pointer]:
          - /url: /register
  - generic [ref=e30]:
    - generic [ref=e33]: Open-Source & Self-Hosted
    - heading "Web analytics that respect your users" [level=1] [ref=e34]:
      - text: Web analytics that
      - text: respect your users
    - paragraph [ref=e35]: Powerful, real-time website analytics without cookies or personal data tracking. Self-hosted, open source, and blazingly fast with DuckDB-powered queries.
    - generic [ref=e36]:
      - link "Start Tracking Free" [ref=e37] [cursor=pointer]:
        - /url: /register
        - text: Start Tracking Free
        - img [ref=e38]
      - link "See How It Works" [ref=e40] [cursor=pointer]:
        - /url: "#how-it-works"
    - generic [ref=e42]:
      - generic [ref=e47]: localhost:5173
      - generic [ref=e48]:
        - generic [ref=e49]:
          - generic [ref=e50]:
            - img [ref=e52]
            - generic [ref=e54]: InsightTrack
          - generic [ref=e55]: Dashboard
          - generic [ref=e56]: Pages
          - generic [ref=e57]: Funnels
          - generic [ref=e58]: Realtime
          - generic [ref=e59]: Settings
        - generic [ref=e60]:
          - generic [ref=e61]:
            - generic [ref=e62]: Dashboard
            - generic [ref=e63]:
              - generic [ref=e64]: Today
              - generic [ref=e65]: 7d
              - generic [ref=e66]: 30d
              - generic [ref=e67]: 90d
          - generic [ref=e68]:
            - generic [ref=e69]:
              - paragraph [ref=e70]: Visitors
              - paragraph [ref=e71]: 12,847
              - text: ↑ 12.3%
              - img [ref=e72]
            - generic [ref=e74]:
              - paragraph [ref=e75]: Pageviews
              - paragraph [ref=e76]: 34,201
              - text: ↑ 8.7%
              - img [ref=e77]
            - generic [ref=e79]:
              - paragraph [ref=e80]: Bounce Rate
              - paragraph [ref=e81]: 42.5%
              - text: ↓ 2.1%
              - img [ref=e82]
            - generic [ref=e84]:
              - paragraph [ref=e85]: Avg. Duration
              - paragraph [ref=e86]: 3m 05s
              - text: ↑ 5.4%
              - img [ref=e87]
          - generic [ref=e89]:
            - generic [ref=e90]:
              - paragraph [ref=e91]: Traffic Over Time
              - img [ref=e92]
            - generic [ref=e96]:
              - paragraph [ref=e97]: Traffic Sources
              - generic [ref=e98]:
                - img [ref=e99]
                - generic [ref=e105]:
                  - generic [ref=e106]: Direct 35%
                  - generic [ref=e108]: Google 20%
                  - generic [ref=e110]: Social 15%
                  - generic [ref=e112]: Referral 13%
                  - generic [ref=e114]: Email 8%
            - generic [ref=e116]:
              - paragraph [ref=e117]: Top Pages
              - generic [ref=e118]:
                - generic [ref=e119]:
                  - generic [ref=e120]: /home
                  - generic [ref=e123]: 4,230
                - generic [ref=e124]:
                  - generic [ref=e125]: /pricing
                  - generic [ref=e128]: 2,810
                - generic [ref=e129]:
                  - generic [ref=e130]: /about
                  - generic [ref=e133]: 1,940
                - generic [ref=e134]:
                  - generic [ref=e135]: /blog
                  - generic [ref=e138]: 1,520
                - generic [ref=e139]:
                  - generic [ref=e140]: /contact
                  - generic [ref=e143]: "870"
            - generic [ref=e144]:
              - paragraph [ref=e145]: Devices
              - generic [ref=e146]:
                - img [ref=e147]
                - generic [ref=e151]:
                  - generic [ref=e152]: Desktop 60%
                  - generic [ref=e154]: Mobile 30%
                  - generic [ref=e156]: Tablet 10%
  - generic [ref=e159]:
    - generic [ref=e160]:
      - heading "Everything you need to understand your users" [level=2] [ref=e161]
      - paragraph [ref=e162]: A complete analytics suite that puts you in control — no third-party dependencies.
    - generic [ref=e163]:
      - generic [ref=e164]:
        - img [ref=e166]
        - heading "Real-Time Analytics" [level=3] [ref=e169]
        - paragraph [ref=e170]: See visitors on your site right now. Track pageviews, sessions, and engagement as they happen.
      - generic [ref=e171]:
        - img [ref=e173]
        - heading "Privacy-First" [level=3] [ref=e175]
        - paragraph [ref=e176]: No cookies, no fingerprinting, no personal data collection. Fully GDPR compliant out of the box.
      - generic [ref=e177]:
        - img [ref=e179]
        - heading "Lightweight Script" [level=3] [ref=e181]
        - paragraph [ref=e182]: Under 2KB tracking script. Zero impact on your site performance — no slowdowns, ever.
      - generic [ref=e183]:
        - img [ref=e185]
        - heading "Country Detection" [level=3] [ref=e188]
        - paragraph [ref=e189]: Automatic visitor country detection using timezone — no external GeoIP services required.
      - generic [ref=e190]:
        - img [ref=e192]
        - heading "Conversion Funnels" [level=3] [ref=e195]
        - paragraph [ref=e196]: Define multi-step funnels to track user journeys from landing to conversion.
      - generic [ref=e197]:
        - img [ref=e199]
        - heading "Multi-Site Support" [level=3] [ref=e203]
        - paragraph [ref=e204]: Manage unlimited websites from a single dashboard. Switch between sites instantly.
  - generic [ref=e206]:
    - generic [ref=e207]:
      - heading "Up and running in 3 steps" [level=2] [ref=e208]
      - paragraph [ref=e209]: From zero to full analytics in under 5 minutes.
    - generic [ref=e210]:
      - generic [ref=e211]:
        - generic [ref=e212]: "01"
        - generic [ref=e213]:
          - img [ref=e215]
          - heading "Create an Account" [level=3] [ref=e220]
        - paragraph [ref=e221]: Sign up and add your first website. Enter your site name and domain — that's it.
      - generic [ref=e222]:
        - generic [ref=e223]: "02"
        - generic [ref=e224]:
          - img [ref=e226]
          - heading "Add Tracking Script" [level=3] [ref=e229]
        - paragraph [ref=e230]: Copy the one-line script tag and paste it into your website's <head>. Under 2KB, no setup needed.
      - generic [ref=e231]:
        - generic [ref=e232]: "03"
        - generic [ref=e233]:
          - img [ref=e235]
          - heading "View Your Dashboard" [level=3] [ref=e238]
        - paragraph [ref=e239]: Traffic, pageviews, sources, devices, countries — all updating in real-time within seconds.
    - generic [ref=e240]:
      - generic [ref=e245]: index.html
      - code [ref=e247]: <head> <!-- One line — that's all you need --> <script src="https://your-server.com/api/sites/YOUR_SITE_ID/script"></script> </head>
  - generic [ref=e249]:
    - generic [ref=e250]:
      - heading "Built for speed & reliability" [level=2] [ref=e251]
      - paragraph [ref=e252]: "Dual-database architecture: PostgreSQL handles writes (tracking, auth), DuckDB powers lightning-fast analytical queries. Auto-synced every 60 seconds."
    - generic [ref=e253]:
      - generic [ref=e254]:
        - img [ref=e255]
        - heading "React 18" [level=4] [ref=e258]
        - paragraph [ref=e259]: Modern dashboard UI
      - generic [ref=e260]:
        - img [ref=e261]
        - heading "Express + Node.js" [level=4] [ref=e264]
        - paragraph [ref=e265]: Rock-solid backend
      - generic [ref=e266]:
        - img [ref=e267]
        - heading "PostgreSQL + DuckDB" [level=4] [ref=e271]
        - paragraph [ref=e272]: Dual-database architecture
      - generic [ref=e273]:
        - img [ref=e274]
        - heading "JWT Auth" [level=4] [ref=e277]
        - paragraph [ref=e278]: Secure authentication
      - generic [ref=e279]:
        - img [ref=e280]
        - heading "Open Source" [level=4] [ref=e284]
        - paragraph [ref=e285]: Self-hosted, full control
      - generic [ref=e286]:
        - img [ref=e287]
        - heading "Auto Sync" [level=4] [ref=e290]
        - paragraph [ref=e291]: PG → DuckDB every 60s
    - generic [ref=e292]:
      - heading "System Architecture" [level=3] [ref=e293]
      - generic [ref=e294]:
        - generic [ref=e295]:
          - generic [ref=e296]:
            - img [ref=e297]
            - generic [ref=e300]:
              - generic [ref=e301]: Your Website
              - generic [ref=e302]: (tracking)
          - generic [ref=e303]:
            - img [ref=e304]
            - generic [ref=e309]:
              - generic [ref=e310]: Dashboard
              - generic [ref=e311]: React SPA · port 5173
        - generic [ref=e312]:
          - generic [ref=e313]:
            - img [ref=e314]
            - generic [ref=e316]: POST /api/track/*
          - generic [ref=e317]:
            - img [ref=e318]
            - generic [ref=e320]: GET /api/analytics/*
        - generic [ref=e321]:
          - generic [ref=e322]:
            - img [ref=e323]
            - generic [ref=e326]:
              - generic [ref=e327]: Unified Backend
              - generic [ref=e328]: Express + Node.js · port 3001
          - generic [ref=e329]:
            - generic [ref=e330]:
              - img [ref=e331]
              - generic [ref=e335]:
                - generic [ref=e336]: PG
                - generic [ref=e337]: (writes)
            - generic [ref=e338]:
              - img [ref=e339]
              - generic [ref=e344]: sync
            - generic [ref=e345]:
              - img [ref=e346]
              - generic [ref=e348]:
                - generic [ref=e349]: DuckDB
                - generic [ref=e350]: (reads)
  - generic [ref=e352]:
    - heading "Why InsightTrack?" [level=2] [ref=e354]
    - table [ref=e356]:
      - rowgroup [ref=e357]:
        - row "Feature InsightTrack Google Analytics" [ref=e358]:
          - columnheader "Feature" [ref=e359]
          - columnheader "InsightTrack" [ref=e360]
          - columnheader "Google Analytics" [ref=e361]
      - rowgroup [ref=e362]:
        - row "Privacy-first (no cookies) —" [ref=e363]:
          - cell "Privacy-first (no cookies)" [ref=e364]
          - cell [ref=e365]:
            - img [ref=e366]
          - cell "—" [ref=e369]
        - row "Self-hosted / own your data —" [ref=e370]:
          - cell "Self-hosted / own your data" [ref=e371]
          - cell [ref=e372]:
            - img [ref=e373]
          - cell "—" [ref=e376]
        - row "Open source —" [ref=e377]:
          - cell "Open source" [ref=e378]
          - cell [ref=e379]:
            - img [ref=e380]
          - cell "—" [ref=e383]
        - row "Lightweight script (<2KB) —" [ref=e384]:
          - cell "Lightweight script (<2KB)" [ref=e385]
          - cell [ref=e386]:
            - img [ref=e387]
          - cell "—" [ref=e390]
        - row "Real-time dashboard" [ref=e391]:
          - cell "Real-time dashboard" [ref=e392]
          - cell [ref=e393]:
            - img [ref=e394]
          - cell [ref=e397]:
            - img [ref=e398]
        - row "No GDPR cookie banner needed —" [ref=e401]:
          - cell "No GDPR cookie banner needed" [ref=e402]
          - cell [ref=e403]:
            - img [ref=e404]
          - cell "—" [ref=e407]
        - row "Conversion funnels" [ref=e408]:
          - cell "Conversion funnels" [ref=e409]
          - cell [ref=e410]:
            - img [ref=e411]
          - cell [ref=e414]:
            - img [ref=e415]
        - row "DuckDB-powered analytics —" [ref=e418]:
          - cell "DuckDB-powered analytics" [ref=e419]
          - cell [ref=e420]:
            - img [ref=e421]
          - cell "—" [ref=e424]
        - row "Free forever —" [ref=e425]:
          - cell "Free forever" [ref=e426]
          - cell [ref=e427]:
            - img [ref=e428]
          - cell "—" [ref=e431]
  - generic [ref=e438]:
    - heading "Ready to take control of your analytics?" [level=2] [ref=e439]
    - paragraph [ref=e440]: Set up in minutes. No credit card required. Own your data, understand your audience.
    - generic [ref=e441]:
      - link "Create Free Account" [ref=e442] [cursor=pointer]:
        - /url: /register
        - text: Create Free Account
        - img [ref=e443]
      - link "Sign In" [ref=e445] [cursor=pointer]:
        - /url: /login
  - contentinfo [ref=e446]:
    - generic [ref=e447]:
      - generic [ref=e448]:
        - img [ref=e450]
        - generic [ref=e452]: InsightTrack
      - generic [ref=e453]:
        - link "Features" [ref=e454] [cursor=pointer]:
          - /url: "#features"
        - link "How It Works" [ref=e455] [cursor=pointer]:
          - /url: "#how-it-works"
        - link "Tech Stack" [ref=e456] [cursor=pointer]:
          - /url: "#tech-stack"
      - paragraph [ref=e457]: © 2026 InsightTrack. Open-source web analytics.
```

# Test source

```ts
  68  | 
  69  |   test('refresh button triggers data reload', async ({ page }) => {
  70  |     test.setTimeout(240_000);
  71  | 
  72  |     await runSteps({
  73  |       page,
  74  |       userFlow: 'Dashboard refresh button',
  75  |       steps: [
  76  |         { description: 'Navigate to /' },
  77  |         {
  78  |           description: 'Wait for the dashboard to load',
  79  |           waitUntil: 'The Dashboard heading is visible',
  80  |         },
  81  |         {
  82  |           description: 'Click the refresh or reload button (typically a rotating arrows icon)',
  83  |         },
  84  |         {
  85  |           description: 'Wait for the refresh to complete',
  86  |           waitUntil: 'The loading spinner disappears or the data reloads',
  87  |         },
  88  |       ],
  89  |       assertions: [
  90  |         { assertion: 'The dashboard content is still visible after the refresh' },
  91  |         { assertion: 'No error message has appeared after refreshing' },
  92  |       ],
  93  |       test,
  94  |       expect,
  95  |     });
  96  |   });
  97  | 
  98  |   test('PageNote info box can be expanded and collapsed', async ({ page }) => {
  99  |     test.setTimeout(240_000);
  100 | 
  101 |     await runSteps({
  102 |       page,
  103 |       userFlow: 'Dashboard PageNote accordion',
  104 |       steps: [
  105 |         { description: 'Navigate to /' },
  106 |         {
  107 |           description: 'Wait until the PageNote summary or "What is the Dashboard?" text is visible',
  108 |           waitUntil: 'An informational note or info box about the Dashboard is visible',
  109 |         },
  110 |         {
  111 |           description: 'Click the "What is the Dashboard?" info note to expand or collapse it',
  112 |         },
  113 |       ],
  114 |       assertions: [
  115 |         {
  116 |           assertion:
  117 |             'The info note or accordion panel has toggled — it is now either expanded showing details or collapsed',
  118 |         },
  119 |       ],
  120 |       test,
  121 |       expect,
  122 |     });
  123 |   });
  124 | 
  125 |   test('sidebar navigation links are visible', async ({ page }) => {
  126 |     test.setTimeout(240_000);
  127 | 
  128 |     await runSteps({
  129 |       page,
  130 |       userFlow: 'Dashboard sidebar presence',
  131 |       steps: [
  132 |         { description: 'Navigate to /' },
  133 |         {
  134 |           description: 'Wait until the page has loaded',
  135 |           waitUntil: 'The sidebar or navigation menu is visible',
  136 |         },
  137 |       ],
  138 |       assertions: [
  139 |         { assertion: 'A sidebar or left navigation panel with links is visible' },
  140 |         { assertion: 'The InsightTrack logo or brand name is visible in the sidebar' },
  141 |         { assertion: 'A "Pages" navigation link is present in the sidebar' },
  142 |         { assertion: 'A "Realtime" navigation link is present in the sidebar' },
  143 |         { assertion: 'A "Settings" navigation link is present in the sidebar' },
  144 |       ],
  145 |       test,
  146 |       expect,
  147 |     });
  148 |   });
  149 | 
  150 |   test('dark mode is supported on the dashboard', async ({ page }) => {
  151 |     test.setTimeout(240_000);
  152 | 
  153 |     // Navigate and wait for load — the theme toggle has aria-label="Toggle theme"
  154 |     await page.goto('/');
  155 |     await page.waitForSelector('h1, h2', { timeout: 15_000 });
  156 | 
  157 |     const toggle = page.getByRole('button', { name: 'Toggle theme' });
  158 |     await expect(toggle).toBeVisible({ timeout: 10_000 });
  159 | 
  160 |     // Read current theme from localStorage to know direction of toggle
  161 |     const currentTheme = await page.evaluate(() => localStorage.getItem('analytics-theme') ?? 'light');
  162 | 
  163 |     await toggle.click();
  164 | 
  165 |     // App.jsx renders <div class="dark"> when dark mode is active
  166 |     if (currentTheme === 'light') {
  167 |       // Toggling light → dark: a div.dark wrapper should appear
> 168 |       await expect(page.locator('div.dark').first()).toBeVisible({ timeout: 5_000 });
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  169 |     } else {
  170 |       // Toggling dark → light: the div.dark wrapper should disappear
  171 |       await expect(page.locator('div.dark').first()).not.toBeVisible({ timeout: 5_000 });
  172 |     }
  173 |   });
  174 | });
  175 | 
```