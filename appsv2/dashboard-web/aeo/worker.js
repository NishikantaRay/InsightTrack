// AEO (Answer Engine Optimization) edge worker for insightstrack.dev
//
// Cloudflare sits in front of the nginx/SPA origin. This worker wraps the
// static build (Vite dist/) with @dualmark/cloudflare so AI agents
// (ChatGPT/GPTBot, Claude/ClaudeBot, Perplexity, Gemini, Google AI Overviews)
// can content-negotiate and cite the Markdown twin of each page.
//
// Docs:  https://dualmark.dev/docs/integrations/cloudflare-workers
// Spec:  https://dualmark.dev/docs/spec/overview
//
// Fixes (AEO Spec v1.0 check IDs). Every header below is emitted by the
// library BY DEFAULT once the worker actually runs — verified by executing
// @dualmark/cloudflare@0.10.0 locally against a fixture:
//   md.contentType             -> /index.md served as text/markdown; charset=utf-8
//   md.tokensHeader            -> X-Markdown-Tokens (positive integer, built in)
//   md.noindex                 -> X-Robots-Tag: noindex on the twin (built in)
//   md.vary                    -> Vary: Accept on the twin (built in)
//   md.aeoVersion              -> X-AEO-Version: 1.0 (built in)
//   html.linkAlternate         -> Link: <...index.md>; rel="alternate" (enableLinkHeader)
//   html.vary                  -> Vary: Accept on HTML responses (built in)
//   negotiation.acceptHeader   -> Accept: text/markdown -> markdown (built in)
//   negotiation.botUa          -> GPTBot UA -> markdown (built in)
//   negotiation.notAcceptable  -> Accept excluding html+markdown -> 406 (built in)
//
// The twin is resolved by convention: /  -> /index.md, /blog -> /blog.md.
// Those .md files must exist in the ASSETS build (see public/index.md).

import { createAEOWorker } from "@dualmark/cloudflare";

// Upstream = the built static site served from the Assets binding.
// The worker runs first (run_worker_first: true in wrangler.jsonc), negotiates,
// then falls through to the assets for normal browser HTML requests.
const upstream = {
  async fetch(request, env, _ctx) {
    return env.ASSETS.fetch(request);
  },
};

export default createAEOWorker({
  upstream,

  // Emit the HTTP Link: rel="alternate"; type="text/markdown" header on HTML
  // responses.  ->  fixes html.linkAlternate
  enableLinkHeader: true,

  // Normalize /foo/ -> /foo so each page has one canonical twin.
  trailingSlash: "never",

  // Per-request AI-agent telemetry (dataset declared in wrangler.jsonc).
  // Remove this line if you don't create the Analytics Engine dataset.
  analytics: { binding: "AI_AGENT_ANALYTICS" },
});
// NOTE: X-AEO-Version, X-Robots-Tag: noindex, X-Markdown-Tokens, Vary: Accept,
// content negotiation, and the 406 fallback are all built into createAEOWorker
// — there are NO options for them (the only valid options are upstream,
// redirects, skip, analytics, trailingSlash, headers, hooks, enableLinkHeader,
// tokenizer). Earlier docs mentioned aeoVersion/strictNegotiation; those are
// not real and would break the build.
