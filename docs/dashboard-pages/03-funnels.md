# Funnels

## What this page does

The Funnels page visualizes a multi-step conversion journey.

Its goal is to show how many users make it through a predefined purchase path, from first visit to final conversion.

Today, this page is intentionally simple:

- it renders a single `FunnelChart`
- it is powered by one backend endpoint
- the steps are currently hardcoded in the query logic

## Data this page loads

The page relies on:

- `getFunnel(siteId, dateRange)`

Backend source:

- `getFunnelData()` in `apps/analytics-api/src/queries/queries.js`

## How the funnel is currently calculated

The backend first calculates total unique visitors in the selected range:

- `COUNT(DISTINCT user_id)` from `events`

That total is then used as the denominator for every stage percentage.

It next counts distinct users for five fixed stages:

1. **Visit Homepage**
   - `COUNT(DISTINCT user_id)` where `type = 'pageview'`
2. **View Product**
   - `COUNT(DISTINCT user_id)` where `type = 'pageview' AND path = '/products'`
3. **Add to Cart**
   - `COUNT(DISTINCT user_id)` where `type = 'add_to_cart'`
4. **Checkout**
   - `COUNT(DISTINCT user_id)` where `type = 'checkout'`
5. **Purchase**
   - `COUNT(DISTINCT user_id)` where `type = 'purchase'`

## How percentages are calculated

Each step uses:

$$
\text{Step Percentage} = \frac{\text{Distinct Users at Step}}{\text{Total Distinct Visitors in Range}} \times 100
$$

The value is rounded to one decimal place.

## Important caveat

This is **not** a strict sequential funnel yet.

That means the current implementation does **not** verify that a user completed step 1 before step 2, then step 2 before step 3, and so on.

Instead, it answers:

- how many unique users triggered each stage condition during the selected period?

So the page is useful for directional insight, but it is not yet a full path-validated funnel engine.

## Product implications

This is good for:

- quick commerce-style conversion visibility
- demo data
- spotting big leaks between top and bottom stages

This is not yet ideal for:

- custom funnels per site
- arbitrary step definitions
- strict sequential conversion analysis
- stage-to-stage drop-off calculations based on prior-step completion

## Notes

If you want this page to become a true analytics-grade funnel view, the next step would be to base it on stored funnel definitions and enforce ordered step completion per user/session.