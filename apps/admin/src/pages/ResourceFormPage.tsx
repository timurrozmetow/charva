import { type AdminField, ApiRequestError } from '@charva/contracts';
import { Button, EmptyState, FormError, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { createRow, deleteRow, type Row, rowQuery, updateRow } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { FieldControl } from '../components/FieldControl';
import { GalleryEditor } from '../components/GalleryEditor';
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
  const [failure, setFailure] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /*
   * What the server is believed to hold, and what has changed since.
   *
   * Refs rather than state because auto-save reads them from inside an event handler that must
   * see the current value, not the one captured when the handler was created. `saved` starts as
   * the loaded row and is updated with each accepted patch — comparing against `existing.data`
   * instead would mean that editing a field, saving it, and then typing the original value back
   * looks like «no change» and never reaches the server.
   */
  const saved = useRef<Row>({});
  const pending = useRef(new Set<string>());
  const draftRef = useRef<Row>({});

  useEffect(() => {
    if (existing.data !== undefined) {
      setDraft(existing.data);
      draftRef.current = existing.data;
      saved.current = existing.data;
      pending.current.clear();
    }
  }, [existing.data]);

  /*
   * A tab closed mid-edit.
   *
   * Auto-save fires when a field is left, so the one moment work can still be lost is the one
   * where somebody types into the last field and closes the window without leaving it. The
   * browser shows its own wording; all this does is ask for the prompt.
   */
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (pending.current.size > 0) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, []);

  const save = useMutation({
    mutationFn: (body: Row) => (id === null ? createRow(name, body) : updateRow(name, id, body)),
    onSuccess: async (row, body) => {
      setFailure(null);
      setFieldErrors({});
      // Accepted, so this is what the server holds now. The row query itself is deliberately
      // not invalidated: refetching would overwrite the field somebody is typing into.
      saved.current = { ...saved.current, ...body };
      await queryClient.invalidateQueries({ queryKey: ['rows', name] });

      if (id === null) {
        await navigate({
          to: '/data/$resource/$id',
          params: { resource: name, id: String(row['id']) },
        });
      }
    },
    onError: (error, body) => {
      // Left pending, so leaving another field — or pressing «Повторить» — tries again rather
      // than quietly dropping the edit.
      for (const key of Object.keys(body)) pending.current.add(key);
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFailure(error.code === 'conflict' ? copy.form.conflict : error.message);
      } else {
        setFailure(copy.form.failed);
      }
    },
  });

  /**
   * Writes whatever has changed since the last accepted patch.
   *
   * Called when a control says its edit is finished — immediately for a checkbox or a chosen
   * file, on blur for anything typed a character at a time. Never on a keystroke: that would
   * send half-typed slugs to be rejected and would put a row in the audit log for every pause
   * in somebody's typing, which is the opposite of what an audit log is for.
   *
   * Only on an existing row. A new one has nothing to patch, and creating a row the moment
   * somebody types the first letter of a title would leave the table full of empty drafts.
   */
  function flush(): void {
    if (id === null || pending.current.size === 0 || save.isPending) return;

    const body: Row = {};
    for (const key of pending.current) {
      const value = draftRef.current[key];
      if (value === undefined) continue;
      if (JSON.stringify(saved.current[key] ?? null) === JSON.stringify(value)) continue;
      body[key] = value;
    }

    pending.current.clear();
    if (Object.keys(body).length === 0) return;

    save.mutate(body);
  }

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
        resource={name}
        site={resource?.site ?? null}
        value={draft[field.name] ?? null}
        error={fieldErrors[field.name]}
        onChange={(value) => {
          pending.current.add(field.name);
          /*
           * The ref is written first, and it is what `flush` reads.
           *
           * A discrete control changes and commits in one movement, so `flush` runs before
           * React has re-rendered — reading `draft` there would see the value from *before* the
           * click, decide nothing had changed, and silently save nothing. Every checkbox and
           * every chosen photograph would have done that.
           */
          draftRef.current = { ...draftRef.current, [field.name]: value };
          setDraft(draftRef.current);
        }}
        // Only an existing row saves itself; a new one is created by the button below.
        {...(id === null ? {} : { onCommit: flush })}
      />
    );
  }

  /** Creating the row. An existing one never reaches here — it has already saved itself. */
  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (id !== null) {
      flush();
      return;
    }

    // Only what the form actually holds. Sending every column back would make a one-word edit
    // look, in the audit log, like a rewrite of the whole row.
    const body: Row = {};
    for (const field of writable) {
      const value = draft[field.name];
      if (value !== undefined) body[field.name] = value;
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
            {/*
              «Ко всем записям», not «Отмена».

              It never cancelled anything — it navigated — and now that the row saves itself the
              old label was an outright promise to undo work that is already written. A link
              that lies about what it does is worse than no link.
            */}
            <Link
              to="/data/$resource"
              params={{ resource: name }}
              className="text-bodySm text-muted underline underline-offset-4"
            >
              ← {copy.form.backToList}
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
          {/*
            The text column stops at 760px however wide the window is.

            A title input stretched across a 3400px monitor is one line of text in a field eight
            times longer than anything anybody types into it, and the eye has to travel the
            whole way to check it. The rail keeps its place beside it; only the measure is
            capped.
          */}
          <div className="grid max-w-[1120px] grid-cols-[minmax(0,760px)_320px] items-start gap-7 lap:max-w-none lap:grid-cols-1">
            <div className="flex flex-col gap-6">
              <Section title={copy.form.sections.main} fields={groups.main} render={control} />
              <Section title={copy.form.sections.facts} fields={groups.facts} render={control} />
            </div>

            {/* The rail: what this belongs to, what it looks like, whether anyone can see it.
                Short answers, scanned rather than written, and out of the way of the text. */}
            <div className="flex flex-col gap-6">
              <Section title={copy.form.sections.links} fields={groups.links} render={control} />
              <Section title={copy.form.sections.media} fields={groups.media} render={control} />

              {/*
                The photographs, where the thing they are of is.
                Only on a saved row: there is no parent to hang them off until it has an id.
              */}
              {id !== null && (name === 'tours' || name === 'hotels') && (
                <GalleryEditor parent={name} parentId={id} />
              )}
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
            {/*
              No save button on an existing row.

              It saves itself when a field is finished, so the button would have exactly one
              job: to be pressed by somebody who does not know that. This line is the whole
              feedback, and it says which of the three states the row is in.
            */}
            {id === null ? (
              <Button
                type="submit"
                busy={save.isPending}
                busyLabel={copy.form.saving}
                disabled={!canWrite}
              >
                {copy.form.create}
              </Button>
            ) : (
              <span className="flex items-center gap-3 text-bodySm">
                {save.isPending && <span className="text-muted">{copy.form.autoSaving}</span>}
                {!save.isPending && failure !== null && (
                  <>
                    <span className="font-medium text-danger">{copy.form.autoFailed}</span>
                    <Button size="sm" variant="outline" onClick={flush}>
                      {copy.form.autoRetry}
                    </Button>
                  </>
                )}
                {!save.isPending && failure === null && save.isSuccess && (
                  <span className="text-accent-text">{copy.form.autoSaved}</span>
                )}
                {!save.isPending && failure === null && !save.isSuccess && (
                  <span className="text-muted">{copy.form.autoHint}</span>
                )}
              </span>
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
