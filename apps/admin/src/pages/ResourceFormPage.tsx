import { type AdminField, ApiRequestError } from '@charva/contracts';
import { Button, EmptyState, FormError, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { createRow, deleteRow, type Row, rowQuery, updateRow } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { FieldControl } from '../components/FieldControl';
import { copy, labelFor, RESOURCE_LABELS } from '../i18n/copy';
import { PageHead } from '../layout/Shell';
import { groupFields, publicUrl, titleOf } from '../lib/present';

import { useResource } from './useResource';

/**
 * One form, for every table.
 *
 * Fields come from the resource description, values from the row, and validation from the
 * server — which is the only validator that cannot be out of date, because it is generated from
 * the same table. The client checks what it can see (a required field left empty) and lets the
 * database say the rest: a taken slug, a hotel with no stars, a language the site does not
 * speak. Those arrive as a 400 naming the constraint, and the message is shown as it is.
 *
 * **The columns are grouped.** They used to arrive in table order — id, slug, title, summary,
 * price, cover id, published, sort order, created at — which is the order the migration happens
 * to declare them in and no order at all to the person filling them. `lib/present.ts` sorts
 * them into what the row *says*, what is *true* about it, its photographs, what it belongs to,
 * and whether it is live; the last two sit in a rail beside the text rather than under it,
 * because they are the things somebody scans for rather than writes.
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
  const groups = groupFields(resource.fields);

  /*
   * The heading names the row, not its primary key.
   *
   * «Туры — #7» told the editor which table they were in and nothing about what was in front of
   * them. The draft is used rather than the loaded row, so renaming something updates the
   * heading as it is typed.
   */
  const heading =
    id === null
      ? copy.form.createTitle
      : Object.keys(draft).length === 0
        ? `#${String(id)}`
        : titleOf(draft, resource);

  const href = id === null ? null : publicUrl(name, draft);

  function control(field: AdminField): React.ReactNode {
    return (
      <FieldControl
        key={field.name}
        field={field}
        site={resource?.site ?? null}
        value={draft[field.name] ?? null}
        error={fieldErrors[field.name]}
        onChange={(value) => {
          setTouched(true);
          setDraft((previous) => ({ ...previous, [field.name]: value }));
        }}
      />
    );
  }

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
        title={heading}
        lead={labelFor(RESOURCE_LABELS, name)}
        action={
          <span className="flex items-center gap-4">
            {href !== null && (
              // «Не видно результата»: what was just saved, as a visitor meets it.
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-bodySm text-accent-text underline underline-offset-4"
              >
                {copy.form.viewOnSite} ↗
              </a>
            )}
            <Link
              to="/data/$resource"
              params={{ resource: name }}
              className="text-bodySm text-muted underline underline-offset-4"
            >
              {copy.form.cancel}
            </Link>
          </span>
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
        <form onSubmit={submit}>
          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-7 lap:grid-cols-1">
            <div className="flex flex-col gap-6">
              <Section title={copy.form.sections.main} fields={groups.main} render={control} />
              <Section title={copy.form.sections.facts} fields={groups.facts} render={control} />
            </div>

            {/* The rail: what this belongs to, what it looks like, whether anyone can see it.
                Short answers, scanned rather than written, and out of the way of the text. */}
            <div className="flex flex-col gap-6">
              <Section title={copy.form.sections.links} fields={groups.links} render={control} />
              <Section title={copy.form.sections.media} fields={groups.media} render={control} />
              <Section
                title={copy.form.sections.publication}
                fields={groups.publication}
                render={control}
              />
              <Section
                title={copy.form.sections.system}
                hint={copy.form.systemHint}
                fields={groups.system}
                render={control}
                collapsed
              />
            </div>
          </div>

          {failure !== null && <FormError className="mt-6">{failure}</FormError>}

          {/*
            The actions stay on screen.

            These forms run to a dozen fields and more, and the save button used to be below all
            of them — so on a long row an editor scrolled to the bottom to find out whether the
            thing they had changed was saveable at all.
          */}
          <div className="sticky bottom-0 mt-8 flex items-center gap-3 border-t border-line bg-bg py-4">
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
            {touched && <span className="text-bodySm text-muted">{copy.form.unsaved}</span>}

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

/** A titled block of controls. Renders nothing at all when the table has no such columns. */
function Section({
  title,
  hint,
  fields,
  render,
  collapsed = false,
}: {
  title: string;
  hint?: string;
  fields: AdminField[];
  render: (field: AdminField) => React.ReactNode;
  collapsed?: boolean;
}) {
  if (fields.length === 0) return null;

  const body = (
    <div className="flex flex-col gap-5">
      {hint !== undefined && <p className="m-0 text-label text-muted">{hint}</p>}
      {fields.map((field) => render(field))}
    </div>
  );

  if (collapsed) {
    return (
      <details className="rounded-panel border border-line bg-surface px-5 py-4">
        <summary className="cursor-pointer text-label font-bold uppercase tracking-[0.2em] text-muted">
          {title}
        </summary>
        <div className="mt-4">{body}</div>
      </details>
    );
  }

  return (
    <section className="rounded-panel border border-line bg-surface px-5 py-5">
      <h2 className="m-0 mb-4 text-label font-bold uppercase tracking-[0.2em] text-muted">
        {title}
      </h2>
      {body}
    </section>
  );
}

/** Unchanged since it was loaded, by value — a JSON column rewritten identically is not an edit. */
function sameAsLoaded(loaded: Row | undefined, key: string, value: unknown): boolean {
  if (loaded === undefined) return false;
  return JSON.stringify(loaded[key] ?? null) === JSON.stringify(value ?? null);
}
