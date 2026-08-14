import { canTouchSite, type Site } from '@charva/contracts';
import { and, asc, type Column, desc, eq, getTableColumns, or, type SQL, sql } from 'drizzle-orm';

import { type Database } from '../../../db/client';
import { type AuditContext, diffRows, recordAudit } from '../../../lib/audit';
import { type AdminIdentity } from '../../../plugins/admin-auth';
import { ApiProblem, notFound } from '../../../plugins/error-handler';

import { type FieldSpec, fromWire, searchLang, toWire } from './fields';
import { type AdminResource } from './resources';

/**
 * One implementation of list, read, create, update, delete and reorder, for every table in the
 * registry.
 *
 * Three things happen on every write and none of them are the caller's to remember: the site
 * scope is checked against the row, an audit row is written carrying only what changed, and the
 * public response cache is dropped. A per-entity handler would have to remember all three
 * twenty times, and the twentieth would forget one.
 */

export interface CrudContext {
  db: Database;
  audit: AuditContext;
  actor: AdminIdentity;
  ip: string;
  /** Bumps the generation of the public cache, so an edit is visible on the next request. */
  invalidate: () => void;
}

export interface ListQuery {
  page: number;
  perPage: number;
  q?: string | undefined;
  sort?: string | undefined;
  dir?: 'asc' | 'desc' | undefined;
  /** Whatever the resource declared filterable, as it arrived in the query string. */
  filters: Record<string, string>;
}

export interface ListResult {
  items: Record<string, unknown>[];
  meta: { page: number; perPage: number; total: number; totalPages: number; hasMore: boolean };
}

function columnsOf(resource: AdminResource): Record<string, Column> {
  return getTableColumns(resource.table);
}

function columnOf(resource: AdminResource, name: string): Column {
  const column = columnsOf(resource)[name];
  if (column === undefined) throw new Error(`${resource.name} has no column ${name}`);
  return column;
}

function fieldOf(resource: AdminResource, name: string): FieldSpec | undefined {
  return resource.fields.find((field) => field.name === name);
}

/**
 * May this account touch this row?
 *
 * Two cases. Most resources belong to one site by definition — a tour is Global whatever is in
 * it. The shared ones carry the site in a column, and then the row decides: an Umrah editor
 * may write the pilgrimage's content blocks and not the country facts on Global.
 */
function assertScope(
  context: CrudContext,
  resource: AdminResource,
  row?: Record<string, unknown>,
): void {
  const site: Site | null =
    resource.site ?? (typeof row?.['site'] === 'string' ? (row['site'] as Site) : null);

  if (site === null) return;
  if (canTouchSite(context.actor, site)) return;

  throw new ApiProblem(
    'forbidden',
    `This account is scoped to ${context.actor.siteScope ?? 'both sites'}`,
  );
}

// ------------------------------------------------------------------------------------------
// Reading
// ------------------------------------------------------------------------------------------

export async function listRows(
  context: CrudContext,
  resource: AdminResource,
  query: ListQuery,
): Promise<ListResult> {
  const where = buildWhere(context, resource, query);
  const order = buildOrder(resource, query);
  const offset = (query.page - 1) * query.perPage;

  const rows = await context.db
    .select()
    .from(resource.table)
    .where(where)
    .orderBy(...order)
    .limit(query.perPage)
    .offset(offset);

  const [counted] = await context.db
    .select({ total: sql<number>`COUNT(*)` })
    .from(resource.table)
    .where(where);

  const total = counted?.total ?? 0;

  return {
    items: rows.map((row) => toWire(row as Record<string, unknown>, resource.fields)),
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      hasMore: offset + rows.length < total,
    },
  };
}

export async function getRow(
  context: CrudContext,
  resource: AdminResource,
  id: number,
): Promise<Record<string, unknown>> {
  const row = await loadRow(context, resource, id);
  assertScope(context, resource, row);
  return toWire(row, resource.fields);
}

async function loadRow(
  context: CrudContext,
  resource: AdminResource,
  id: number,
): Promise<Record<string, unknown>> {
  const [row] = await context.db
    .select()
    .from(resource.table)
    .where(eq(columnOf(resource, 'id'), id))
    .limit(1);

  if (row === undefined) throw notFound(`${resource.name} #${String(id)}`);
  return row;
}

