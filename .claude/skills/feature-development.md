# Feature Development Skill — InsightTrack

You are a developer building new features for InsightTrack. Follow this workflow to ensure features are complete, tested, and consistent with the codebase.

## Feature Development Workflow

### 1. Plan
- Identify which packages are affected (dashboard, db, server, or cross-cutting)
- Check if DB schema changes are needed (PG + DuckDB + sync)
- Identify the API endpoints required
- Plan the UI components needed

### 2. Backend First (if API changes needed)

#### New Analytics Endpoint Checklist:
```
apps/analytics-api/src/routes/analytics.js → Add route
apps/analytics-api/src/services/          → Add service method
apps/analytics-api/src/queries/           → Add DuckDB query
apps/analytics-api/tests/                 → Add tests
```

Template:
```javascript
// routes/analytics.js
router.get('/api/analytics/:siteId/new-metric', authenticateToken, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { dateRange } = req.query;
    
    const cacheKey = `new-metric:${siteId}:${dateRange}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const data = await analyticsService.getNewMetric(siteId, dateRange);
    setCached(cacheKey, data, 60000);
    res.json(data);
  } catch (error) {
    console.error('New metric error:', error.message);
    res.status(500).json({ error: 'Failed to fetch new metric' });
  }
});
```

#### New Tracking Event Type:
```
archive/analytics-api-legacy/src/routes/tracking.js → Validate legacy event flow only if still needed
apps/analytics-api/src/services/                  → Process new event
apps/analytics-api/scripts/migrate.js             → Schema migration (if needed)
apps/analytics-api/scripts/init.js                → DuckDB schema (if needed)
apps/analytics-api/src/sync/                      → Sync logic (if new table)
```

### 3. Frontend Implementation

#### New Dashboard Chart:
```
apps/dashboard-web/src/components/charts/NewChart.jsx  → Chart component
apps/dashboard-web/src/pages/Dashboard.jsx             → Add to dashboard
apps/dashboard-web/src/services/api.js                 → Add API function
apps/dashboard-web/src/__tests__/NewChart.test.jsx     → Component test
```

Template:
```jsx
// components/charts/NewChart.jsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function NewChart({ data, loading }) {
  if (loading) return <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />;
  if (!data?.length) return <p className="text-gray-500 dark:text-gray-400">No data available</p>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Metric</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="label" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" />
          <Tooltip />
          <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

#### New Page:
```
apps/dashboard-web/src/pages/NewPage.jsx      → Page component
apps/dashboard-web/src/App.jsx                → Add Route
apps/dashboard-web/src/components/layout/     → Add to Sidebar nav
apps/dashboard-web/e2e/new-page.spec.ts       → E2E test
```

### 4. Testing

```bash
# Backend unit tests
cd apps/analytics-api && npx vitest run tests/<new-test>.test.js

# Frontend component tests
cd apps/dashboard-web && npx vitest run src/__tests__/<NewComponent>.test.jsx

# E2E tests
cd apps/dashboard-web && npx playwright test e2e/<new-feature>.spec.ts

# Full test suite
cd apps/analytics-api && npm test
cd apps/dashboard-web && npm test
```

### 5. Documentation

- Update `docs/api-reference.md` for new endpoints
- Update `README.md` if setup steps change
- Update `ARCHITECTURE.md` if architectural decisions were made

### 6. Docker Verification

```bash
# Rebuild and test in Docker
docker-compose down -v
docker-compose up --build -d
# Wait for startup...
docker-compose logs -f backend
# Test endpoints manually or run E2E
```

## Common Feature Patterns

### Adding a New Analytics Metric
Scope: `apps/analytics-api` + `apps/dashboard-web`
1. Write DuckDB query in `src/queries/`
2. Add service method in `src/services/analyticsService.js`
3. Add cached route in `src/routes/analytics.js`
4. Add API function in dashboard `src/services/api.js`
5. Create chart component in `src/components/charts/`
6. Wire into Dashboard page
7. Write tests

### Adding a New Settings Page
Scope: `apps/dashboard-web` only
1. Create page component in `src/pages/`
2. Add route in `App.jsx`
3. Add sidebar link in `components/layout/Sidebar.jsx`
4. Use Zustand store if persistent state needed
5. Write component test + E2E test

### Adding a New Integrations / Webhook
Scope: `apps/analytics-api` (+ `archive/analytics-api-legacy` only if intentionally maintaining legacy flow)
1. Add webhook config to sites table (PG migration)
2. Add delivery service in `apps/analytics-api/src/services/`
3. Fire webhook on tracking event
4. Add DuckDB column in init script if tracking webhook status
5. Update sync if needed
6. Add management UI in dashboard
