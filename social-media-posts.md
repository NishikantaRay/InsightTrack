# Social Media Posts — InsightTrack Feature Highlights

---

## 🌍 GeoIP Country Detection (Server-Side)

**Post 1 (Twitter/X)**
> InsightTrack now resolves visitor countries server-side via GeoIP — not guessed from browser timezone 🌍
> Accurate. Private. No JS bloat. The tracking script sends zero location data — your server derives it from the request IP.
> #WebAnalytics #GeoIP #Privacy #SelfHosted #OpenSource

**Post 2 (LinkedIn)**
> We just upgraded how InsightTrack detects visitor geography 🌐
> Previously, the tracking script mapped the browser's timezone to a country name — clever, but imprecise (Europe/London ≠ always United Kingdom).
> Now, country detection happens entirely server-side using GeoIP lookup against the request IP. Benefits:
> ✅ More accurate — IP geolocation beats timezone inference
> ✅ Less JS — client sends no country field at all
> ✅ More private — no timezone exposed to third parties
> ✅ City + region data available, not just country
> All powered by a local GeoLite database. No external API calls. Your data stays on your server.
> #Analytics #GeoIP #Privacy #SelfHosted #WebDev #OpenSource

**Post 3 (Instagram caption)**
> Where are your visitors really from? 🌍
> InsightTrack now figures that out server-side — using GeoIP on the request IP instead of guessing from the browser timezone.
> More accurate. Less data sent from the browser. City-level resolution. All local, all yours 🔒
> .
> .
> #WebAnalytics #GeoIP #Privacy #SelfHosted #OpenSource #IndieHacker #Analytics #WebDev

---

## 🗺️ Click Heatmap

**Post 1 (Twitter/X)**
> Stop guessing where your users click. InsightTrack's Click Heatmap shows you every tap, every rage click, and every dead zone — visualised in real time on your actual page layout. No sampling. No data leaving your server. 🔥
> #WebAnalytics #UX #OpenSource #SelfHosted

**Post 2 (LinkedIn)**
> We just shipped Click Heatmap for InsightTrack 🗺️
> See exactly which elements your visitors interact with — and which ones they rage-click when things don't work. The heatmap overlays click density directly on your page, coloured from cool blue (low activity) to hot red (high activity).
> Built for teams who want the clarity of commercial tools but the privacy of self-hosted infrastructure.
> 👉 Try it on your own server — no tracking pixels, no third parties.

**Post 3 (Instagram caption)**
> Your analytics just got visual 👁️
> InsightTrack now shows you a live heatmap of every click across your pages. Spot your best CTAs, fix ignored buttons, and find the rage-click dead zones before your users give up.
> Self-hosted. Private. Yours. 💡
> .
> .
> #Analytics #Heatmap #ProductDesign #WebDev #OpenSource #Privacy #UX #NoCode

---

## 📊 Engagement Analytics (Scroll Depth · Rage Clicks · Time on Page)

**Post 1 (Twitter/X)**
> New in InsightTrack: full Engagement Analytics 📊
> → Scroll depth milestones (25 / 50 / 75 / 100%)
> → Rage click detection (3+ clicks in 1s)
> → Time on page per URL (avg, median, min, max)
> Know exactly where readers drop off and where they lose their patience. No cloud required.

**Post 2 (LinkedIn)**
> Does your audience actually read past the fold?
> InsightTrack's Engagement dashboard answers that with three powerful signals:
> ✅ Scroll Depth — see what % of visitors reached the 25%, 50%, 75%, and 100% mark on every page
> ✅ Rage Clicks — detect frustration before it turns into a bounce
> ✅ Time on Page — average and median seconds per URL, not just session-level averages
> All of this runs entirely on your infrastructure. Your data never leaves your servers.
> #Analytics #CRO #UserExperience #SelfHosted #Privacy

**Post 3 (Instagram caption)**
> Do your visitors actually scroll? 🤔
> InsightTrack now tracks scroll depth milestones on every page — and flags the moments users rage-click out of frustration. Pair that with per-page time-on-page stats and you've got a complete picture of engagement.
> All self-hosted. All yours 🔒
> .
> .
> #WebAnalytics #ScrollDepth #UX #IndieHacker #Privacy #OpenSource #ProductMetrics