function buildWhere(
  context: CrudContext,
  resource: AdminResource,
  query: ListQuery,
): SQL | undefined {
  const conditions: SQL[] = [];

  for (const [name, raw] of Object.entries(query.filters)) {
    if (!resource.filters.includes(name)) continue;
    const field = fieldOf(resource, name);
    if (field === undefined) continue;
    conditions.push(eq(columnOf(resource, name), coerce(raw, field)));
  }

  /*
   * An account scoped to one site sees only that site's rows in a shared list.
   *
   * Filtering rather than refusing: a list that answers 403 because it happens to contain one
   * row from the other site would be unusable, and hiding what cannot be edited is what the
   * scope means.
   */
  if (resource.site === null && context.actor.siteScope !== null) {
    const siteField = fieldOf(resource, 'site');
    if (siteField !== undefined) {
      conditions.push(eq(columnOf(resource, 'site'), context.actor.siteScope));
    }
  }

  const search = buildSearch(resource, query.q);
  if (search !== undefined) conditions.push(search);

  return conditions.length === 0 ? undefined : and(...conditions);
}

/**
 * The search box.
 *
 * Translated columns are searched through the site's default language — `$.ru` on Global,
 * `$.tm` on Umrah — which is the language whatever the editor typed is almost certainly in, and
 * the one the phase-2 functional indexes are built on.
 */
function buildSearch(resource: AdminResource, term: string | undefined): SQL | undefined {
  const needle = term?.trim();
  if (needle === undefined || needle === '') return undefined;
  if (resource.search.length === 0) return undefined;

  const pattern = `%${needle}%`;
  const path = `$."${searchLang(resource.site)}"`;

  const clauses = resource.search.map((name) => {
    const column = columnOf(resource, name);
    const field = fieldOf(resource, name);

    return field?.kind === 'localized'
      ? sql`JSON_UNQUOTE(JSON_EXTRACT(${column}, ${path})) LIKE ${pattern}`
      : sql`${column} LIKE ${pattern}`;
  });

  return or(...clauses);
}

function buildOrder(resource: AdminResource, query: ListQuery): SQL[] {
  const direction = query.dir === 'desc' ? desc : asc;

  if (query.sort !== undefined) {
    const field = fieldOf(resource, query.sort);
    // Scalar columns only. Ordering by a JSON column orders by its serialised bytes, which is
    // an ordering nobody asked for and nobody can predict.
    if (field !== undefined && field.kind !== 'json' && field.kind !== 'localized') {
      return [direction(columnOf(resource, query.sort))];
    }
  }

  return resource.orderBy.map((name) => direction(columnOf(resource, name)));
}

/** A query-string value, in the type its column expects. */
function coerce(raw: string, field: FieldSpec): unknown {
  if (field.kind === 'boolean') return raw === 'true' || raw === '1';
  if (field.kind === 'int' || field.kind === 'money') return Number(raw);
  return raw;
}

// ------------------------------------------------------------------------------------------
// Writing
// ------------------------------------------------------------------------------------------

export async function createRow(
  context: CrudContext,
  resource: AdminResource,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const values = fromWire(body, resource.fields);
  assertScope(context, resource, values);

  const id = await translateDbErrors(async () => {
    const [result] = await context.db.insert(resource.table).values(values);
    return result.insertId;
  });

  const row = await loadRow(context, resource, id);
  const wire = toWire(row, resource.fields);

  await recordAudit(context.audit, {
    actorId: context.actor.id,
    action: 'create',
    entity: resource.name,
    entityId: id,
    after: wire,
    ip: context.ip,
  });
  context.invalidate();

  return wire;
}

export async function updateRow(
  context: CrudContext,
  resource: AdminResource,
  id: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const before = await loadRow(context, resource, id);
  assertScope(context, resource, before);

  const values = fromWire(body, resource.fields);
  // A move between sites is a scope change, so both ends have to be allowed.
  assertScope(context, resource, { ...before, ...values });

  if (Object.keys(values).length > 0) {
    await translateDbErrors(async () => {
      await context.db
        .update(resource.table)
        .set(values)
        .where(eq(columnOf(resource, 'id'), id));
    });
  }

  const after = await loadRow(context, resource, id);
  const beforeWire = toWire(before, resource.fields);
  const afterWire = toWire(after, resource.fields);
  const changes = diffRows(beforeWire, afterWire);

  /*
   * A save that changed nothing writes nothing.
   *
   * An editor who opens a form and presses save is not an event; a log full of those is a log
   * in which the real edit is hard to find.
   */
  if (changes !== null) {
    await recordAudit(context.audit, {
      actorId: context.actor.id,
      action: 'update',
      entity: resource.name,
      entityId: id,
      before: changes.before,
      after: changes.after,
      ip: context.ip,
    });
    context.invalidate();
  }

  return afterWire;
}

