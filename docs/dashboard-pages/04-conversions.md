# Conversions

## What this page does

The Conversions page combines three related areas:

- **Goals**
- **A/B Tests**
- **Revenue Attribution**

It is the place where traffic turns into business outcomes.

## Goals tab

### What it shows

The Goals tab lets users define conversion targets and then measure how many users completed them.

Supported goal types in the current UI:

- `page_visit`
- `event`
- `click`

### Backend source

- `getGoalConversions()`
- `getGoalConversionsOverTime()`

### How goal conversions are calculated

The backend first calculates total visitors in the selected period:

- `COUNT(DISTINCT user_id)` from `events`

Then each goal is evaluated separately.

#### Page visit goal

Conversions are:

- `COUNT(DISTINCT user_id)`
- where `type = 'pageview'`
- and `path = goal.config.path`

#### Event goal

Conversions are:

- `COUNT(DISTINCT user_id)`
- where `type = goal.config.eventType`

#### Click goal

Conversions are:

- `COUNT(DISTINCT user_id)`
- where `type IN ('click', 'button_click', 'heatmap_click')`
- and `properties.selector = goal.config.selector`

### Goal conversion rate

The backend uses:

$$
\text{Conversion Rate} = \frac{\text{Distinct Users Who Converted}}{\text{Distinct Visitors in Period}} \times 100
$$

Returned with one decimal place.

### Goal trend chart

The "Conversions Over Time" chart groups conversions by day and counts distinct converting users per day.

## A/B Tests tab

### What it shows

Each test contains one or more variants. The page displays:

- visitors
- pageviews
- conversions
- conversion rate
- visual winner badge

### Backend source

- `getABTestResults()`

### How variant traffic is calculated

For each variant path:

- visitors = `COUNT(DISTINCT user_id)` where `path = variantPath`
- pageviews = `COUNT(*)` where `type = 'pageview'` and `path = variantPath`

### How A/B test conversions are calculated

If the test is linked to an event-based goal, conversions are counted as distinct users who:

1. visited the variant path, and
2. also fired the goal event type in the selected period

### Variant conversion rate

$$
\text{Variant Conversion Rate} = \frac{\text{Goal Conversions for Variant}}{\text{Variant Visitors}} \times 100
$$

### Winner logic

The frontend marks the winner as:

- the variant with the highest `conversionRate`
- only if that rate is greater than `0`

So the winner badge is a UI comparison, not a statistical significance test.

## Revenue tab

### What it shows

This section summarizes purchase activity and attributes revenue back to acquisition sources.

### Backend source

- `getRevenueAttribution()`

### How revenue is calculated

Only `purchase` events are used.

#### Total Revenue

$$
\text{Total Revenue} = \sum \text{purchase.properties.value}
$$

#### Purchases

- `COUNT(*)` of purchase events

#### Unique Buyers

- `COUNT(DISTINCT user_id)` on purchase events

#### Average Order Value

$$
\text{AOV} = \operatorname{AVG}(\text{purchase.properties.value})
$$

### Revenue by source

Grouped by `utm_source`, with this fallback:

- empty source → `Direct`

Each source row includes:

- purchases
- total revenue
- average order value

## Notes

- Revenue attribution currently depends on purchase events carrying a numeric `properties.value`.
- A/B test winner selection is not a Bayesian or frequentist significance model.
- Goal conversion rate uses all distinct visitors in-range as denominator, not only users who reached a prerequisite step.