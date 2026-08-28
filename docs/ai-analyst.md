# Pulse (AI Analyst) — User Guide

**Pulse** is InsightTrack's AI analyst: ask questions about your website traffic in plain English and get back real numbers, charts, and CSVs — without building a report. It runs inside the InsightTrack dashboard (the "Ask Pulse" button), and the same tools can be used from **Claude Desktop, Cursor, or any MCP client**.

It is **read-only**: the AI can query your analytics but can never change settings, edit, or delete data. Every answer is backed by a real tool call — it does not make up numbers.

---

## 1. Using it in the dashboard

1. On any dashboard page, click the **“Ask Pulse”** button (bottom-right). A resizable chat panel opens on the right — drag its left edge to resize, or click the **expand icon** in the header for a full-page view (content centers into a reading column; click again to shrink back). It becomes a full-screen sheet on mobile.
2. Type a question, or tap one of the suggested prompts. Examples:
   - “Top pages last 7 days”
   - “Where does my traffic come from?”
   - “How is my conversion funnel doing?”
   - “Compare visitors this month vs last month”
   - “Which countries send the most engaged visitors?”
3. The answer streams in. Data renders inline as a **chart**, **table**, or **KPI** card.

### What you can do with an answer

| Action | How |
| --- | --- |
| **Download CSV** | Click the **CSV** button on any data card. |
| **Jump to the full page** | Click the deep-link chip (e.g. *“Open pages →”*) to navigate to the matching dashboard view. |
| **Copy the reply** | Hover a reply and click **Copy**. |
| **Start over** | Click **＋ New chat** in the header. |
| **Clear history** | Click the **trash** icon. |

### Memory

Every conversation is saved as a **thread**. When you reopen the panel it resumes where you left off, and follow-up questions keep context (“…and last month?”). Start a new thread anytime with **＋ New chat**.

The panel header shows a green dot when an AI provider is connected, and which provider is powering it.

---

## 2. Add your own AI provider key

Pulse needs an **Anthropic (Claude)**, **OpenAI (GPT)**, or **Google (Gemini)** API key. Your server admin may have already configured one — if so, the panel just works. To use your **own** key:

1. Go to **Settings → Pulse AI**.
2. Choose a provider, paste your API key, and (optionally) set a model.
3. Click **Save settings**.

