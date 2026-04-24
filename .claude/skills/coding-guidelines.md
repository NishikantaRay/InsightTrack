# Coding Guidelines — InsightTrack

You are an expert developer working on InsightTrack. Follow these conventions strictly when writing or modifying code.

## General Rules

- **ES Modules everywhere**: `import/export` only, no `require()`.
- **Async/await**: Always use async/await with try/catch in route handlers. No raw `.then()` chains.
- **Naming**: camelCase for variables/functions, PascalCase for React components, kebab-case for URLs.
- **No unused code**: Delete dead imports, commented blocks, and unreachable branches.
- **Minimal dependencies**: Don't add npm packages for things achievable with existing stack.

## Backend (Express / Node.js 20)

### Route Handlers

```javascript
// ✅ Correct pattern
router.get('/api/analytics/:siteId/kpi', authenticateToken, async (req, res) => {
  try {
    const { siteId } = req.params;
    const { dateRange } = req.query;
    const data = await analyticsService.getKPIs(siteId, dateRange);
    res.json(data);
  } catch (error) {
    console.error('KPI fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// ❌ Wrong — no auth, no error handling, raw SQL
router.get('/api/analytics/:siteId/kpi', async (req, res) => {
  const data = await db.query(`SELECT * FROM events WHERE site_id = '${req.params.siteId}'`);
  res.json(data);
});
```

### Database Queries

```javascript
// ✅ Parameterized — PostgreSQL
const result = await pool.query(
  'SELECT * FROM events WHERE site_id = $1 AND timestamp >= $2 LIMIT $3',
  [siteId, startDate, limit]
);

// ✅ Parameterized — DuckDB
const result = await duckdb.all(
  'SELECT * FROM events WHERE site_id = ? AND timestamp >= ? LIMIT ?',
  [siteId, startDate, limit]
);

// ❌ NEVER — SQL injection vulnerability
const result = await pool.query(`SELECT * FROM events WHERE site_id = '${siteId}'`);
```

### Service Layer

- Routes call services, services call DB. Never put DB queries in route files.
- Services return plain objects, not Express responses.
- One service file per domain: `trackingService.js`, `analyticsService.js`, `authService.js`, `sitesService.js`.

### Caching

```javascript
import { getCached, setCached } from '../services/cache.js';

const cacheKey = `kpi:${siteId}:${dateRange}`;
const cached = getCached(cacheKey);
if (cached) return res.json(cached);

const data = await analyticsService.getKPIs(siteId, dateRange);
setCached(cacheKey, data, 10000); // 10s for realtime data
res.json(data);
```

TTL guide: 10s (realtime KPIs), 60s (time-series), 120s (heavy aggregations).

## Frontend (React 18 / Vite / Tailwind)

### Components

```jsx
// ✅ Functional component with Tailwind + dark mode
export default function MetricCard({ title, value, trend, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-blue-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
      </div>
      <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
```

- Always support dark mode with `dark:` variants.
- Use Lucide React for icons (already in the project).
- Component files go in `components/charts/`, `components/layout/`, or `components/ui/`.

### Data Fetching

```jsx
// ✅ Use the useAnalytics hook — handles loading, errors, abort, and date filtering
const { data, loading, error, refetch } = useAnalytics('getTraffic', {
  enabled: !!siteId,
  params: { limit: 50 }
});

// ❌ Don't use raw useEffect + axios in components
useEffect(() => {
  axios.get(`/api/analytics/${siteId}/traffic`).then(setData);
}, [siteId]);
```

### State Management (Zustand)

```javascript
// ✅ Minimal Zustand store
import { create } from 'zustand';

const useSiteStore = create((set) => ({
  siteId: localStorage.getItem('analytics-site-id') || null,
  sites: [],
  setSiteId: (id) => {
    localStorage.setItem('analytics-site-id', id);
    set({ siteId: id });
  },
  setSites: (sites) => set({ sites }),
}));
```

- Only 4 stores allowed: `useAuthStore`, `useSiteStore`, `useDateFilterStore`, `useThemeStore`.
- Component-local state uses `useState`. Don't push everything into Zustand.

### Routing

- Pages go in `src/pages/`. One file per route.
- Use React Router 6 with `<Routes>`, `<Route>`, `<Navigate>`.
- Protected routes check `useAuthStore.isAuthenticated`.

## Testing

### Backend Unit Tests (Vitest)

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('trackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track pageview event', async () => {
    const mockPool = { query: vi.fn().mockResolvedValue({ rows: [{ id: '1' }] }) };
    const result = await trackingService.trackEvent(mockPool, eventData);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO events'),
      expect.arrayContaining([eventData.siteId])
    );
  });
});
```

### Frontend Component Tests (Testing Library)

```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MetricCard from '../components/ui/MetricCard';

describe('MetricCard', () => {
  it('renders value and title', () => {
    render(<MetricCard title="Visitors" value="1,234" />);
    expect(screen.getByText('Visitors')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('user can log in and see dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## File Organization

```
apps/dashboard-web/src/
├── components/
│   ├── charts/       → Recharts wrapper components
│   ├── layout/       → DashboardLayout, Sidebar, Navbar
│   └── ui/           → MetricCard, DateFilter, DataTable, etc.
├── hooks/            → useAnalytics, useRealtime
├── pages/            → One file per route (Dashboard, Login, etc.)
├── services/         → api.js (Axios instance + endpoint functions)
├── store/            → Zustand stores (auth, site, date, theme)
├── utils/            → formatters.js, exportUtils.js
└── __tests__/        → Unit/component tests

apps/analytics-api/src/
├── db/               → DuckDB connection management
├── middleware/        → Auth, validation, rate limiting
├── queries/          → DuckDB SQL query builders
├── routes/           → Express routers (analytics, tracking, etc.)
├── schema/           → Table definitions
├── services/         → Business logic (analytics, tracking, cache)
└── sync/             → PG → DuckDB incremental sync

archive/analytics-api-legacy/src/
├── db/               → PostgreSQL pool connection
├── middleware/        → Auth, validation
├── routes/           → Express routers
├── scripts/          → Migration, seeding
└── services/         → Business logic
```
