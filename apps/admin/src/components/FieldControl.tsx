import { type AdminField, type Lang, LANG_NAMES, type Site, SITE_LANGS } from '@charva/contracts';
import { Checkbox, cn, Field, Input, Select, Textarea } from '@charva/ui';
import { useState } from 'react';

import { copy, FIELD_LABELS, labelFor } from '../i18n/copy';
import { FOREIGN_KEYS, isMediaField } from '../lib/present';

import { MediaPickerField } from './MediaPicker';
import { RowSelectField } from './RowSelect';

/**
 * One column, rendered as whatever control it deserves.
 *
 * This is the piece that makes twenty entities cost one form. The API describes each column —
 * kind, whether it is required, how long it may be, what an enum permits — and the form is
 * built from that description rather than from twenty hand-written layouts that drift from the
 * schema the moment a migration lands.
 *
 * The one thing worth arguing about is translated text, and it is the reason the language tabs
 * exist: a row is one record in three languages, not three records. One `PATCH` saves all of
 * them (decision D-5), so the tabs are a view of one value rather than three forms.
 */

export interface FieldControlProps {
  field: AdminField;
  site: Site | null;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string | undefined;
}

export function FieldControl({ field, site, value, onChange, error }: FieldControlProps) {
  const label = labelFor(FIELD_LABELS, field.name);

  /*
   * Two columns are integers in the database and are not numbers to a person.
   *
   * A `*MediaId` is a photograph and a `*Id` naming another table is a row with a name. Both
   * used to render as a number box, which meant looking the value up somewhere else and typing
   * it in — the single clearest case of this admin showing the schema rather than the work.
   */
  if (isMediaField(field)) {
    return (
      <MediaPickerField
        label={label}
        required={field.required}
        value={typeof value === 'number' ? value : null}
        onChange={onChange}
        {...(error === undefined ? {} : { error })}
      />
    );
  }

  const foreign = FOREIGN_KEYS[field.name];
  if (foreign !== undefined) {
    return (
      <RowSelectField
        label={label}
        resource={foreign}
        required={field.required}
        value={typeof value === 'number' ? value : null}
        onChange={onChange}
        {...(error === undefined ? {} : { error })}
      />
    );
  }

  if (field.readOnly) {
    return (
      <Field label={label} hint={copy.form.readOnly}>
        <p className="rounded-panel-sm border border-line bg-field px-4 py-3 text-bodySm text-muted">
          {show(value)}
        </p>
      </Field>
    );
  }

  const common = {
    label,
    required: field.required,
    ...(error === undefined ? {} : { error }),
  };

  switch (field.kind) {
    case 'localized':
      return (
        <LocalizedField
          {...common}
          site={site}
          value={asRecord(value)}
          onChange={onChange}
          long={field.name === 'body' || field.name === 'description' || field.name === 'answer'}
        />
      );

    case 'boolean':
      // The checkbox carries its own label, so `Field` would produce a second one pointing at
      // the same control — which a screen reader reads out twice.
      return (
        <Checkbox
          checked={value === true}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          {...(error === undefined ? {} : { error })}
        >
          {label}
        </Checkbox>
      );

    case 'enum':
      return (
        <Field {...common}>
          <Select
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => {
              onChange(event.target.value === '' ? null : event.target.value);
            }}
          >
            {!field.required && <option value="">—</option>}
            {(field.enumValues ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      );

    case 'int':
    case 'money':
      return (
        <Field {...common} {...(field.kind === 'money' ? { hint: copy.form.minor } : {})}>
          <Input
            type="number"
            step={1}
            value={typeof value === 'number' ? String(value) : ''}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(raw === '' ? null : Number(raw));
            }}
          />
        </Field>
      );

    case 'timestamp':
    case 'datetime':
      return (
        <Field {...common} hint="UTC">
          <Input
            type="datetime-local"
            value={toLocalInput(value)}
            onChange={(event) => {
              onChange(fromLocalInput(event.target.value));
            }}
          />
        </Field>
      );

    case 'json':
      return <JsonField {...common} value={value} onChange={onChange} />;

    case 'text':
      return (
        <Field {...common}>
          <Textarea
            rows={6}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        </Field>
      );

    case 'string':
      return (
        <Field {...common}>
          <Input
            type="text"
            {...(field.maxLength === null ? {} : { maxLength: field.maxLength })}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => {
              onChange(event.target.value === '' && field.nullable ? null : event.target.value);
            }}
          />
        </Field>
      );
  }
}