---

## ⚡ Web Vitals & Performance

**Post 1 (Twitter/X)**
> InsightTrack now tracks Core Web Vitals from real user sessions ⚡
> LCP · FID · CLS · INP · TTFB — measured in your users' browsers, stored on your server, visualised per page.
> p75 scores. Good / Needs Work / Poor thresholds. JS error tracking with affected user counts.
> Zero third-party dependencies.

**Post 2 (LinkedIn)**
> Core Web Vitals matter for SEO and UX — but most analytics tools either send that data to a third party or don't track it at all.
> InsightTrack now captures LCP, FID, CLS, INP, and TTFB directly from real user sessions. Every metric is:
> 📌 Stored in your own DuckDB analytics layer
> 📌 Broken down per page with p75 percentile scores
> 📌 Colour-coded Good / Needs Work / Poor against Google's thresholds
> Plus a full JS Error log with file, line, occurrence count, and affected user count — so you catch regressions before your users report them.
> #WebVitals #CoreWebVitals #SEO #Performance #SelfHosted #OpenSource

**Post 3 (Instagram caption)**
> Is your site actually fast? Not "fast on your MacBook" fast — fast for real users on real connections 📡
> InsightTrack measures Core Web Vitals (LCP, CLS, INP, TTFB) straight from your visitors' browsers and shows you p75 scores per page with clear Good / Poor thresholds.
> Self-hosted performance monitoring. No Google. No third parties. 💪
> .
> .
> #WebVitals #PageSpeed #CoreWebVitals #WebPerformance #SEO #OpenSource #Privacy #IndieHacker

---

## 🛢️ SQL Editor

**Post 1 (Twitter/X)**
> InsightTrack now ships with a built-in SQL Editor 🛢️
> Query your analytics data directly — raw DuckDB SQL, auto-complete, live results table, CSV export. No BI tool needed. No data leaves your server.
> Write the query. Get the answer. That's it.
> #SQL #Analytics #DuckDB #SelfHosted #OpenSource #DataEngineering

**Post 2 (LinkedIn)**
> Sometimes dashboards don't answer the exact question you have. That's why we built the SQL Editor in InsightTrack 🛢️
> It gives you direct read access to your DuckDB analytics layer — the same fast columnar store that powers all dashboard queries. What you get:
> ✅ Full DuckDB SQL — window functions, CTEs, aggregations, the works
> ✅ Auto-complete for table and column names
> ✅ Live paginated results table
> ✅ One-click CSV export
> ✅ Read-only sandbox — no accidental writes
> ✅ Query history saved across sessions
> Your data. Your questions. Your answers. No middleware.
> #SQL #Analytics #DuckDB #SelfHosted #DataAnalysis #OpenSource #BusinessIntelligence

**Post 3 (Instagram caption)**
> What if you could just ask your analytics database anything? 🛢️
> InsightTrack's SQL Editor lets you write raw DuckDB queries against your own data — full auto-complete, instant results, CSV export.
> No BI subscriptions. No data exports to third parties. Just SQL. 🔒
> .
> .
> #SQL #Analytics #DuckDB #DataAnalysis #SelfHosted #OpenSource #IndieHacker #Privacy #NoCode

---

## 💾 Dashboard Builder — Layout Persistence Fix

**Post 1 (Twitter/X)**
> Fixed a frustrating bug in InsightTrack's Dashboard Builder 💾
> Custom widget layouts were being lost on every page refresh. Root cause: the save path wasn't embedding pixel positions before writing to the DB, and the load path rebuilt layout from scratch ignoring saved positions.
> Both fixed. Your canvas layout now survives refreshes, logouts, and container restarts.
> #BugFix #Analytics #DashboardBuilder #SelfHosted #OpenSource

**Post 2 (LinkedIn)**
> We tracked down and fixed a persistent bug in InsightTrack's Custom Dashboard Builder 🔧
> The symptom: drag widgets around, click Save Layout, refresh — positions reset to defaults.
> The cause was a three-part failure:
> ① `handleSave` computed layout from a stale closure instead of the latest ref values
> ② The edit view never populated `layoutMap` for newly added widgets before saving
> ③ `buildPixelLayout` blindly trusted a truthy `px` field even when it contained `null` coordinates
> All three are now fixed. Widget positions are embedded into the JSONB payload before every save — manual or autosave — and restored exactly on load.
> #BugFix #WebDev #React #Analytics #DashboardBuilder #SelfHosted