| Provider | Key format | Get a key |
| --- | --- | --- |
| Anthropic (Claude) | `sk-ant-…` | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI (GPT) | `sk-…` | [platform.openai.com](https://platform.openai.com) |
| Google (Gemini) | `AIza…` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

- Your key is stored **encrypted at rest** (AES-256-GCM) and is **never shown again** — only a masked hint like `sk-…a1b2`.
- **Precedence:** your saved key is used first; if you don’t set one, the server’s key is used.
- Optional **model override**: e.g. `claude-sonnet-5` or `gpt-4o-mini`. Leave blank for the default.
- Remove your key anytime with the **trash** button next to the key field — the panel falls back to the server key.

---

## 3. Use InsightTrack in Claude Desktop, Cursor & other AI clients

InsightTrack exposes the same read-only analytics tools to any [Model Context Protocol](https://modelcontextprotocol.io) client, so you can ask Claude Desktop (or Cursor, Zed, your own agent) about your traffic and it will call InsightTrack directly. There are **two ways to connect** — a remote URL (simplest) or a local bridge.

### Connect a client

1. Go to **Settings → Pulse AI → Connect a client**.
2. Give it a label (e.g. *“My laptop — Claude Desktop”*) and click **Connect**.
3. It shows two config blocks. **The token is shown only once** — copy the one you need now.
4. Paste it into your client’s MCP config and restart the client.

**Remote (recommended)** — the client connects straight to the hosted MCP endpoint over HTTP; nothing to install:

```json
{
  "mcpServers": {
    "insighttrack": {
      "type": "http",
      "url": "https://analytics.example.com/api/mcp/http",
      "headers": { "Authorization": "Bearer <paste your connect token>" }
    }
  }
}
```

**Local (stdio)** — for clients that don’t yet support remote MCP. Runs a small bridge process next to the client:

```json
{
  "mcpServers": {
    "insighttrack": {
      "command": "node",
      "args": ["/path/to/insighttrack/mcp-server/src/index.js"],
      "env": {
        "INSIGHTTRACK_API_URL": "https://analytics.example.com",
        "INSIGHTTRACK_TOKEN": "<paste your connect token>"
      }
    }
  }
}
```

> The local bridge is a thin HTTP proxy (`mcp-server/`) that calls the same API — it never touches the database. If your deployment publishes `@insighttrack/mcp-server` to npm, the panel will offer the `npx -y @insighttrack/mcp-server` form instead of a file path.

Once connected, the analytics tools appear automatically. Ask your assistant things like *“What were InsightTrack’s top pages last week?”* — or *“which sites do I have?”*, which uses `list_sites` to pick the right one — and it will fetch live data.

### Managing connections

- **List / revoke:** every connection appears under *Connect a client* with its last-used date. Click the **trash** icon to revoke — the API rejects that token immediately.
- **Multiple clients:** generate a separate token per device/app so you can revoke them independently.
- A connect token is scoped to **your account** and only the sites you can access. All tools are read-only. Tokens cannot create more tokens.

---

## 4. Which tools are available

| Tool | Answers questions like |
| --- | --- |
| `list_sites` | “Which sites do I have?” (also resolves a site by name) |
| `get_kpi` | “What are my headline numbers?” |
| `get_traffic` | “How has traffic changed over time?” |
| `get_top_pages` | “Which pages are most visited?” |
| `get_sources` | “Where does my traffic come from?” |
| `get_devices` | “Desktop vs mobile split?” |
| `get_countries` | “Which countries visit most?” |
| `get_funnel` | “How is my conversion funnel doing?” |
| `get_realtime` | “Who’s on the site right now?” |
| `get_acquisition_utm` | “Which campaigns drove traffic?” |
| `get_engagement` | “How engaged are my visitors?” |
| `compare_ranges` | “This period vs the previous one?” |
| `get_goals` | “How are my conversion goals doing?” |
| `get_user_flow` | “How do visitors move through the site?” |
| `get_js_errors` | “Are there any JavaScript errors?” |
| `get_performance` | “How fast is my site? (Core Web Vitals)” |
| `get_page_detail` | “What do visitors click on /pricing?” |

**Each tool** is read-only and site-scoped. Each returns a structured result the dashboard renders as a chart/table/KPI with a CSV download and a deep-link to the matching page. `list_sites` is account-scoped (no site needed); every other tool is scoped to a single site you can access.

---

## 5. Tips & troubleshooting

- **“No AI provider configured.”** No key is set. Add one in **Settings → Pulse AI**, or ask your admin to set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` on the server.
- **“Select a site first.”** The AI answers for the currently-selected site. Pick one from the site selector in the top bar.
- **The AI won’t change anything.** By design — it has no write/delete tools.
- **Verify important numbers.** LLMs can occasionally misread a chart; the underlying data cards are the source of truth, and every card is exportable.
- **Costs.** LLM calls aren’t free. If you use your own key, usage is billed by your provider.

---

## 6. How it works (for the curious)

```
You ─▶ Pulse panel ─▶ Assistant service (LLM loop)
                              │  1. LLM decides which tool(s) to call
                              │  2. Tools run against DuckDB (read-only), scoped to your site
                              │  3. Results stream back as cards (chart / table / CSV / deep-link)
                              │  4. LLM writes a plain-English summary
                              └─ Conversation saved to PostgreSQL (thread memory)
```

The **same tool registry** powers both the in-dashboard panel and the external MCP server, so answers are consistent everywhere. The MCP server is a thin HTTP bridge to the API — it never touches the database directly, which keeps per-user scoping and the read-only guarantees enforced server-side.

See [`docs/mcp-toolkit.md`](./mcp-toolkit.md) for the full architecture and build phases.
