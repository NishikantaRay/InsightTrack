# Acquisition

## What this page does

The Acquisition page explains where traffic comes from.

It focuses on three buckets:

- campaigns (UTM-tagged traffic)
- social media traffic
- search keywords

## Campaigns

### What it shows

A detailed campaign table using UTM source, medium, and campaign values.

### Backend source

- `getCampaignDashboard()`

### How it is calculated

The backend scans all events in the date range and keeps rows where at least one of these is present:

- `utm_source`
- `utm_medium`
- `utm_campaign`

It groups by:

- source
- medium
- campaign

For each group it returns:

- visitors = `COUNT(DISTINCT user_id)`
- pageviews = count of `pageview` events
- purchases = count of `purchase` events
- revenue = sum of `purchase.properties.value`

### Campaign percentage

$$
\text{Campaign Share} = \frac{\text{Campaign Visitors}}{\text{Total Campaign Visitors}} \times 100
$$

Rounded to a whole number.

## Social Media

### What it shows

This tab buckets referral traffic by social platform.

### Backend source

- `getSocialMediaTraffic()`

### How platform detection works

The backend classifies `referrer` URLs using pattern matching.

Examples:

- Facebook → `%facebook%` or `%fb.com%`
- Twitter/X → `%twitter%`, `%t.co%`, `%x.com%`
- LinkedIn, Instagram, YouTube, Reddit, Pinterest, TikTok, GitHub, Discord, Slack
- unmatched social-style traffic → `Other Social`

### Metrics returned

For each platform:

- visitors = `COUNT(DISTINCT user_id)`
- pageviews = pageview count
- sessions = `COUNT(DISTINCT session_id)`
- percentage = share of total social visitors

## Keywords

### What it shows

This tab shows tracked UTM search terms.

### Backend source

- `getSearchKeywords()`

### How it is calculated

The backend filters to events where:

- `utm_term` is not null and not empty

Then it groups by:

- keyword (`utm_term`)
- source (`utm_source`, fallback `(direct)`)

It returns:

- visitors = distinct users
- pageviews = pageview count

## Notes

- Campaigns and Keywords depend on UTM parameters being sent with events.
- Social traffic depends on referrer parsing, so traffic from apps or privacy-restricted contexts may appear incomplete.
- Revenue on the Campaigns tab only appears if purchase events include a numeric `properties.value`.