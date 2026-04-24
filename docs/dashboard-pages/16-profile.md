# Profile

## What this page does

The Profile page is the account/preferences UI for the signed-in user.

It includes three tabs:

- General
- Security
- Notifications

## Current implementation model

Unlike the analytics pages, this page is currently mostly **frontend-local state**.

The key detail is that it does **not** currently use the authenticated profile API for most of its behavior.

## General tab

### What it does

Lets the user edit:

- name
- email
- role
- timezone

### How persistence works

The page saves to browser localStorage using:

- key: `analytics-user-profile`

On load, it attempts to read that key and parse JSON.

If nothing exists, it falls back to a default profile object.

### Derived values

#### Initials

Avatar initials are derived from the name by:

1. splitting on spaces
2. taking the first character of each word
3. uppercasing
4. keeping the first two letters

#### Timezone

If no timezone is already stored, the page auto-fills one using:

- `Intl.DateTimeFormat().resolvedOptions().timeZone`

## Security tab

### What it does

Shows UI for:

- current password
- new password
- confirm password
- active session display

### Calculation / persistence behavior

At the moment, this tab is mostly presentational:

- password fields do not currently send a backend update request
- the active session block is based on browser environment values like `navigator.userAgent` and `navigator.platform`

So this is not yet a full account-security management implementation.

## Notifications tab

### What it does

Displays toggles for notification preferences.

### Current behavior

The toggles are currently UI-focused and not fully wired to structured backend persistence.

The Save action reuses the page’s generic save flow, but the toggle rows themselves are not modeled as a complete persisted settings object.

## Notes

This page should be documented honestly as a partially implemented account settings interface:

- good for UI/UX scaffolding
- not yet equivalent to a full backend-backed profile management system