**Post 3 (Instagram caption)**
> Your custom dashboard layout now actually saves 🙌
> Fixed a tricky bug in InsightTrack where drag-and-drop widget positions were lost on every refresh. Positions are now embedded directly in each widget before saving and restored precisely on load.
> No more rebuilding your layout every morning ✅
> .
> .
> #Analytics #DashboardBuilder #BugFix #SelfHosted #OpenSource #WebDev #IndieHacker

---

## 🔗 Public Share Links — Works in Incognito

**Post 1 (Twitter/X)**
> InsightTrack custom dashboards now generate truly public share links 🔗
> Open in incognito, send to a stakeholder, embed anywhere — no login required.
> How it works: when you click Share, we snapshot your widget data (live API calls with your auth), encode it into the URL as base64, and serve a public /share route that needs zero authentication.
> Charts show real data. No backend calls from the viewer's side.
> #Analytics #SaaS #DashboardSharing #OpenSource #SelfHosted

**Post 2 (LinkedIn)**
> InsightTrack now supports truly public dashboard sharing 🔗
> Previously, the share URL pointed to /reporting?dash=TOKEN — which required authentication. Opening it in incognito mode just redirected to the landing page.
> We fixed this properly:
> ✅ New public /share route — completely outside the auth layer
> ✅ Widget data is snapshot at share time (live fetch with your session), embedded in the token
> ✅ Charts render from the snapshot — no API calls needed from the viewer
> ✅ Text notes, KPI cards, area/bar/pie charts, data tables — all render in the shared view
> ✅ If the snapshot returns empty for a widget's date range, we automatically retry with 'all time' as fallback
> Share with clients, embed in Notion, send via Slack — it just works.
> #Analytics #SaaS #ProductUpdate #OpenSource #SelfHosted #DashboardSharing

**Post 3 (Instagram caption)**
> Share your analytics dashboards with anyone — no login needed 🔗
> InsightTrack now generates truly public share links. Data is snapshotted at share time, so viewers see real charts even in incognito mode.
> Clients, stakeholders, your team — all without handing out your login credentials 🔒
> .
> .
> #Analytics #SharingIscaring #SaaS #OpenSource #SelfHosted #IndieHacker #Dashboard

---

## 🛡️ Auto-Logout on Session Expiry

**Post 1 (Twitter/X)**
> Fixed the blank screen bug in InsightTrack when your session expired 🛡️
> Before: token expired → every API call silently returned 401 → the app stayed "logged in" but showed nothing. Blank dashboard. No explanation.
> Now: the Axios interceptor catches any 401, fires an auth:logout event, the Zustand store clears state, React Router redirects to /landing, and a toast says "Your session has expired."
> UX matters, even for edge cases.
> #WebDev #React #UX #BugFix #SelfHosted #OpenSource

**Post 2 (LinkedIn)**
> Small fix, big UX difference — auto-logout on session expiry 🔐
> InsightTrack uses JWT tokens. When one expired, the old behaviour was: all API calls failed silently with 401, the user stayed on the dashboard seeing a blank/empty state, and there was no indication of what went wrong.
> The fix is a coordinated three-file change:
> ① `api.js` Axios interceptor detects 401 → clears localStorage → fires a custom `auth:logout` DOM event
> ② `useAuthStore` listens for that event → calls `set({ isAuthenticated: false })` → React Router's ProtectedRoute redirects to `/landing`
> ③ `App.jsx` listens for the same event → shows a toast: "Your session has expired. Please log in again."
> The user sees a clear message, gets redirected cleanly, and can log back in immediately.
> #React #Auth #JWT #UX #WebDev #SelfHosted #OpenSource #BugFix

**Post 3 (Instagram caption)**
> No more blank screens when your session expires 🔐
> InsightTrack now catches expired JWT tokens, redirects you to login, and shows a clear "session expired" message — instead of leaving you staring at an empty dashboard.
> Small UX fix. Big difference in how the product feels. ✨
> .
> .
> #WebDev #UX #Auth #React #SelfHosted #OpenSource #IndieHacker #ProductQuality

