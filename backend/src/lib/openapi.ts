import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';

extendZodWithOpenApi(z);

/**
 * OpenAPI registry. Routers call `doc()` next to each route so the documentation stays in
 * sync with the implementation. Served at /api/docs (Swagger UI) and /api/openapi.json.
 */
export const registry = new OpenAPIRegistry();
registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.any().optional() }) });

interface DocOpts {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string; // express style (/:id) — converted to {id}
  tag: string;
  summary: string;
  auth?: boolean;
  permission?: string;
  body?: ZodTypeAny;
  query?: z.AnyZodObject;
  multipart?: boolean;
  response?: ZodTypeAny;
}

export function doc(o: DocOpts) {
  const path = o.path.replace(/:([A-Za-z]+)/g, '{$1}');
  const params = [...o.path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]!);
  registry.registerPath({
    method: o.method,
    path,
    tags: [o.tag],
    summary: o.summary,
    description: o.permission ? `Requires permission: \`${o.permission}\`` : undefined,
    security: o.auth ? [{ bearerAuth: [] }] : undefined,
    request: {
      params: params.length ? z.object(Object.fromEntries(params.map((p) => [p, z.string()]))) : undefined,
      query: o.query,
      body: o.body
        ? { content: { 'application/json': { schema: o.body } } }
        : o.multipart
          ? { content: { 'multipart/form-data': { schema: z.object({ file: z.any().openapi({ type: 'string', format: 'binary' }) }) } } }
          : undefined,
    },
    responses: {
      200: { description: 'Success', content: o.response ? { 'application/json': { schema: o.response } } : { 'application/json': { schema: z.any() } } },
      ...(o.auth ? { 401: { description: 'Unauthenticated', content: { 'application/json': { schema: ErrorBody } } }, 403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorBody } } } } : {}),
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorBody } } },
      422: { description: 'Validation error', content: { 'application/json': { schema: ErrorBody } } },
    },
  });
}

export function openApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'SST Platform API',
      version: '1.0.0',
      description:
        'REST API for the SST Public School Rashidabad website and administration portal.\n\n' +
        '* `/api/public/*` — read-only, returns **published** content only. Responses include a `media` dictionary keyed by media id.\n' +
        '* `/api/admin/*` — requires a Bearer access token (obtained from `/api/admin/auth/login`) and the listed permission.',
    },
    servers: [{ url: '/' }],
  });
}
