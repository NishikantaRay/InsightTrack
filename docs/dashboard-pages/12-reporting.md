# Reporting

## What this page does

The Reporting page is the operational workspace for saving context, scheduling outputs, and exporting data.

It has three tabs:

- Annotations
- Scheduled Reports
- Data Export

Unlike the traffic pages, this page is more about workflow than analytics math.

## Annotations

### What it does

Annotations let users mark important events on the analytics timeline, such as:

- deployments
- marketing launches
- incidents
- general notes

### Data source

Read path:

- `getAnnotations()` via analytics endpoint

Write paths:

- `reportingAPI.createAnnotation()`
- `reportingAPI.deleteAnnotation()`

### How annotation retrieval works

The backend filters the `annotations` table by:

- `site_id`
- `date >= selected start date`
- `date <= selected end date`

Then it orders results by date descending.

There is no calculation formula here beyond date-range filtering.

## Scheduled Reports

### What it does

This tab manages report delivery metadata:

- frequency (`daily`, `weekly`, `monthly`)
- recipient email
- metric list
- enabled/disabled state

### Data source

- `reportingAPI.listReports()`
- `reportingAPI.createReport()`
- `reportingAPI.deleteReport()`

### Calculation behavior

This tab does not compute analytics metrics itself.

It stores scheduling configuration so another reporting process can decide when and how to send summaries.

## Data Export

### What it does

Exports selected analytics datasets as JSON files.

### Export types currently supported

- KPI Summary
- Traffic Data
- Top Pages
- Traffic Sources

### How export works

When a user clicks Export, the frontend calls one analytics endpoint for a fixed range of `30d`:

- KPI → `getKPIs`
- Traffic → `getTraffic`
- Pages → `getTopPages`
- Sources → `getSources`

The returned response is then:

1. serialized to JSON
2. wrapped in a browser `Blob`
3. downloaded as a file

The export logic does **not** recalculate data locally. It simply downloads the API response payload.

## Notes

- Reporting is partly read-only analytics and partly reporting/configuration CRUD.
- Annotations are the most analytics-adjacent part because they are filtered against the active date range.
- Data Export inherits the source calculations of the endpoint being exported.