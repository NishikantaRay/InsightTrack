/**
 * OpenAPI -> MCP tool definition mapper (F-02).
 *
 * Given an OpenAPI 3.0/3.1 document, produce one MCP tool definition per
 * operation. Each tool's inputSchema merges path/query/header parameters and the
 * JSON request body into a single object schema, and records enough binding
 * metadata for the runtime to reconstruct the upstream HTTP call.
 *
 * Design notes:
 *  - Pure and dependency-free: easy to unit test, provider-agnostic.
 *  - $ref resolution is limited to local component schemas (#/components/...),
 *    which covers the overwhelming majority of real-world specs. External refs
 *    are surfaced as a warning rather than throwing.
 *  - Tool names are derived from operationId when present, else method+path.
 *
 * A tool definition looks like:
 *   {
 *     name, description,
 *     inputSchema: { type: "object", properties, required? },
 *     operation: { method, pathTemplate, parameters: [{name, location}], hasBody }
 *   }
 * where location is one of "path" | "query" | "header" | "body".
 */

import { HTTP_METHODS } from "./spec.js";

/** Body parameters are nested under this key to avoid colliding with params. */
const BODY_PROPERTY = "body";

/**
 * @returns {{ tools: object[], warnings: object[] }}
 */
export function mapOpenApiToTools(doc) {
  const warnings = [];
  const tools = [];
  const usedNames = new Set();

  if (!doc.paths || typeof doc.paths !== "object") {
    return { tools, warnings };
  }

  const resolver = new RefResolver(doc, warnings);

  for (const [path, pathItem] of Object.entries(doc.paths)) {
    if (!pathItem) continue;
    const sharedParams = pathItem.parameters ?? [];

    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;

      const tool = buildTool({
        path,
        method,
        op,
        sharedParams,
        resolver,
        usedNames,
        warnings,
      });
      tools.push(tool);
    }
  }

  return { tools, warnings };
}

function buildTool(args) {
  const { path, method, op, sharedParams, resolver, usedNames, warnings } = args;

  const name = uniqueName(toolName(method, path, op), usedNames);
  const description =
    op.description?.trim() ||
    op.summary?.trim() ||
    `${method.toUpperCase()} ${path}`;

  const properties = {};
  const required = [];
  const bindings = [];

  // Operation-level params override path-level params with the same name+in.
  const params = mergeParameters(sharedParams, op.parameters ?? []);

  for (const param of params) {
    if (param.in === "cookie") {
      warnings.push({
        path,
        method,
        message: `cookie parameter "${param.name}" is not supported and was skipped`,
      });
      continue;
    }
    const schema = resolver.resolve(param.schema, path, method) ?? { type: "string" };
    const jsonSchema = toJsonSchema(schema, resolver, path, method);
    if (param.description && !jsonSchema.description) {
      jsonSchema.description = param.description;
    }
    properties[param.name] = jsonSchema;
    if (param.required) required.push(param.name);
    bindings.push({ name: param.name, location: param.in });
  }

  const body = extractJsonBody(op, resolver, path, method, warnings);
  let hasBody = false;
  if (body) {
    hasBody = true;
    properties[BODY_PROPERTY] = body.schema;
    if (body.required) required.push(BODY_PROPERTY);
    bindings.push({ name: BODY_PROPERTY, location: "body" });
  }

  const inputSchema = { type: "object", properties };
  if (required.length > 0) inputSchema.required = required;

  const operation = {
    method: method.toUpperCase(),
    pathTemplate: path,
    parameters: bindings,
    hasBody,
  };

  return { name, description, inputSchema, operation };
}

/** Merge shared + operation params; operation wins on (name, in) collisions. */
function mergeParameters(shared, own) {
  const byKey = new Map();
  for (const p of shared) byKey.set(`${p.in}:${p.name}`, p);
  for (const p of own) byKey.set(`${p.in}:${p.name}`, p);
  return [...byKey.values()];
}

function extractJsonBody(op, resolver, path, method, warnings) {
  const content = op.requestBody?.content;
  if (!content) return undefined;

  // Prefer application/json; fall back to the first JSON-ish media type.
  const jsonKey =
    Object.keys(content).find((k) => k === "application/json") ??
    Object.keys(content).find((k) => k.includes("json"));
  if (!jsonKey) {
    warnings.push({
      path,
      method,
      message: `request body has no JSON media type; body ignored`,
    });
    return undefined;
  }

  const media = content[jsonKey];
  const resolved = resolver.resolve(media?.schema, path, method);
  if (!resolved) return undefined;

  return {
    schema: toJsonSchema(resolved, resolver, path, method),
    required: op.requestBody?.required ?? false,
  };
}

