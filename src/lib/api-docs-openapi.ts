import { API_ENDPOINTS, API_GROUPS, type ApiEndpoint } from "./api-docs-data";

/**
 * OpenAPI 3.1 export — generated from the same registry that drives the
 * /docs/api explorer, the endpoint code snippets, and the Try-it console, so
 * the machine-readable spec can never drift from the human-readable docs.
 *
 * Framework-free: the builder is a pure function over the registry, unit-tested
 * in src/lib/__tests__/api-docs-openapi.test.ts.
 *
 * Two auth surfaces mirror the product:
 *  - `ApiKeyAuth`      — Bearer `dash_…` keys, the sandboxed /v1 surface
 *  - `SessionCookieAuth` — the `token` cookie minted by /api/auth/login
 */

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  tags: string[];
  security?: Record<string, string[]>[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  "x-sandbox"?: boolean;
}

export interface OpenApiParameter {
  name: string;
  in: "query";
  required: boolean;
  description: string;
  schema: { type: string };
}

export interface OpenApiRequestBody {
  required: boolean;
  content: {
    "application/json": {
      schema: {
        type: "object";
        properties: Record<string, { type: string; description: string }>;
      };
    };
  };
}

export interface OpenApiResponse {
  description: string;
  content?: {
    "application/json": { schema?: Record<string, unknown>; example?: unknown };
  };
}

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    securitySchemes: Record<
      string,
      {
        type: string;
        scheme?: string;
        bearerFormat?: string;
        in?: string;
        name?: string;
        description: string;
      }
    >;
  };
}

/** Heuristic schema type for a documented field, from its description text. */
function schemaTypeFor(field: string, description: string): string {
  if (/cents|stock|quantity|\bvalue\b|price/i.test(`${field} ${description}`)) {
    return "number";
  }
  if (/^(id|limit|page)$/i.test(field) || /count|max results/i.test(description)) {
    return "integer";
  }
  if (/true\/false/i.test(description)) {
    return "boolean";
  }
  if (/items|ids/i.test(field)) {
    return "array";
  }
  return "string";
}

/** Query params are optional except the handful the description marks required. */
function isRequiredParam(description: string): boolean {
  return /required|search query|min 2/i.test(description);
}

function operationIdFor(ep: ApiEndpoint): string {
  const pathPart = ep.path
    .replace(/^\/api\//, "")
    .replace(/[/:]/g, " ")
    .trim()
    .split(/\s+/)
    .map((seg, i) =>
      i === 0 ? seg.toLowerCase() : seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase(),
    )
    .join("");
  return `${ep.method.toLowerCase()}${pathPart.charAt(0).toUpperCase()}${pathPart.slice(1)}`;
}

function operationFor(ep: ApiEndpoint): OpenApiOperation {
  const op: OpenApiOperation = {
    operationId: operationIdFor(ep),
    summary: ep.description,
    tags: [ep.group],
    responses: {
      "200": {
        description: "Successful response",
        ...(ep.responseExample
          ? {
              content: {
                "application/json": {
                  example: JSON.parse(ep.responseExample),
                },
              },
            }
          : {}),
      },
      ...(ep.requiresAuth
        ? {
            "401": {
              description: ep.sandbox
                ? "Missing, invalid, revoked, or expired API key (`invalid_api_key`, `key_revoked`, `key_expired`)"
                : "No or invalid session — sign in via /api/auth/login",
            },
          }
        : {}),
    },
  };

  if (ep.sandbox) {
    op["x-sandbox"] = true;
    op.security = [{ ApiKeyAuth: [] }];
  } else if (ep.requiresAuth) {
    op.security = [{ SessionCookieAuth: [] }];
  }

  if (ep.queryParams) {
    op.parameters = Object.entries(ep.queryParams).map(([name, description]) => ({
      name,
      in: "query" as const,
      required: isRequiredParam(description),
      description,
      schema: { type: schemaTypeFor(name, description) },
    }));
  }

  if (ep.requestBody) {
    const properties = Object.fromEntries(
      Object.entries(ep.requestBody).map(([field, description]) => [
        field,
        { type: schemaTypeFor(field, description), description },
      ]),
    );
    op.requestBody = {
      required: true,
      content: {
        "application/json": { schema: { type: "object", properties } },
      },
    };
  }

  return op;
}

/** `/api/v1/products/:id` → `/api/v1/products/{id}` (OpenAPI path-template syntax). */
function toPathTemplate(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

export function buildOpenApiDocument(): OpenApiDocument {
  const paths: OpenApiDocument["paths"] = {};
  for (const ep of API_ENDPOINTS) {
    const template = toPathTemplate(ep.path);
    paths[template] ??= {};
    // Registry never holds two ops with the same method+path.
    paths[template][ep.method.toLowerCase()] = operationFor(ep);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Dashboard API",
      version: "1.0.0",
      description: [
        "Commercial analytics, billing, and operations API.",
        "",
        "Two authentication surfaces:",
        "- **Session cookie** — dashboard endpoints authenticate with the `token` cookie minted by `POST /api/auth/login`.",
        "- **API key (sandbox)** — the read-only `/api/v1` surface authenticates with a Bearer `dash_…` key minted under Integrations → API Keys. Keys are shown once at creation, hashed at rest, workspace-scoped, and rate-limited.",
      ].join("\n"),
    },
    servers: [{ url: "/", description: "Current deployment" }],
    tags: API_GROUPS.map((name) => ({
      name,
      description:
        name === "API Sandbox"
          ? "Sandboxed read-only surface authenticated by API key — safe for docs readers and integrations."
          : `Dashboard ${name.toLowerCase()} endpoints (session cookie authentication).`,
    })),
    paths,
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "dash_…",
          description:
            "API key from Integrations → API Keys (`dash_` + 64 hex chars). Send as `Authorization: Bearer dash_…`. Only the sandboxed `/api/v1` surface accepts keys.",
        },
        SessionCookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
          description:
            "Session JWT set by `POST /api/auth/login`. Browser clients get it automatically; server-to-server callers should prefer the API-key surface.",
        },
      },
    },
  };
}
