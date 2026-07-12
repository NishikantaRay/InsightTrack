# mcp-toolkit-core (JS)

Plain-JavaScript (ESM) build of the MCP SaaS Toolkit core engine. Turns any API
into MCP tool definitions and handles the Platform Connect signed-token
handshake. No build step, no TypeScript — runs directly on Node ≥ 18.

## Modules

| File | Purpose |
|---|---|
| `src/openapi/mapper.js` | OpenAPI 3.0/3.1 → MCP tool definitions (F-02). Cycle-safe local `$ref` resolution. |
| `src/connect/signing.js` | HMAC-SHA256 sign/verify + nonce `ReplayGuard` (F-09). |
| `src/connect/keystore.js` | `KeyStore` shape + `InMemoryKeyStore`. Customer AI keys are never stored. |
| `src/index.js` | Public exports. |

## Usage

```js
import { mapOpenApiToTools, signRequest, verifyRequest } from "mcp-toolkit-core";

const { tools, warnings } = mapOpenApiToTools(openApiDoc);
const req = signRequest(sharedSecret, "proj_abc123");
const result = verifyRequest(sharedSecret, req); // { ok: true } | { ok: false, reason }
```

## Test

```bash
npm install
npm test    # vitest, 21 tests
```
