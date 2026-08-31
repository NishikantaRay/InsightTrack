# A/B Testing

Split tests with deterministic variant assignment and statistical significance.

## Status

| Capability | State |
|---|---|
| Create / list / pause / delete tests | ✅ |
| Per-variant visitors, conversions, conversion rate | ✅ |
| Deterministic variant assignment (client) | ✅ |
| Statistical significance (two-proportion z-test) | ✅ |
| Sequential / Bayesian testing | ❌ |
| Automatic sample-size calculator | ❌ |
| Multi-armed bandit allocation | ❌ |

## Assigning variants

`window.analytics.getVariant(testId, variants)` returns a stable variant for the
current visitor:

```js
const variant = window.analytics.getVariant('checkout_copy', ['control', 'urgent']);
document.querySelector('#cta').textContent =
  variant === 'urgent' ? 'Claim your spot — 3 left' : 'Get started';
```

How it works:

- The variant is `FNV-1a(visitorId + ':' + testId) % variants.length`. It is
  computed **client-side with no network call**, so there is no flash of the
  wrong content and no added latency.
- The same visitor always gets the same variant for a given test, and their
  assignment in one test is independent of any other test.
- Exposure is reported **once per session** as an `experiment_view` event with
  `{ test, variant }` properties, written to `sessionStorage` to deduplicate.

### Assignment caveat

Visitor IDs rotate on `VISITOR_ID_TTL_DAYS`. A visitor returning after the TTL
elapses may be reassigned. For short tests this is immaterial; for tests running
longer than the TTL it biases the split over time. Either keep tests shorter
than the TTL, or set `VISITOR_ID_TTL_DAYS=0` for the duration (which disables
rotation and weakens the privacy posture — a deliberate trade).

## Reading results

`GET /api/analytics/:siteId/ab-tests` returns each variant with:

| Field | Meaning |
|---|---|
| `visitors`, `conversions`, `conversionRate` | Raw counts and rate (%) |
| `isControl` | True for the first variant; it carries no test statistics |
| `uplift` | Relative change vs control, % |
| `zScore`, `pValue`, `confidence` | Two-proportion z-test against control |
| `significant` | `true` only when `reliable` **and** `pValue < 0.05` |
| `reliable` | Whether the normal approximation holds (expected count ≥ 5 per cell) |

`significant` is deliberately conservative: a result on a tiny sample reports
`reliable: false` and never `significant: true`, however tempting the raw rates.

## Interpreting honestly

The implementation is a **fixed-horizon frequentist test**. Its assumptions are
worth taking seriously:

- **Decide the sample size before you start.** Checking repeatedly and stopping
  the moment `p < 0.05` ("peeking") inflates the false-positive rate far above
  5%. This is the single most common way A/B tests mislead.
- **Comparisons are against the first variant only.** With three or more
  variants the per-comparison error compounds — treat multi-variant results as
  directional.
- **Statistical significance is not business significance.** A 0.3% lift can be
  significant at large n and still not worth shipping.

## Schema

```sql
CREATE TABLE ab_tests (
  id       VARCHAR PRIMARY KEY,   -- ab_<short-uuid>
  site_id  VARCHAR NOT NULL,
  name     VARCHAR NOT NULL,
  variants JSONB   NOT NULL,      -- [{ name, path }]
  goal_id  VARCHAR,               -- goal counted as a conversion
  status   VARCHAR NOT NULL,      -- active | paused | completed
  created_at TIMESTAMP
);
```

## Where the code lives

| Concern | File |
|---|---|
| Test CRUD | `src/services/goalsService.js` |
| Results + significance | `src/queries/queries.js` (`getABTestResults`) |
| Statistics | `src/utils/abStats.js` |
| Client assignment | `src/services/sitesService.js` (`getRawTrackingScript`) |
| Tests | `tests/abStats.test.js` |