---

## 🔍 Heatmap — Major Improvements

**Post 1 (Twitter/X)**
> InsightTrack Heatmap just got a serious upgrade 🔥
> → Dot clustering (merges nearby clicks, reduces visual noise)
> → Device filter: All / Desktop / Mobile
> → Page picker dropdown with search — see all pages that have click data
> → Hover tooltips on every dot (click count + element selector)
> → Summary stats cards: total clicks, unique elements, top element
> → Click distribution table with pagination (20/page) + % share column
> → CSV export of raw click data
> All in one page. No config needed.
> #Heatmap #Analytics #UX #SelfHosted #OpenSource

**Post 2 (LinkedIn)**
> We shipped a major update to InsightTrack's Visual Heatmap feature 🗺️
> Here's everything that changed:
> ✅ **Dot clustering** — nearby click dots merge into one (configurable 3% radius threshold) so dense areas don't look like noise
> ✅ **Device filter** — toggle between All / Desktop / Mobile to compare click patterns by device type
> ✅ **Page picker** — a searchable dropdown lists every page that has click data with click counts, so you can jump directly without typing a path
> ✅ **Hover tooltips** — hovering any dot shows exact click count and the CSS selector of the element
> ✅ **Click-outside-to-close** — the page picker dropdown now properly closes when you click anywhere else (fixing a UX bug)
> ✅ **Summary stats** — 4 cards above the heatmap: total clicks, unique elements, most-clicked element, max clicks
> ✅ **Paginated distribution table** — 20 rows per page with rank, colour indicator, CSS selector, bar chart, click count, and % of total
> ✅ **CSV export** — download the full filtered click dataset for offline analysis
> The heatmap is now one of the most complete in any open-source analytics tool.
> #Heatmap #Analytics #OpenSource #SelfHosted #UX #ProductUpdate

**Post 3 (Instagram caption)**
> InsightTrack's Heatmap just levelled up 🔥
> Cluster nearby dots · filter by device · pick pages from a searchable dropdown · hover for click counts · export as CSV.
> The most complete heatmap in any free, self-hosted analytics tool. And it runs entirely on your own server 🔒
> .
> .
> #Heatmap #Analytics #UX #SelfHosted #OpenSource #WebAnalytics #IndieHacker #Privacy

---

## 📄 JS Errors — Pagination & Search

**Post 1 (Twitter/X)**
> InsightTrack JS Errors tab now has proper pagination and search 📄
> → Configurable page size: 5 / 10 / 25 / 50 per page
> → Search by error message, page path, or source file
> → First / prev / next / last page controls
> → Row count header ("X of Y errors")
> → Proper empty state with explanation
> When you have 200+ JS errors, you need more than an infinite scroll dump.
> #JavaScript #ErrorTracking #Analytics #SelfHosted #OpenSource

**Post 2 (LinkedIn)**
> Quick but meaningful improvement to InsightTrack's JS Error tracking 📊
> The old error list just dumped every error in a scrollable div. Fine for 5 errors. Unusable at 200.
> Now it has:
> ✅ Pagination with configurable page size (5, 10, 25, or 50 errors per page)
> ✅ First/previous/next/last controls
> ✅ Client-side search across message text, page path, and source file
> ✅ Live row count: "47 of 203 errors" while searching
> ✅ Clear empty state when a search matches nothing
> ✅ Error trend chart (daily area chart) still above the list
> Small improvements compound. If your error list was too long to use before, try it now.
> #JavaScript #ErrorTracking #WebDev #Analytics #SelfHosted #OpenSource

**Post 3 (Instagram caption)**
> 200 JS errors and no way to search through them? Fixed 🔍
> InsightTrack's Performance → JS Errors tab now has pagination (5/10/25/50 per page) and a live search filter by message, page, or source file.
> Find the error that actually matters, fast ⚡
> .
> .
> #JavaScript #ErrorTracking #WebDev #Analytics #SelfHosted #OpenSource #IndieHacker

---

## 🚨 Alerts — Pagination & Search

