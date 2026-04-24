#!/bin/bash
BASE="http://localhost:3001/api"
SITE="site_00a47a67"
DR="dateRange=30d"

test_endpoint() {
    local name="$1"
    local url="$2"
    local resp=$(curl -s "$url")
    if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success') else 1)" 2>/dev/null; then
        echo "  ✅ $name"
    else
        echo "  ❌ $name → $(echo "$resp" | head -c 120)"
    fi
}

echo "=== CORE ANALYTICS ==="
test_endpoint "KPI" "$BASE/analytics/$SITE/kpi?$DR"
test_endpoint "Traffic" "$BASE/analytics/$SITE/traffic?$DR"
test_endpoint "Pageviews" "$BASE/analytics/$SITE/pageviews?$DR"
test_endpoint "Top pages" "$BASE/analytics/$SITE/top-pages?$DR"
test_endpoint "Sources" "$BASE/analytics/$SITE/sources?$DR"
test_endpoint "Devices" "$BASE/analytics/$SITE/devices?$DR"
test_endpoint "Countries" "$BASE/analytics/$SITE/countries?$DR"
test_endpoint "Sessions" "$BASE/analytics/$SITE/sessions?$DR"
test_endpoint "Realtime" "$BASE/analytics/$SITE/realtime"
test_endpoint "Bounce trend" "$BASE/analytics/$SITE/bounce-rate-trend?$DR"
test_endpoint "Session trend" "$BASE/analytics/$SITE/avg-session-trend?$DR"
test_endpoint "User flow" "$BASE/analytics/$SITE/user-flow?$DR"
test_endpoint "Funnel" "$BASE/analytics/$SITE/funnel?$DR"

echo ""
echo "=== ENGAGEMENT ==="
test_endpoint "Summary" "$BASE/analytics/$SITE/engagement/summary?$DR"
test_endpoint "Scroll depth" "$BASE/analytics/$SITE/engagement/scroll-depth?$DR"
test_endpoint "Time on page" "$BASE/analytics/$SITE/engagement/time-on-page?$DR"
test_endpoint "Rage clicks" "$BASE/analytics/$SITE/engagement/rage-clicks?$DR"
test_endpoint "Heatmap" "$BASE/analytics/$SITE/engagement/heatmap?$DR&path=/"

echo ""
echo "=== CONTENT ==="
test_endpoint "Entry pages" "$BASE/analytics/$SITE/content/entry-pages?$DR"
test_endpoint "Exit pages" "$BASE/analytics/$SITE/content/exit-pages?$DR"
test_endpoint "Site search" "$BASE/analytics/$SITE/content/site-search?$DR"

echo ""
echo "=== ACQUISITION ==="
test_endpoint "Campaigns" "$BASE/analytics/$SITE/acquisition/campaigns?$DR"
test_endpoint "Social" "$BASE/analytics/$SITE/acquisition/social?$DR"
test_endpoint "Keywords" "$BASE/analytics/$SITE/acquisition/keywords?$DR"

echo ""
echo "=== PERFORMANCE ==="
test_endpoint "Web Vitals" "$BASE/analytics/$SITE/performance/web-vitals?$DR"
test_endpoint "Vitals overview" "$BASE/analytics/$SITE/performance/web-vitals-overview?$DR"
test_endpoint "JS errors" "$BASE/analytics/$SITE/performance/errors?$DR"
test_endpoint "Errors trend" "$BASE/analytics/$SITE/performance/errors-over-time?$DR"

echo ""
echo "=== AUDIENCE ==="
test_endpoint "New vs Return" "$BASE/analytics/$SITE/audience/new-vs-returning?$DR"
test_endpoint "Cohorts" "$BASE/analytics/$SITE/audience/cohorts?$DR"
test_endpoint "Segments" "$BASE/analytics/$SITE/audience/segments?$DR"

echo ""
echo "=== AUTH ==="
# Login to get a token
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
if [ -n "$TOKEN" ]; then
    echo "  ✅ Login (got token)"
else
    echo "  ⚠️  Login (no token — trying register)"
    TOKEN=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" -d '{"name":"Test User","email":"test@test.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
    if [ -n "$TOKEN" ]; then
        echo "  ✅ Registered + got token"
    else
        echo "  ❌ Auth failed"
    fi
fi

echo ""
echo "=== GOALS (auth required) ==="
if [ -n "$TOKEN" ]; then
    AUTH="Authorization: Bearer $TOKEN"
    resp=$(curl -s "$BASE/goals/$SITE" -H "$AUTH")
    echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ List goals' if d.get('success') else '  ❌ List goals → ' + str(d))" 2>/dev/null

    resp=$(curl -s "$BASE/goals/$SITE/ab-tests" -H "$AUTH")
    echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ List AB tests' if d.get('success') else '  ❌ List AB tests → ' + str(d))" 2>/dev/null
fi

echo ""
echo "=== REPORTING (auth required) ==="
if [ -n "$TOKEN" ]; then
    resp=$(curl -s "$BASE/reporting/$SITE/annotations" -H "$AUTH")
    echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ Annotations' if d.get('success') else '  ❌ Annotations → ' + str(d))" 2>/dev/null

    resp=$(curl -s "$BASE/reporting/$SITE/retention" -H "$AUTH")
    echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ Retention' if d.get('success') else '  ❌ Retention → ' + str(d))" 2>/dev/null

    resp=$(curl -s "$BASE/reporting/$SITE/reports" -H "$AUTH")
    echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ Reports' if d.get('success') else '  ❌ Reports → ' + str(d))" 2>/dev/null

    resp=$(curl -s "$BASE/reporting/$SITE/dashboards" -H "$AUTH")
    echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ Dashboards' if d.get('success') else '  ❌ Dashboards → ' + str(d))" 2>/dev/null
fi

echo ""
echo "=== TRACKING ==="
resp=$(curl -s -X POST "$BASE/track/event" -H "Content-Type: application/json" -d "{\"siteId\":\"$SITE\",\"userId\":\"test_user\",\"sessionId\":\"test_sess\",\"type\":\"pageview\",\"url\":\"http://test.com\",\"path\":\"/test\"}")
echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ Track event' if d.get('success') else '  ❌ Track event → ' + str(d))" 2>/dev/null

echo ""
echo "=== SITES ==="
test_endpoint "List sites" "$BASE/sites"
test_endpoint "Get script" "$BASE/sites/$SITE/script"

echo ""
echo "=== HEALTH ==="
test_endpoint "Health" "$BASE/health"

echo ""
echo "Done!"
