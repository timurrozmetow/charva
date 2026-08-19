import { Field, Select } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';

import { rowsQuery } from '../api/queries';
import { copy, labelFor, RESOURCE_LABELS } from '../i18n/copy';
import { titleOf } from '../lib/present';
import { useResource } from '../pages/useResource';

export interface RowSelectFieldProps {
  label: string;
  /** The table this column points into — `tours` for `tourId`. */
  resource: string;
  value: number | null;
  onChange: (id: number | null) => void;
  required?: boolean;
  error?: string | undefined;
}

/**
 * A pointer to another row, chosen by its name.
 *
 * `tourId` was a number box: attaching a day to a tour meant knowing that the tour was number
 * seven, which is a fact about the database and not about the tour. The options are named by
 * the same `titleOf` the lists use, so a row reads the same wherever it appears.
 *
 * Two hundred rows without paging is deliberate: every table on the other end of one of these
 * is a catalogue an operator maintains by hand — tours, hotels, trips, groups — and none of
 * them will have a thousand rows. If one ever does, this becomes a search box, not a longer
 * list.
 */
export function RowSelectField({
  label,
  resource: name,
  value,
  onChange,
  required = false,
  error,
}: RowSelectFieldProps) {
  const resource = useResource(name);
  const rows = useQuery({ ...rowsQuery(name, { perPage: 200 }), enabled: resource !== null });

  const options =
    resource === null
      ? []
      : (rows.data?.items ?? []).map((row) => ({
          id: Number(row['id']),
          label: titleOf(row, resource),
        }));

  return (
    <Field
      label={label}
      required={required}
      hint={labelFor(RESOURCE_LABELS, name)}
      {...(error === undefined ? {} : { error })}
    >
      <Select
        value={value === null ? '' : String(value)}
        onChange={(event) => {
          onChange(event.target.value === '' ? null : Number(event.target.value));
        }}
      >
        <option value="">{required ? copy.form.notChosen : '—'}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
