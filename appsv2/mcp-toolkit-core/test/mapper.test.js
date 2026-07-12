import { describe, it, expect } from "vitest";
import { mapOpenApiToTools } from "../src/openapi/mapper.js";

function findTool(res, name) {
  const t = res.tools.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not found; got ${res.tools.map((x) => x.name).join(", ")}`);
  return t;
}

describe("mapOpenApiToTools", () => {
  it("returns empty for a doc with no paths", () => {
    const res = mapOpenApiToTools({ openapi: "3.1.0" });
    expect(res.tools).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it("maps a GET with path + query params", () => {
    const doc = {
      openapi: "3.0.3",
      paths: {
        "/invoices/{id}": {
          get: {
            operationId: "getInvoice",
            summary: "Fetch an invoice",
            parameters: [
              { name: "id", in: "path", required: true, schema: { type: "string" } },
              { name: "expand", in: "query", schema: { type: "boolean" } },
            ],
          },
        },
      },
    };
    const res = mapOpenApiToTools(doc);
    const tool = findTool(res, "getInvoice");
    expect(tool.operation.method).toBe("GET");
    expect(tool.operation.pathTemplate).toBe("/invoices/{id}");
    expect(tool.inputSchema.properties).toHaveProperty("id");
    expect(tool.inputSchema.properties).toHaveProperty("expand");
    expect(tool.inputSchema.required).toEqual(["id"]);
    expect(tool.operation.parameters).toContainEqual({ name: "id", location: "path" });
    expect(tool.operation.parameters).toContainEqual({ name: "expand", location: "query" });
    expect(tool.operation.hasBody).toBe(false);
  });

  it("maps a POST with a JSON body and marks it required", () => {
    const doc = {
      openapi: "3.1.0",
      paths: {
        "/invoices": {
          post: {
            operationId: "createInvoice",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { amount: { type: "integer" }, currency: { type: "string" } },
                    required: ["amount"],
                  },
                },
              },
            },
          },
        },
      },
    };
    const res = mapOpenApiToTools(doc);
    const tool = findTool(res, "createInvoice");
    expect(tool.operation.hasBody).toBe(true);
    expect(tool.inputSchema.required).toContain("body");
    const body = tool.inputSchema.properties.body;
    expect(body.type).toBe("object");
    expect(body.properties).toHaveProperty("amount");
    expect(tool.operation.parameters).toContainEqual({ name: "body", location: "body" });
  });

  it("resolves local $refs in the request body", () => {
    const doc = {
      openapi: "3.0.0",
      components: {
        schemas: {
          Pet: {
            type: "object",
            properties: { name: { type: "string" }, tag: { type: "string" } },
            required: ["name"],
          },
        },
      },
      paths: {
        "/pets": {
          post: {
            operationId: "addPet",
            requestBody: {
              content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } },
            },
          },
        },
      },
    };
    const res = mapOpenApiToTools(doc);
    const tool = findTool(res, "addPet");
    expect(tool.inputSchema.properties.body.properties).toHaveProperty("name");
    expect(tool.inputSchema.properties.body.required).toEqual(["name"]);
    expect(res.warnings).toEqual([]);
  });

  it("derives a tool name from method+path when operationId is missing", () => {
    const doc = {
      openapi: "3.1.0",
      paths: { "/users/{id}/posts": { get: {} } },
    };
    const res = mapOpenApiToTools(doc);
    expect(res.tools[0].name).toBe("get_users_id_posts");
  });

  it("disambiguates duplicate tool names", () => {
    const doc = {
      openapi: "3.1.0",
      paths: {
        "/a": { get: { operationId: "dup" } },
        "/b": { get: { operationId: "dup" } },
      },
    };
    const res = mapOpenApiToTools(doc);
    const names = res.tools.map((t) => t.name).sort();
    expect(names).toEqual(["dup", "dup_2"]);
  });

  it("merges path-level params and lets operation params override", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/things/{id}": {
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          get: {
            operationId: "getThing",
            parameters: [
              { name: "id", in: "path", required: true, description: "the id", schema: { type: "string" } },
            ],
          },
        },
      },
    };
    const res = mapOpenApiToTools(doc);
    const tool = findTool(res, "getThing");
    const idParams = tool.operation.parameters.filter((p) => p.name === "id");
    expect(idParams).toHaveLength(1);
    expect(tool.inputSchema.properties.id.description).toBe("the id");
  });

  it("normalizes OpenAPI 3.1 nullable union types to a single type", () => {
    const doc = {
      openapi: "3.1.0",
      paths: {
        "/x": {
          get: {
            operationId: "getX",
            parameters: [{ name: "q", in: "query", schema: { type: ["string", "null"] } }],
          },
        },
      },
    };
    const res = mapOpenApiToTools(doc);
    expect(findTool(res, "getX").inputSchema.properties.q.type).toBe("string");
  });

  it("warns and skips unsupported external $refs", () => {
    const doc = {
      openapi: "3.0.0",
      paths: {
        "/y": {
          post: {
            operationId: "postY",
            requestBody: {
              content: { "application/json": { schema: { $ref: "https://example.com/schema.json" } } },
            },
          },
        },
      },
    };
    const res = mapOpenApiToTools(doc);
    expect(res.warnings.some((w) => /unsupported \$ref/.test(w.message))).toBe(true);
  });

  it("handles circular $refs without infinite recursion", () => {
    const doc = {
      openapi: "3.0.0",
      components: {
        schemas: {
          Node: {
            type: "object",
            properties: { next: { $ref: "#/components/schemas/Node" } },
          },
        },
      },
      paths: {
        "/n": {
          post: {
            operationId: "postN",
            requestBody: {
              content: { "application/json": { schema: { $ref: "#/components/schemas/Node" } } },
            },
          },
        },
      },
    };
    const res = mapOpenApiToTools(doc);
    expect(res.warnings.some((w) => /circular/.test(w.message))).toBe(true);
    expect(findTool(res, "postN")).toBeTruthy();
  });
});
