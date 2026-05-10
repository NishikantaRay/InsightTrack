# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard/analytics-sections.spec.ts >> Privacy (/privacy) >> renders heading and privacy controls
- Location: tests/dashboard/analytics-sections.spec.ts:243:3

# Error details

```
Error: The accessibility snapshot and current URL do not show any heading with the text 'Privacy & Compliance' or 'Privacy'. Although there is a section with a heading 'Privacy-First', it does not exactly match the assertion's requested headings. Therefore, the assertion should not pass, but the presence of a related heading gives a low confidence score.

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
  157 | });
  158 | 
  159 | // ─── User Flow ────────────────────────────────────────────────────────────────
  160 | 
  161 | test.describe('User Flow (/user-flow)', () => {
  162 |   test('renders heading and flow visualization', async ({ page }) => {
  163 |     test.setTimeout(240_000);
  164 |     await runSteps({
  165 |       page,
  166 |       userFlow: 'User Flow section smoke test',
  167 |       steps: [
  168 |         {
  169 |           description: 'Navigate to /user-flow',
  170 |           waitUntil: 'A "User Flow" heading is visible',
  171 |         },
  172 |       ],
  173 |       assertions: [
  174 |         { assertion: 'A "User Flow" heading is visible' },
  175 |         {
  176 |           assertion:
  177 |             'A flow diagram, Sankey chart, tree visualisation, or an empty-state message is visible',
  178 |         },
  179 |       ],
  180 |       test,
  181 |       expect,
  182 |     });
  183 |   });
  184 | });
  185 | 
  186 | // ─── Engagement ───────────────────────────────────────────────────────────────
  187 | 
  188 | test.describe('Engagement (/engagement)', () => {
  189 |   test('renders heading and engagement metrics', async ({ page }) => {
  190 |     test.setTimeout(240_000);
  191 |     await runSteps({
  192 |       page,
  193 |       userFlow: 'Engagement section smoke test',
  194 |       steps: [
  195 |         {
  196 |           description: 'Navigate to /engagement',
  197 |           waitUntil: 'An "Engagement" heading is visible',
  198 |         },
  199 |       ],
  200 |       assertions: [
  201 |         { assertion: 'An "Engagement" heading is visible' },
  202 |         {
  203 |           assertion:
  204 |             'Scroll depth, click heatmap, time on page, or other engagement metrics OR an empty-state placeholder is visible',
  205 |         },
  206 |       ],
  207 |       test,
  208 |       expect,
  209 |     });
  210 |   });
  211 | });
  212 | 
  213 | // ─── Reporting ────────────────────────────────────────────────────────────────
  214 | 
  215 | test.describe('Reporting (/reporting)', () => {
  216 |   test('renders heading and report controls', async ({ page }) => {
  217 |     test.setTimeout(240_000);
  218 |     await runSteps({
  219 |       page,
  220 |       userFlow: 'Reporting section smoke test',
  221 |       steps: [
  222 |         {
  223 |           description: 'Navigate to /reporting',
  224 |           waitUntil: 'A "Reporting" heading is visible',
  225 |         },
  226 |       ],
  227 |       assertions: [
  228 |         { assertion: 'A "Reporting" heading is visible' },
  229 |         {
  230 |           assertion:
  231 |             'Report download buttons, scheduled report controls, date range selectors, or an empty-state message is visible',
  232 |         },
  233 |       ],
  234 |       test,
  235 |       expect,
  236 |     });
  237 |   });
  238 | });
  239 | 
  240 | // ─── Privacy ──────────────────────────────────────────────────────────────────
  241 | 
  242 | test.describe('Privacy (/privacy)', () => {
  243 |   test('renders heading and privacy controls', async ({ page }) => {
  244 |     test.setTimeout(240_000);
> 245 |     await runSteps({
      |     ^ Error: The accessibility snapshot and current URL do not show any heading with the text 'Privacy & Compliance' or 'Privacy'. Although there is a section with a heading 'Privacy-First', it does not exactly match the assertion's requested headings. Therefore, the assertion should not pass, but the presence of a related heading gives a low confidence score.
  246 |       page,
  247 |       userFlow: 'Privacy section smoke test',
  248 |       steps: [
  249 |         {
  250 |           description: 'Navigate to /privacy',
  251 |           waitUntil: 'A heading containing the word Privacy is visible',
  252 |         },
  253 |       ],
  254 |       assertions: [
  255 |         { assertion: 'A "Privacy & Compliance" or "Privacy" heading is visible' },
  256 |         {
  257 |           assertion:
  258 |             'Data retention settings, GDPR compliance info, anonymisation options, or a privacy policy section is visible',
  259 |         },
  260 |       ],
  261 |       test,
  262 |       expect,
  263 |     });
  264 |   });
  265 | });
  266 | 
```