export async function deleteRow(
  context: CrudContext,
  resource: AdminResource,
  id: number,
): Promise<void> {
  const before = await loadRow(context, resource, id);
  assertScope(context, resource, before);

  await translateDbErrors(async () => {
    await context.db.delete(resource.table).where(eq(columnOf(resource, 'id'), id));
  });

  await recordAudit(context.audit, {
    actorId: context.actor.id,
    action: 'delete',
    entity: resource.name,
    entityId: id,
    // The whole row, not a diff: this is the only record that it ever existed.
    before: toWire(before, resource.fields),
    ip: context.ip,
  });
  context.invalidate();
}

export interface ReorderItem {
  id: number;
  sortOrder: number;
}

/**
 * A dragged list, saved in one transaction.
 *
 * All of it or none of it: a partial reorder leaves two rows claiming position three, and the
 * list the editor is looking at stops matching the list the site renders.
 */
export async function reorderRows(
  context: CrudContext,
  resource: AdminResource,
  items: ReorderItem[],
): Promise<void> {
  if (!resource.orderable) {
    throw new ApiProblem('conflict', `${resource.name} has no order to change`);
  }
  if (items.length === 0) return;

  const idColumn = columnOf(resource, 'id');

  const rows = await context.db
    .select()
    .from(resource.table)
    .where(or(...items.map((item) => eq(idColumn, item.id))));

  if (rows.length !== items.length) {
    throw notFound(`some of the ${resource.name} rows`);
  }
  for (const row of rows) assertScope(context, resource, row);

  await context.db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(resource.table)
        .set({ sortOrder: item.sortOrder })
        .where(eq(idColumn, item.id));
    }
  });

  await recordAudit(context.audit, {
    actorId: context.actor.id,
    action: 'reorder',
    entity: resource.name,
    entityId: null,
    after: items,
    ip: context.ip,
  });
  context.invalidate();
}

/**
 * The database's own rules, turned into answers an editor can act on.
 *
 * Phase 2 deliberately put every invariant into MySQL — unique slugs, `CHECK` on seat counts,
 * `JSON_SCHEMA_VALID` on translated columns, `STRICT_TRANS_TABLES` on lengths — because a rule
 * that can be broken from a SQL console is not a rule. The cost is that they surface as driver
 * errors, and an unmapped driver error is a 500 saying «something went wrong» to somebody whose
 * actual problem is that the slug is taken.
 */
async function translateDbErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    /*
     * Drizzle wraps the driver error, and its own message is the SQL *with the parameters
     * appended*. Echoing it to the client would put the values of the row being written into a
     * response body — on `admin_users` that is a password hash, on `umrah_signups` a sealed
     * passport. So the raw message never leaves this function: only the name of the constraint
     * that fired, pulled out of the driver's own `sqlMessage`.
     */
    const driver = ((error as { cause?: unknown }).cause ?? error) as {
      code?: string;
      sqlMessage?: string;
    };
    const sqlMessage = driver.sqlMessage ?? '';

    if (driver.code === 'ER_DUP_ENTRY') {
      const key = /for key '(?:[^'.]+\.)?([^']+)'/.exec(sqlMessage)?.[1] ?? 'unique';
      throw new ApiProblem('conflict', 'A row with that key already exists', [
        { path: key, message: 'already taken' },
      ]);
    }
    if (driver.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      const check = /check constraint '([^']+)'/i.exec(sqlMessage)?.[1] ?? 'check';
      throw new ApiProblem('validation_failed', 'The database refused those values', [
        { path: check, message: 'violates a constraint' },
      ]);
    }
    if (driver.code === 'ER_DATA_TOO_LONG' || driver.code === 'WARN_DATA_TRUNCATED') {
      const column = /column '([^']+)'/i.exec(sqlMessage)?.[1] ?? 'value';
      throw new ApiProblem('validation_failed', 'A value is too long for its column', [
        { path: column, message: 'too long' },
      ]);
    }
    throw error;
  }
}
