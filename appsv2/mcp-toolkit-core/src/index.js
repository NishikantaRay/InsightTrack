/**
 * @mcp-toolkit/core — provider-agnostic engine for the MCP SaaS Toolkit (JS).
 *
 * Two pillars:
 *  - OpenAPI -> MCP tool mapping (F-02)
 *  - Platform Connect signing / verification (F-09)
 */

export { HTTP_METHODS } from "./openapi/spec.js";
export { mapOpenApiToTools } from "./openapi/mapper.js";
export {
  computeSignature,
  signRequest,
  verifyRequest,
  ReplayGuard,
} from "./connect/signing.js";
export { sharedSecretKey, InMemoryKeyStore } from "./connect/keystore.js";
