# Web Traffic Analytics Dashboard – Master Build Prompt

## 🎯 Goal

Build a full-featured **web analytics dashboard** (similar to PostHog / Microsoft Clarity Lite) that visualizes website traffic and user behavior data collected from an event-tracking system.

The dashboard should help website owners understand:

- How many users visit their site
- What pages they visit
- Where they come from
- What devices they use
- How users move through funnels

---

## 🧱 Tech Requirements

**Frontend:** React.js (React)  (javascript ) 
**Charts:** Recharts or Chart.js  
**Backend:** REST API that returns aggregated analytics  
**Auth:** Assume authenticated user with a `siteId`

All charts must support:

- Date range filter (Today, 7d, 30d, Custom)
- Timezone-aware display
- Responsive layout

---

## 🗄 Data Model (Events Table)

| Field      | Type      | Description |
|-----------|-----------|-------------|
| siteId    | string    | Website identifier |
| userId    | string    | Unique visitor ID |
| sessionId | string    | Session identifier |
| type      | string    | Event type (pageview, click, etc.) |
| url       | string    | Full page URL |
| path      | string    | URL path |
| referrer  | string    | Traffic source |
| device    | string    | mobile / desktop / tablet |
| country   | string    | Visitor country |
| ts        | timestamp | Event timestamp |
| props     | JSON      | Extra event properties |

---

# 📊 Required Dashboard Charts

---

## 1️⃣ Traffic Over Time

**Purpose:** Show visitor trends  
**Chart Type:** Line chart  
**Metric:** Unique visitors per day  

**API**
