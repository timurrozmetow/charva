import {
  adminOkResponse,
  adminReorderRequest,
  adminResourcesResponse,
  adminRowsMeta,
} from '@charva/contracts';
import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { type AuditContext } from '../../../lib/audit';
import { currentAdmin } from '../../../plugins/admin-auth';
import { auditContext } from '../context';

import { rowSchemaOf, writeSchemaOf } from './fields';
import { ADMIN_RESOURCES, type AdminResource } from './resources';
import {
  createRow,
  type CrudContext,
  deleteRow,
  getRow,
  listRows,
  type ListQuery,
  reorderRows,
  updateRow,
} from './service';

/**
 * Six routes per table, written once.
 *
 * The schemas are generated from the tables rather than hand-written twenty times, so the rule
 * that every route declares a response schema — the mechanism of D-12 — holds here without
 * twenty opportunities to get a field name wrong. `/docs` gets the real column list for every
 * entity as a side effect.
 *
 * `GET /admin/resources` is what makes one list screen and one form screen serve all of them:
 * the SPA asks what the columns are instead of being told, in TypeScript, twenty times.
 */
export function registerCrudRoutes(instance: FastifyInstance): void {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/resources',
    {
      preHandler: app.requireAdmin('content.read'),
      schema: {
        tags: ['admin'],
        summary: 'Every editable table, described well enough to build a screen from',
        response: { 200: adminResourcesResponse },
      },
    },
    () => ({
      resources: ADMIN_RESOURCES.map((resource) => ({
        name: resource.name,
        site: resource.site,
        capability: resource.capability,
        fields: resource.fields,
        search: [...resource.search],
        filters: [...resource.filters],
        orderable: resource.orderable,
      })),
    }),
  );

  for (const resource of ADMIN_RESOURCES) registerResource(app, resource);
}

function registerResource(
  app: ReturnType<FastifyInstance['withTypeProvider']>,
  resource: AdminResource,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  const rowSchema = rowSchemaOf(resource.fields);
  const createSchema = writeSchemaOf(resource.fields, resource.site);
  // Every field optional: a form that saves one language tab must not have to resend the rest.
  const updateSchema = (createSchema as z.ZodObject<z.ZodRawShape>).partial().strict();

  const listQuery = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      // A ceiling, because «all of them» is what a crawler asks for.
      perPage: z.coerce.number().int().min(1).max(200).default(25),
      q: z.string().max(120).optional(),
      sort: z.string().max(60).optional(),
      dir: z.enum(['asc', 'desc']).optional(),
      ...Object.fromEntries(resource.filters.map((name) => [name, z.string().max(120).optional()])),
    })
    .strict();

  const idParams = z.object({ id: z.coerce.number().int().positive() });
  const base = `/${resource.name}`;
  const tags = ['admin'];

  typed.get(
    base,
    {
      preHandler: typed.requireAdmin('content.read'),
      schema: {
        tags,
        summary: `List ${resource.name}`,
        querystring: listQuery,
        response: { 200: z.object({ items: z.array(rowSchema), meta: adminRowsMeta }) },
      },
    },
    async (request) =>
      listRows(crudContext(typed, request), resource, toListQuery(request.query, resource)),
  );

  typed.get(
    `${base}/:id`,
    {
      preHandler: typed.requireAdmin('content.read'),
      schema: {
        tags,
        summary: `One row of ${resource.name}`,
        params: idParams,
        response: { 200: rowSchema },
      },
    },
    async (request) => getRow(crudContext(typed, request), resource, request.params.id),
  );

  typed.post(
    base,
    {
      preHandler: typed.requireAdmin(resource.capability),
      schema: {
        tags,
        summary: `Create a row of ${resource.name}`,
        body: createSchema,
        response: { 201: rowSchema },
      },
    },
    async (request, reply) => {
      const row = await createRow(
        crudContext(typed, request),
        resource,
        request.body as Record<string, unknown>,
      );
      return reply.code(201).send(row);
    },
  );

  typed.patch(
    `${base}/:id`,
    {
      preHandler: typed.requireAdmin(resource.capability),
      schema: {
        tags,
        summary: `Update a row of ${resource.name}`,
        params: idParams,
        body: updateSchema,
        response: { 200: rowSchema },
      },
    },
    async (request) =>
      updateRow(
        crudContext(typed, request),
        resource,
        request.params.id,
        request.body as Record<string, unknown>,
      ),
  );

  typed.delete(
    `${base}/:id`,
    {
      preHandler: typed.requireAdmin(resource.capability),
      schema: {
        tags,
        summary: `Delete a row of ${resource.name}`,
        params: idParams,
        response: { 200: adminOkResponse },
      },
    },
    async (request) => {
      await deleteRow(crudContext(typed, request), resource, request.params.id);
      return { ok: true as const };
    },
  );

  if (resource.orderable) {
    typed.post(
      `${base}/reorder`,
      {
        preHandler: typed.requireAdmin(resource.capability),
        schema: {
          tags,
          summary: `Save a dragged order for ${resource.name}`,
          description:
            'One transaction: a partial reorder leaves two rows claiming position three, and ' +
            'the list the editor is looking at stops matching the list the site renders.',
          body: adminReorderRequest,
          response: { 200: adminOkResponse },
        },
      },
      async (request) => {
        await reorderRows(crudContext(typed, request), resource, request.body.items);
        return { ok: true as const };
      },
    );
  }
}

function crudContext(app: FastifyInstance, request: FastifyRequest): CrudContext {
  const audit: AuditContext = auditContext(app, request);

  return {
    db: app.db,
    audit,
    actor: currentAdmin(request),
    ip: request.ip,
    // The public cache is a generation counter, so an edit anywhere clears all of it. Deciding
    // which entries one edit touched is the kind of cleverness that ends with an editor saying
    // «my change is not showing» and nobody able to reproduce it.
    invalidate: () => {
      app.responseCache.invalidate();
    },
  };
}

/** The validated query, split into the parts the service takes. */
function toListQuery(query: unknown, resource: AdminResource): ListQuery {
  const source = query as Record<string, unknown>;
  const filters: Record<string, string> = {};

  for (const name of resource.filters) {
    const value = source[name];
    if (typeof value === 'string' && value !== '') filters[name] = value;
  }

  return {
    page: Number(source['page'] ?? 1),
    perPage: Number(source['perPage'] ?? 25),
    q: typeof source['q'] === 'string' ? source['q'] : undefined,
    sort: typeof source['sort'] === 'string' ? source['sort'] : undefined,
    dir: source['dir'] === 'desc' ? 'desc' : source['dir'] === 'asc' ? 'asc' : undefined,
    filters,
  };
}
