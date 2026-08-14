import {
  type AdminField,
  DEFAULT_LANG,
  type FieldKind,
  type Site,
  SITE_LANGS,
} from '@charva/contracts';
import { getTableColumns } from 'drizzle-orm';
import { type MySqlTable } from 'drizzle-orm/mysql-core';
import { z } from 'zod';

/**
 * A table, described well enough to build a form and a wire schema from it.
 *
 * The alternative was writing a Zod pair and a form layout for each of twenty tables by hand,
 * which is the same fifteen-to-twenty screens of near-identical code the CRUD frame exists to
 * avoid — and which drifts from the columns the moment a migration lands. Here the description
 * is read from the Drizzle table itself, so a new column appears in the admin by existing, and
 * a renamed one cannot leave a form field pointing at nothing.
 *
 * What Drizzle cannot tell us is which JSON column holds translated text and which holds a bag
 * of anything: both are `MySqlJson`. That one fact is declared per resource, and it is the only
 * thing the registry has to say about a column.
 */

/**
 * The description of one column, in the shape the admin SPA is served.
 *
 * `AdminField` is declared in contracts because both ends read it — the server writes it from
 * the table, the browser renders a control from it. Alias rather than a second interface: two
 * declarations of one shape is how a client and a server come to disagree about a field.
 */
export type FieldSpec = AdminField;

/** Columns no form may write, whatever table it is. */
const SYSTEM_COLUMNS = new Set(['id', 'createdAt', 'updatedAt']);

interface ColumnMeta {
  columnType: string;
  dataType: string;
  notNull: boolean;
  hasDefault: boolean;
  length?: number;
  enumValues?: string[];
}

export interface DescribeOptions {
  /** JSON columns holding translated text. Everything else JSON is passed through as-is. */
  localized?: readonly string[];
  /** Minor-unit integers, so the form can show a currency field instead of a big number. */
  money?: readonly string[];
}

export function describeTable(table: MySqlTable, options: DescribeOptions = {}): FieldSpec[] {
  const localized = new Set(options.localized ?? []);
  const money = new Set(options.money ?? []);

  return Object.entries(getTableColumns(table)).map(([name, column]) => {
    const meta = column as unknown as ColumnMeta;
    const readOnly = SYSTEM_COLUMNS.has(name);

    return {
      name,
      kind: kindOf(name, meta, localized, money),
      required: meta.notNull && !meta.hasDefault && !readOnly,
      nullable: !meta.notNull,
      readOnly,
      maxLength: meta.length ?? null,
      enumValues: meta.enumValues ?? null,
    };
  });
}

function kindOf(
  name: string,
  meta: ColumnMeta,
  localized: Set<string>,
  money: Set<string>,
): FieldKind {
  if (meta.enumValues !== undefined && meta.enumValues.length > 0) return 'enum';
  if (meta.dataType === 'json') return localized.has(name) ? 'localized' : 'json';
  if (meta.dataType === 'boolean') return 'boolean';
  if (meta.dataType === 'date') return 'timestamp';
  // `datetime({ mode: 'string' })` — the departure columns, which are UTC wall clock and are
  // never touched by a browser's time zone. Decision D-73.
  if (meta.columnType === 'MySqlDateTimeString') return 'datetime';
  if (meta.dataType === 'number') return money.has(name) ? 'money' : 'int';
  return meta.columnType === 'MySqlText' ? 'text' : 'string';
}

/**
 * The row as it goes out.
 *
 * Every route still declares a response schema and the schema is still the serialiser — the
 * rule of D-12 — but here it is generated from the table rather than written twice. A column
 * that does not exist cannot be returned, which is the property that matters.
 *
 * Admin responses do carry `umrah_trips.price_minor`, and that is correct: the ban is on the
 * public wire, and the price has to be editable somewhere.
 */