**Post 1 (Twitter/X)**
> InsightTrack traffic alerts panel now has pagination and search 🚨
> Spike and drop alerts pile up fast. Now you can:
> → Search by message text, alert type, or date
> → Browse 10 alerts per page with prev/next
> → See "X of Y" live count while filtering
> → Max-height scroll cap so the card doesn't grow unboundedly
> Settings → Alerts.
> #Analytics #TrafficAlerts #WebDev #SelfHosted #OpenSource

**Post 2 (LinkedIn)**
> Small improvement to InsightTrack's Alerts panel — but one that matters at scale 📊
> When InsightTrack detects traffic spikes or drops, it logs them. If you've been running for months, that list gets long.
> We added:
> ✅ Search filter (message, type, date) with live "X of Y" count
> ✅ Pagination — 10 alerts per page, prev/next controls
> ✅ max-h scroll cap so the card doesn't push your Settings page out of shape
> Small quality-of-life win. Settings → Alerts tab.
> #Analytics #ProductQuality #WebDev #SelfHosted #OpenSource

**Post 3 (Instagram caption)**
> Traffic alerts are only useful if you can find the ones that matter 🎯
> InsightTrack's Alerts panel now has search + pagination so you can quickly filter through spike and drop history.
> Settings → Alerts tab. Give it a try 🔒
> .
> .
> #Analytics #TrafficAlerts #SelfHosted #OpenSource #WebDev #IndieHacker

---

## 📊 Dashboard Builder — 18 New Data Sources

**Post 1 (Twitter/X)**
> InsightTrack's Dashboard Builder now supports 18 data sources for widgets 📊
> Previously: traffic, pages, sources, devices, countries, sessions.
> Now also: referrers, UTM campaigns, entry pages, exit pages, browsers, OS, bounce rate trend, avg session trend, conversions/goals, new vs returning, revenue, and performance metrics (Web Vitals).
> Build the dashboard your team actually needs.
> #Analytics #DashboardBuilder #SelfHosted #OpenSource #DataViz

**Post 2 (LinkedIn)**
> InsightTrack's Custom Dashboard Builder now exposes 18 data sources for widget configuration 📈
> Added in this update:
> • Referrers (from traffic sources breakdown)
> • UTM Campaigns (source/medium/campaign)
> • Entry Pages & Exit Pages
> • Browsers & Operating Systems
> • Bounce Rate Trend (daily time series)
> • Avg Session Duration Trend
> • Conversions / Goals (with revenue)
> • New vs Returning visitors
> • Revenue over time
> • Performance Metrics (Web Vitals overview)
> Every widget type — KPI card, area chart, bar chart, pie chart, data table — can now pull from any of these sources.
> #Analytics #DashboardBuilder #DataViz #SelfHosted #OpenSource #ProductUpdate

**Post 3 (Instagram caption)**
> 18 data sources. Infinite dashboard combinations 📊
> InsightTrack's drag-drop Dashboard Builder now lets you pull from referrers, UTM campaigns, entry/exit pages, browser/OS breakdown, bounce rate trends, goals, revenue, Web Vitals, and more.
> Build exactly the view your team needs 💡
> .
> .
> #Analytics #Dashboard #DataViz #SelfHosted #OpenSource #IndieHacker #WebAnalytics

---

## 🎛️ Feature Manager — Hide Navigation Items

**Post 1 (Twitter/X)**
> New in InsightTrack: Feature Manager 🎛️
> Hide any sidebar navigation item for your session. SQL Editor, Privacy, Reporting, Funnels — whatever your team doesn't need to see.
> → Toggle per item or per group (Core / Content / Analytics / Conversions / Tools)
> → Protected items (Dashboard, Settings) always stay on
> → Persists across sessions via localStorage
> → Amber hint in the sidebar when items are hidden
> Profile → Feature Manager tab.
> #Analytics #SaaS #UX #SelfHosted #OpenSource #TeamTools