/** Anything, as one line of text. An object prints as JSON rather than as `[object Object]`. */
export function show(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

function asRecord(value: unknown): Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};
}

/**
 * Translated text: one value, one tab per language the site speaks.
 *
 * Which languages depends on the site, not on a global list — Umrah is never Turkish. For the
 * two shared tables the row itself carries the site, so all four are offered and the database's
 * own `JSON_SCHEMA_VALID` remains the thing that refuses a wrong one.
 */
function LocalizedField({
  label,
  required,
  error,
  site,
  value,
  onChange,
  long,
}: {
  label: string;
  required: boolean;
  error?: string;
  site: Site | null;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  long: boolean;
}) {
  const langs: readonly Lang[] =
    site === null ? (['ru', 'en', 'tr', 'tm'] as const) : SITE_LANGS[site];
  const [active, setActive] = useState<Lang>(langs[0] ?? 'ru');
  const Control = long ? Textarea : Input;

  return (
    <Field label={label} required={required} {...(error === undefined ? {} : { error })}>
      <div>
        <div role="tablist" aria-label={copy.form.languages} className="mb-2 flex gap-1">
          {langs.map((lang) => {
            const filled = (value[lang] ?? '').trim() !== '';
            return (
              <button
                key={lang}
                type="button"
                role="tab"
                aria-selected={lang === active}
                onClick={() => {
                  setActive(lang);
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-label font-bold uppercase tracking-[0.16em]',
                  lang === active
                    ? 'bg-accent text-accent-on'
                    : 'bg-tint text-accent-text hover:bg-tint-soft',
                )}
              >
                {LANG_NAMES[lang].slice(0, 3)}
                {/* A dot rather than a count: what an editor needs to see is which tab is still
                    empty, and they are looking at a row of three. */}
                {!filled && <span aria-hidden="true"> ·</span>}
              </button>
            );
          })}
        </div>

        <Control
          {...(long ? { rows: 8 } : {})}
          value={value[active] ?? ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => {
            onChange({ ...value, [active]: event.target.value });
          }}
        />
      </div>
    </Field>
  );
}

/** A bag of anything, edited as JSON, refused as text. */
function JsonField({
  label,
  required,
  error,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  error?: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(() =>
    value === null || value === undefined ? '' : JSON.stringify(value, null, 2),
  );
  const [invalid, setInvalid] = useState(false);

  return (
    <Field
      label={label}
      required={required}
      {...(invalid ? { error: copy.form.invalidJson } : error === undefined ? {} : { error })}
    >
      <Textarea
        rows={5}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);

          if (next.trim() === '') {
            setInvalid(false);
            onChange(null);
            return;
          }

          try {
            onChange(JSON.parse(next));
            setInvalid(false);
          } catch {
            // Kept in the box rather than thrown away: half-typed JSON is what typing JSON
            // looks like, and the save button is what should refuse it.
            setInvalid(true);
          }
        }}
      />
    </Field>
  );
}

/** `2026-09-18T06:00` for `datetime-local`, from an ISO instant, in UTC. */
function toLocalInput(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  return value.slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (value === '') return null;
  // The control gives wall-clock text with no zone; the API stores UTC, and every date this
  // admin edits is a departure or a publication moment that is defined in UTC (D-73).
  return `${value}:00.000Z`;
}
