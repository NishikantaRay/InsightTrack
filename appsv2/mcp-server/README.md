# @insighttrack/mcp-server

Query your [InsightTrack](https://github.com/) web analytics from **Claude Desktop**, **Cursor**, or any [MCP](https://modelcontextprotocol.io) client — using the same read-only tools that power the in-dashboard AI Analyst.

It's a thin bridge: every tool call is proxied to your running InsightTrack API over HTTPS and authenticated with a **connect token**, so per-user site scoping and the read-only guarantees are enforced server-side. The MCP server never touches your database directly.

## Setup

1. In InsightTrack, go to **Settings → AI Analyst → Connect a client** and generate a connect token.
2. Copy the config block it shows into your MCP client. For Claude Desktop, that's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "insighttrack": {
      "command": "npx",
      "args": ["-y", "@insighttrack/mcp-server"],
      "env": {
        "INSIGHTTRACK_API_URL": "https://analytics.example.com",
        "INSIGHTTRACK_TOKEN": "eyJhbGciOi..."
      }
    }
  }
}
```

3. Restart the client. You'll see tools like `get_kpi`, `get_top_pages`, `get_sources`, `get_funnel`, and more.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `INSIGHTTRACK_API_URL` | yes | Base URL of your InsightTrack API (e.g. `https://analytics.example.com`). |
| `INSIGHTTRACK_TOKEN` | yes | A connect token from `POST /api/mcp/connect`. Revoke it anytime in Settings. |

## Security

- The token is scoped to **your user** and only exposes sites you can access.
- All tools are **read-only** — the MCP server has no write/delete capability.
- Revoke a token in **Settings → AI Analyst** at any time; the API rejects it immediately.

## Development

```bash
INSIGHTTRACK_API_URL=http://localhost:3001 INSIGHTTRACK_TOKEN=... node src/index.js
```

Speaks MCP over **stdio**. The tool catalogue is fetched live from the API's `/api/mcp/tools`, so it always matches the server's registry.