/**
 * Convert an OpenAPI schema into the MCP JsonSchema subset, recursively
 * resolving nested refs. `visited` tracks $refs currently being expanded so
 * recursive schemas (e.g. a tree node) don't loop forever.
 */
function toJsonSchema(schema, resolver, path, method, visited = new Set()) {
  // If this node is a $ref we're already expanding, stop: a recursive schema
  // can't be flattened into a finite JSON Schema. Emit an open object so the
  // tool still works and record a warning.
  if (schema.$ref && visited.has(schema.$ref)) {
    resolver.warn(path, method, `circular $ref detected: ${schema.$ref}`);
    return { type: "object" };
  }
  const nextVisited = schema.$ref ? new Set(visited).add(schema.$ref) : visited;

  const resolved = resolver.resolve(schema, path, method) ?? {};

  // Flatten a single-branch allOf (common codegen pattern).
  if (resolved.allOf && resolved.allOf.length === 1) {
    return toJsonSchema(resolved.allOf[0], resolver, path, method, nextVisited);
  }

  const out = {};
  const type = normalizeType(resolved);
  if (type) out.type = type;
  if (resolved.description) out.description = resolved.description;
  if (resolved.enum) out.enum = resolved.enum;
  if (resolved.format) out.format = resolved.format;
  if (resolved.default !== undefined) out.default = resolved.default;

  if (resolved.properties) {
    out.type ??= "object";
    out.properties = {};
    for (const [key, sub] of Object.entries(resolved.properties)) {
      out.properties[key] = toJsonSchema(sub, resolver, path, method, nextVisited);
    }
  }
  if (resolved.required) out.required = resolved.required;

  if (resolved.items) {
    out.type ??= "array";
    out.items = toJsonSchema(resolved.items, resolver, path, method, nextVisited);
  }

  return out;
}

/** Reduce OpenAPI 3.1 union/nullable types to a single JSON Schema type. */
function normalizeType(schema) {
  const raw = schema.type;
  if (Array.isArray(raw)) {
    return raw.find((t) => t !== "null");
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Tool naming
// ---------------------------------------------------------------------------

/** MCP tool names must match [a-zA-Z0-9_]; keep them readable and stable. */
function toolName(method, path, op) {
  if (op.operationId && op.operationId.trim()) {
    return sanitize(op.operationId);
  }
  // Derive from method + path, dropping braces: GET /invoices/{id} -> get_invoices_id
  const pathPart = path
    .split("/")
    .filter(Boolean)
    .map((seg) => seg.replace(/[{}]/g, ""))
    .join("_");
  return sanitize(`${method}_${pathPart}`) || sanitize(method);
}

function sanitize(s) {
  return s
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function uniqueName(base, used) {
  let name = base || "tool";
  let i = 2;
  while (used.has(name)) {
    name = `${base}_${i++}`;
  }
  used.add(name);
  return name;
}

// ---------------------------------------------------------------------------
// $ref resolution (local component refs only)
// ---------------------------------------------------------------------------

class RefResolver {
  constructor(doc, warnings) {
    this.doc = doc;
    this.warnings = warnings;
  }

  /** Record a warning without resolving anything. */
  warn(path, method, message) {
    this.warnings.push({ path, method, message });
  }

  /**
   * Resolve a schema that may be a `$ref`. Only local refs of the form
   * `#/components/schemas/Name` are followed. Guards against ref cycles.
   */
  resolve(schema, path, method, seen = new Set()) {
    if (!schema) return undefined;
    if (!schema.$ref) return schema;

    const ref = schema.$ref;
    if (seen.has(ref)) {
      this.warnings.push({ path, method, message: `circular $ref detected: ${ref}` });
      return {};
    }
    seen.add(ref);

    const match = /^#\/components\/schemas\/(.+)$/.exec(ref);
    if (!match) {
      this.warnings.push({
        path,
        method,
        message: `unsupported $ref (external or non-schema): ${ref}`,
      });
      return {};
    }
    const target = this.doc.components?.schemas?.[match[1]];
    if (!target) {
      this.warnings.push({ path, method, message: `unresolved $ref: ${ref}` });
      return {};
    }
    return this.resolve(target, path, method, seen);
  }
}
