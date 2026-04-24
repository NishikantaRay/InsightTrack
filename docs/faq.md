# FAQ & Troubleshooting

Common questions and solutions for InsightTrack.

---

## General
**Q: Why aren’t analytics updating instantly?**
A: Dashboard polling interval and DB sync interval control freshness. See `useAnalytics.js` and `sync.js`.

**Q: Why is my tracking script not working?**
A: Check the site ID, network errors, and CORS settings. Use browser dev tools to debug.

**Q: How do I reset my password?**
A: Use the `/api/auth/reset` endpoint (see API docs).

## Dev/Build
**Q: Docker won’t start Postgres**
A: Check for port conflicts or existing containers. Use `docker ps` and `docker rm`.

**Q: Playwright tests fail on CI**
A: Ensure all services are running and ports are correct.

---

## See Also
- [getting-started.md](./getting-started.md)
- [running-locally.md](./running-locally.md)
