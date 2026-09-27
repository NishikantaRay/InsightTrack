# InsightTrack Analyst Bench — benchmarking the model behind Pulse

A public Kaggle benchmark that gives LLMs Pulse's real job and grades the answers automatically.
It exists to choose Pulse's model with evidence, and to show *how* models fail on analytics work.

| | |
|---|---|
| **Kaggle benchmark** | https://www.kaggle.com/benchmarks/nishikantaray/insighttrack-analyst-bench |
| **Dataset** (cases, tables, graders) | https://www.kaggle.com/datasets/nishikantaray/insighttrack-analyst-bench |
| **Source** | Separate **private** repo [NishikantaRay/insighttrack-analyst-bench](https://github.com/NishikantaRay/insighttrack-analyst-bench) (checked out at `~/Desktop/Personal/kaggle-bench/`). It has its own `README.md` and `docs/`. |
| **Status** | Results below are from task version 4, run 26–27 September 2026 through Kaggle's model proxy |

## Why it exists

Pulse answers questions people act on: *"why did traffic to /pricing drop?"*. Two failure modes
matter more than raw accuracy:

- **Inventing a cause.** Traffic moved for a non-search reason, and the model blames Google rankings.
- **Missing a real change.** Traffic fell by half, and the model says nothing significant happened.

General AI leaderboards don't measure either on our tools, data formats or DuckDB dialect. So the
benchmark tests models on exactly that.

## What it tests (480 cases, 80 standard + 40 hard per task)

| Task | What the model gets | Correct when | Relation to the product |
|---|---|---|---|
| Tool choice | A user question + the 23 Pulse tools | Right tool + arguments, or "none" | Exactly Pulse's first step |
| Data reading | A tool result in the real `{summary, data}` shape | Right number, or `not_available` | Exactly Pulse's second step |
| Diagnosis | Weekly traffic + Google results before/after | Real or noise, direction, exact causes | What `explain_traffic_change` computes in code |
| SQL | The DuckDB `events`/`sessions` tables | The query's result matches, run read-only | Not a Pulse feature today; tests readiness for SQL answers over the SQL Editor's tables |

## How it stays tied to this repo

The benchmark copies or ports four things from here. If you change one of them, the benchmark
goes out of date, and its tests say so.

| This repo | Benchmark | Checked by |
|---|---|---|
| `apps/analytics-api/src/services/correlationService.js` + the citation logic in `searchVisibilityService.checkKeyword()` | `insighttrack_bench/rules.py` (Python port = the diagnosis answer key) | `tests/test_parity.py` runs this repo's **original JavaScript** on every case + 1,500 random ones |
| `toolCatalogue()` in `apps/analytics-api/src/mcp/tools/registry.js` | `data/insighttrack_tools.json` | `tests/test_tasks_and_tools.py` compares it with the live registry |
| `events` / `sessions` DDL in `apps/analytics-api/src/schema/schema.js` | `SQL_SCHEMA` in `insighttrack_bench/scoring.py` | Copied as-is |
| Output fields of `getTrafficSources`, `getDeviceBreakdown`, `getTopPages`, `getKPISummary` (`queries.js`) | Data-reading cases | Same field names |

**After changing any of those files**, run the benchmark's tests. They point at this repo through
`INSIGHTTRACK_API`:

```bash
cd ~/Desktop/Personal/kaggle-bench
INSIGHTTRACK_API=~/Desktop/Personal/InsightTrack/apps/analytics-api .venv/bin/python -m pytest
```

A parity or tool-sync failure means the benchmark no longer matches the product. See that project's
`docs/testing.md` for how to re-sync.

## Results (task v4, 26–27 September 2026)

| Model | Tool choice | Data reading | Diagnosis | SQL | Overall | Cost (480 cases) |
|---|---|---|---|---|---|---|
| Claude Sonnet 5 | 100 | 100 | 100 | 100 | **100.0** | $2.08 |
| GPT-5.5 | 100 | 100 | 96.7 | 100 | **99.2** | $3.23 |
| Grok 4.20 (reasoning) | 100 | 96.7 | 100 | 95.0 | **97.9** | $1.21 |
| Gemini 3.7 Flash | 100 | 100 | 100 | 90.8 | **97.7** | $1.07 |
| Gemini 3.5 Flash-Lite | 98.3 | 88.3 | 49.2 | 88.3 | **81.0** | $0.20 |
| Claude Haiku 4.5 | 98.3 | 82.5 | 44.2 | 86.7 | **77.9** | $0.63 |
| Grok 4.20 (no reasoning) | 98.3 | 82.5 | 35.0 | 92.5 | **77.1** | $0.40 |
| GPT-5.4 nano | 93.3 | 61.7 | 20.0 | 93.3 | **67.1** | $0.07 |

All four of GPT-5.5's diagnosis misses come from an ambiguity in the benchmark prompt, not from
the product (see Limits).

### What the results mean for InsightTrack

1. **Computing diagnosis in code is the right design.** `explain_traffic_change` works out significance and causes with `correlationService.js`, and the model only phrases the result. Left to do that reasoning alone, every cheaper model got diagnosis wrong at least half the time (20–49%). Keep that logic in code.
2. **Tool choice is not the risk.** Every model picked the right tool at least 93% of the time, so the 23-tool catalogue and its descriptions work.
3. **"Nothing happened" and "I can't tell" must stay valid answers.** Cheap models fail in two opposite ways: Grok without reasoning *invented* causes 34 times, and GPT-5.4 nano *called real changes noise* 73 times. Keep tests for both.
4. **DuckDB dialect trap.** Gemini 3.7 Flash wrote `properties->>'name' = 'x'` on every JSON question, which DuckDB parses as `properties ->> ('name' = 'x')` and rejects. Any feature that runs model-written SQL here should add parentheses around `->>` comparisons before executing.
5. **Models revise themselves mid-answer.** Haiku often wrote a query, then "wait, let me reconsider", then a better one. Code that takes a model's output should ask for one final answer, or read the last one.

## Choosing Pulse's model

| Provider | Built-in default (`provider.js`) | Benchmarked? | Suggestion |
|---|---|---|---|
| Anthropic | `claude-sonnet-5` | Yes, 100% | Keep |
| Google | `gemini-2.5-flash` | No | `gemini-3.7-flash` scored 97.7% at about half Sonnet 5's cost. Set it as the model override (or `ASSISTANT_DEFAULT_MODEL_GEMINI`) |
| OpenAI | `gpt-4o-mini` | No | Not tested. `gpt-5.5` scored 99.2% (the most expensive run, $3.23), and GPT-5.4 nano scored 20% on diagnosis, so prefer a larger model for "why" questions |

Avoid small or non-reasoning models where the question is *why*. A model with reasoning scored
100% on diagnosis, and the same model without it scored 35%.

## Limits

- "Correct" means correct by InsightTrack's rules. They are written into every prompt, so the test is applying them, not guessing them.
- The data is synthetic, and each model ran once.
- SQL is graded on the first query in a reply, which costs Haiku about 6.6 points.
- **Known prompt ambiguity:** the diagnosis prompt says "moves of 1–2 places … are never a cause", which clashes with `page_one_exit` (for example #10 to #11). GPT-5.5 read it literally and missed exactly those 4 cases. The next version will say "never counts as `rank_drop` or `rank_gain`". `correlationService.js` itself is unaffected: in the product, `page_one_exit` fires regardless of move size.
