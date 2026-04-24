# Settings

## What this page does

The Settings page is the site administration page for the dashboard.

It combines three jobs:

- site management
- tracking snippet generation
- traffic alert viewing

## Site Manager

### What it does

The Site Manager lets the user:

- list sites
- create a new site
- switch active site
- delete inactive sites

### Data source

- `sitesAPI.list()`
- `sitesAPI.create()`
- `sitesAPI.delete()`

### Validation rules when creating a site

The frontend validates:

- site name must exist
- site name must be at least 2 characters
- domain must exist
- domain must match a domain regex like `example.com`

There is no analytics calculation here; it is site CRUD.

## Tracking Script

### What it does

The page generates the embed snippet for the currently active site.

### How the snippet is built

The frontend computes:

- `API_BASE` from `VITE_API_URL` or `http://localhost:3001`
- if the env var lacks a protocol, it prepends `https://`

Then it builds:

```html
<script src="${API_BASE}/api/sites/${siteId}/script"></script>
```

This is a deterministic string-generation step, not a backend calculation.

## Traffic Alerts panel

### What it does

The embedded `AlertsPanel` shows automatic spike/drop detection.

### Data source

- `getAlerts()`

### How alerts are calculated

The backend first builds daily traffic rows:

- visitors = `COUNT(DISTINCT user_id)` per day
- pageviews = pageview count per day

Then, for each day after the first few observations, it calculates a rolling baseline using up to the previous 7 days:

- mean daily visitors
- standard deviation of daily visitors

It triggers:

- **spike** if current visitors > mean + 2 × standard deviation
- **drop** if current visitors < mean - 2 × standard deviation

The reported change is:

$$
\text{Change %} = \frac{\text{Current} - \text{Average}}{\text{Average}} \times 100
$$

rounded to a whole number.

## Notes

- Settings is the bridge between administration and implementation.
- If you need to verify tracking installation for a new site, this is the page to check first.