**Post 2 (LinkedIn)**
> New feature in InsightTrack: Feature Manager — control exactly what appears in your sidebar 🎛️
> One of the most common requests from teams using InsightTrack internally: "We don't want everyone to see the SQL Editor / Privacy settings / Reporting tab."
> Feature Manager solves this cleanly:
> ✅ Toggle any nav item on or off — per item or per group
> ✅ 6 groups: Core, Content, Analytics, Conversions, Tools, System
> ✅ "Always on" protection for Dashboard and Settings — these can never be hidden
> ✅ Hidden items summary at the top with one-click restore
> ✅ "Show all (X hidden)" reset button
> ✅ Live visible/hidden/always-on stat counters
> ✅ Persists across browser sessions in localStorage
> ✅ Amber hint row in sidebar shows hidden count with a link back to the manager
> No backend needed. No user roles. Just a clean, instant way to focus the UI for your team.
> Profile → Feature Manager tab.
> #Analytics #SaaS #TeamTools #UX #SelfHosted #OpenSource #ProductUpdate #WebDev

**Post 3 (Instagram caption)**
> Give your team only what they need to see 🎛️
> InsightTrack's new Feature Manager lets you hide any sidebar nav item — Funnels, SQL Editor, Privacy, Reporting — with a single toggle.
> Groups, protected items, instant restore. Persists across sessions.
> Profile → Feature Manager tab 🔒
> .
> .
> #Analytics #UX #TeamTools #SelfHosted #OpenSource #IndieHacker #SaaS #Productivity

---

## 🌐 Landing Page — Full Revamp

**Post 1 (Twitter/X)**
> Completely rebuilt the InsightTrack landing page 🌐
> → Animated headline with gradient shift
> → Live floating widgets in the hero: realtime ticker, heatmap dots, funnel bars, web vitals, traffic spike alert
> → Real dashboard mockup with KPI cards, traffic chart, top pages, countries, devices, SQL editor preview, and JS errors
> → Feature pills row (8 features above the fold)
> → Scroll-triggered reveal animations (CSS-only, zero deps)
> → Animated stat counters on scroll
> → Full mobile nav with hamburger menu
> → Comparison table: InsightTrack vs GA4 vs Plausible
> → Use cases section (6 audience profiles)
> 0 extra dependencies added.
> #LandingPage #WebDesign #SaaS #OpenSource #Analytics

**Post 2 (LinkedIn)**
> We rebuilt the InsightTrack landing page from the ground up 🚀
> The old page had a decent structure but the hero showed a static hand-coded SVG mockup and the overall feel didn't match the quality of the product.
> What's new:
> **Hero section**
> • Animated gradient headline (gradShift keyframe)
> • Mouse-parallax background glow orbs
> • 8 feature pill badges above the fold (Realtime, Heatmaps, Funnels, Web Vitals, Dashboards, SQL Editor, Goals & A/B, User Flow)
> • Full dashboard mockup with: 4 KPI cards with sparklines, traffic area chart with tooltip, traffic sources donut, top pages bars, countries table, device breakdown, SQL editor code panel, JS error list
> • 5 floating animated widgets: live realtime ticker (updates every 2s), heatmap dot cluster, funnel conversion bars, web vitals table, traffic spike alert card
> **Animations (CSS-only, zero bundle impact)**
> • fadeUp, gradShift, float, float2, ticker keyframes
> • Intersection Observer scroll-triggered reveals with stagger
> • Animated stat counters (17+ pages, <2KB, 100×, 0 cookies)
> • Mouse parallax on hero glow
> **Other sections**
> • Feature tabs with live preview panels per feature (realtime, privacy checklist, query speed, heatmap, funnel, dashboard grid)
> • 6-card product showcase (live UI components, no screenshots)
> • 3-step setup with syntax-highlighted code block
> • 4-column comparison table (InsightTrack / GA4 / Plausible)
> • 6 use-case cards (SaaS, Blogs, Marketing, Dev, Privacy-conscious, Agencies)
> • Animated gradient CTA section
> • Full mobile navigation with hamburger menu
> No Framer Motion. No GSAP. 2497 modules, same bundle size as before.
> #LandingPage #WebDesign #SaaS #React #TailwindCSS #OpenSource #Analytics #Frontend

**Post 3 (Instagram caption)**
> New landing page just dropped for InsightTrack 🌐✨
> Live animated widgets in the hero. Real dashboard mockup with 8 data panels. Scroll-triggered animations. Feature previews. Comparison table. Mobile-first.
> Built with zero extra dependencies — just CSS keyframes and Intersection Observer 🎯
> .
> .
> #LandingPage #WebDesign #SaaS #Analytics #OpenSource #Frontend #IndieHacker #React #TailwindCSS
