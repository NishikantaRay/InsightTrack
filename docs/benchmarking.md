# Benchmarking & Load-Testing Scripts

How to run the performance scripts in `scripts/`.

> **Note on methodology.** These scripts are the *current* harness. They are not
> yet a publication-grade benchmark — see `docs/REPOSITORY_AUDIT.md` §14 for the
> known methodological gaps (small sample counts, application cache not bypassed,
> no PostgreSQL baseline). This page documents how to run them as they exist today.

---

## Credentials are never hardcoded

All three scripts authenticate against a **running** InsightTrack instance and
read their credentials from the environment. There are **no default values** — a
script exits immediately with a list of the variables it needs.

**Always use a dedicated benchmark account, never a personal one.** The account
needs access to the site being measured, and `scripts/load-test-data.js` writes
data, so point it at a throwaway site.

---

## `scripts/benchmark.js`

Times the analytics API endpoints against a live stack.

| Variable | Required | Description |
|---|---|---|
| `BENCHMARK_EMAIL` | yes | Login email for the benchmark account |
| `BENCHMARK_PASSWORD` | yes | Password for that account |
| `BENCHMARK_SITE_ID` | yes | Site to measure, e.g. `site_xxxxxxxx` |

```bash
export BENCHMARK_EMAIL="benchmark@example.com"
export BENCHMARK_PASSWORD="<password>"
export BENCHMARK_SITE_ID="site_xxxxxxxx"

node scripts/benchmark.js
```

Missing any variable produces:

```
❌ Missing required environment variable(s): BENCHMARK_PASSWORD
```

---

## `scripts/load-test-data.js`

Generates synthetic events and posts them to the tracking API. **Writes data** —
use a disposable site.

| Variable | Required | Description |
|---|---|---|
| `EMAIL` | yes | Login email for the account |
| `PASS` | yes | Password for that account |
| `SITE_ID` | yes | Target site — data is written here |
| `API` | no | API base URL (default `http://localhost:3001`) |
| `EVENTS` | no | Total events to generate (default `1000000`) |

```bash
export EMAIL="benchmark@example.com"
export PASS="<password>"
export SITE_ID="site_xxxxxxxx"

node scripts/load-test-data.js --events=1000000 --batch=500
```

`--events=` and `--batch=` override `EVENTS` and the batch size.

---

## Performance reports

`scripts/generate-report-pdf.js` was removed. It hardcoded an absolute path into
a directory outside this repository, so it failed with `ERR_MODULE_NOT_FOUND` on
every machine, and the figures it rendered were static values pasted from a past
run rather than live measurements.

Use the reproducible benchmark harness instead — it measures both engines on
generated data and writes JSON/CSV plus slide images:

```bash
node apps/analytics-api/scripts/benchmarking/run-engine-benchmark.js
```

See [PERFORMANCE_BENCHMARK.md](PERFORMANCE_BENCHMARK.md) for methodology and
results.

---

## Before committing

Never reintroduce a literal credential into these scripts or into generated
output. A quick check:

```bash
git grep -nE "@(gmail|outlook|yahoo)\.com|password\s*=\s*['\"]" -- scripts/
```

---

## See Also
- [performance-architecture.md](./performance-architecture.md)
- [REPOSITORY_AUDIT.md](./REPOSITORY_AUDIT.md) — §14 benchmark methodology gaps
