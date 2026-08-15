import { ApiRequestError } from '@charva/contracts';
import { Button, EmptyState, FormError, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { createRow, deleteRow, type Row, rowQuery, updateRow } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { FieldControl } from '../components/FieldControl';
import { copy, labelFor, RESOURCE_LABELS } from '../i18n/copy';
import { PageHead } from '../layout/Shell';

import { useResource } from './useResource';

/**
 * One form, for every table.
 *
 * Fields come from the resource description, values from the row, and validation from the
 * server — which is the only validator that cannot be out of date, because it is generated from
 * the same table. The client checks what it can see (a required field left empty) and lets the
 * database say the rest: a taken slug, a hotel with no stars, a language the site does not
 * speak. Those arrive as a 400 naming the constraint, and the message is shown as it is.
 */
export function ResourceFormPage({ resource: name, id }: { resource: string; id: number | null }) {
  const resource = useResource(name);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useSession();

  const existing = useQuery({ ...rowQuery(name, id ?? 0), enabled: id !== null });
  const [draft, setDraft] = useState<Row>({});
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existing.data !== undefined) setDraft(existing.data);
  }, [existing.data]);

  const save = useMutation({
    mutationFn: (body: Row) => (id === null ? createRow(name, body) : updateRow(name, id, body)),
    onSuccess: async (row) => {
      setTouched(false);
      setFailure(null);
      setFieldErrors({});
      await queryClient.invalidateQueries({ queryKey: ['rows', name] });

      if (id === null) {
        await navigate({
          to: '/data/$resource/$id',
          params: { resource: name, id: String(row['id']) },
        });
      }
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFailure(error.code === 'conflict' ? copy.form.conflict : error.message);
      } else {
        setFailure(copy.form.failed);
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteRow(name, id ?? 0),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rows', name] });
      await navigate({ to: '/data/$resource', params: { resource: name } });
    },
  });

  if (resource === null) return <EmptyState title={copy.errors.notFound} description={name} />;

  const canWrite = can(resource.capability);
  const writable = resource.fields.filter((field) => !field.readOnly);

  function submit(event: React.FormEvent): void {
    event.preventDefault();

    // Only what the form actually holds. Sending every column back on every save would make a
    // one-word edit look, in the audit log, like a rewrite of the whole row.
    const body: Row = {};
    for (const field of writable) {
      const value = draft[field.name];
      if (value === undefined) continue;
      if (id !== null && sameAsLoaded(existing.data, field.name, value)) continue;
      body[field.name] = value;
    }

    save.mutate(body);
  }

  return (
    <>
      <PageHead
        title={`${labelFor(RESOURCE_LABELS, name)} — ${id === null ? copy.form.createTitle.toLowerCase() : `#${String(id)}`}`}
        action={
          <Link
            to="/data/$resource"
            params={{ resource: name }}
            className="text-bodySm text-accent-text underline underline-offset-4"
          >
            {copy.form.cancel}
          </Link>
        }
      />

      <QueryState
        isPending={id !== null && existing.isPending}
        isError={existing.isError}
        onRetry={() => void existing.refetch()}
        labels={{
          loading: copy.list.loading,
          errorTitle: copy.list.failed,
          errorHint: copy.errors.offline,
          retry: copy.list.retry,
        }}
        skeletonCount={5}
        skeletonClassName="h-[76px] rounded-panel-sm"
        gridClassName="flex flex-col gap-4"
      >
        <form onSubmit={submit} className="max-w-[720px]">
          <div className="flex flex-col gap-6">
            {resource.fields.map((field) => (
              <FieldControl
                key={field.name}
                field={field}
                site={resource.site}
                value={draft[field.name] ?? null}
                error={fieldErrors[field.name]}
                onChange={(value) => {
                  setTouched(true);
                  setDraft((previous) => ({ ...previous, [field.name]: value }));
                }}
              />
            ))}
          </div>

          {failure !== null && <FormError className="mt-6">{failure}</FormError>}

          <div className="mt-8 flex items-center gap-3">
            <Button
              type="submit"
              busy={save.isPending}
              busyLabel={copy.form.saving}
              disabled={!canWrite || (!touched && id !== null)}
            >
              {copy.form.save}
            </Button>

            {save.isSuccess && !touched && (
              <span className="text-bodySm text-accent-text">{copy.form.saved}</span>
            )}

            {id !== null && canWrite && (
              <Button
                variant="ghost"
                className="ml-auto"
                busy={remove.isPending}
                onClick={() => {
                  if (window.confirm(copy.form.removeConfirm)) remove.mutate();
                }}
              >
                {copy.form.remove}
              </Button>
            )}
          </div>
        </form>
      </QueryState>
    </>
  );
}

/** Unchanged since it was loaded, by value — a JSON column rewritten identically is not an edit. */
function sameAsLoaded(loaded: Row | undefined, key: string, value: unknown): boolean {
  if (loaded === undefined) return false;
  return JSON.stringify(loaded[key] ?? null) === JSON.stringify(value ?? null);
}