export function rowSchemaOf(fields: FieldSpec[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  for (const field of fields) {
    let schema: z.ZodTypeAny;
    switch (field.kind) {
      case 'int':
      case 'money':
        schema = z.number();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'localized':
        schema = z.record(z.string(), z.string());
        break;
      case 'json':
        schema = z.unknown();
        break;
      case 'string':
      case 'text':
      case 'enum':
      case 'timestamp':
      case 'datetime':
        // Dates included: both kinds leave as ISO strings, converted by `toWire`.
        schema = z.string();
        break;
    }

    shape[field.name] = field.nullable ? schema.nullable() : schema;
  }

  return z.object(shape);
}

/**
 * The row as it comes in.
 *
 * `.strict()`, so a field the table does not have is a 400 and not a silently ignored key —
 * which is how a form quietly stops saving something after a rename.
 */
export function writeSchemaOf(fields: FieldSpec[], site: Site | null): z.ZodTypeAny {
  const shape: z.ZodRawShape = {};

  for (const field of fields) {
    if (field.readOnly) continue;

    let schema: z.ZodTypeAny;
    switch (field.kind) {
      case 'int':
      case 'money':
        schema = z.number().int();
        break;
      case 'boolean':
        schema = z.boolean();
        break;
      case 'enum':
        schema = z.enum(field.enumValues as [string, ...string[]]);
        break;
      case 'localized':
        schema = localizedSchema(site);
        break;
      case 'json':
        schema = z.unknown();
        break;
      case 'timestamp':
      case 'datetime':
        schema = z.string().datetime({ offset: true });
        break;
      case 'string':
      case 'text':
        schema = field.maxLength === null ? z.string() : z.string().max(field.maxLength);
    }

    if (field.nullable) schema = schema.nullable();
    shape[field.name] = field.required ? schema : schema.optional();
  }

  return z.object(shape).strict();
}

/**
 * Translated text, keyed by the languages the site actually offers.
 *
 * Not by all four: Umrah is never Turkish, and a Turkish key reaching an Umrah row would be
 * rejected by `JSON_SCHEMA_VALID` in the database — correctly, but as a 500 nobody can act on.
 * Refused here it is a 400 naming the key.
 */
function localizedSchema(site: Site | null): z.ZodTypeAny {
  const langs: readonly string[] = site === null ? ['ru', 'en', 'tr', 'tm'] : SITE_LANGS[site];
  return z.record(z.enum(langs as [string, ...string[]]), z.string());
}

/** The language a search box matches against, when the column being searched is translated. */
export function searchLang(site: Site | null): string {
  return site === null ? 'ru' : DEFAULT_LANG[site];
}

// ------------------------------------------------------------------------------------------
// Conversion
// ------------------------------------------------------------------------------------------

/** `2026-09-18 06:00:00` as MySQL stores it, from an ISO instant. */
export function toMysqlDateTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

/** A row from the database, in the shape the wire schema describes. */
export function toWire(row: Record<string, unknown>, fields: FieldSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const field of fields) {
    const value = row[field.name];

    if (value === null || value === undefined) {
      out[field.name] = null;
      continue;
    }

    if (field.kind === 'timestamp' && value instanceof Date) {
      out[field.name] = value.toISOString();
    } else if (field.kind === 'datetime' && typeof value === 'string') {
      // Stored as UTC wall clock with no zone; say so rather than let a browser guess.
      out[field.name] = `${value.replace(' ', 'T')}Z`;
    } else {
      out[field.name] = value;
    }
  }

  return out;
}

/** A validated body, in the shape Drizzle expects to insert. */
export function fromWire(
  input: Record<string, unknown>,
  fields: FieldSpec[],
): Record<string, unknown> {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    const field = byName.get(key);
    if (field === undefined || field.readOnly) continue;

    if (value === null) {
      out[key] = null;
    } else if (field.kind === 'timestamp' && typeof value === 'string') {
      out[key] = new Date(value);
    } else if (field.kind === 'datetime' && typeof value === 'string') {
      out[key] = toMysqlDateTime(value);
    } else {
      out[key] = value;
    }
  }

  return out;
}
