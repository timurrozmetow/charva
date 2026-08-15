import { type AdminResourceMeta } from '@charva/contracts';
import { Badge, Button, buttonClass, EmptyState, Input, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { reorderRows, type Row, rowsQuery } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { show } from '../components/FieldControl';
import { copy, FIELD_LABELS, labelFor, RESOURCE_LABELS } from '../i18n/copy';
import { PageHead } from '../layout/Shell';

import { useResource } from './useResource';

/**
 * One list, for every table.
 *
 * What a row shows is decided by its own columns: a title if it has one, a slug, a status, an
 * order. There is no per-entity column configuration because there is no per-entity code — the
 * screen reads `/admin/resources` and lays out what is there.
 *
 * Ordering is arrows rather than dragging. Drag-and-drop needs a pointer, and this is a list
 * somebody may well be reordering on a laptop trackpad in a hurry; arrows work from the
 * keyboard, need no library, and say what they do.
 */
export function ResourceListPage({ resource: name }: { resource: string }) {
  const resource = useResource(name);
  const search: { q?: string; page?: number } = useSearch({ strict: false });
  const navigate = useNavigate();
  const { can } = useSession();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState(search.q ?? '');
  const page = search.page ?? 1;

  const rows = useQuery(
    rowsQuery(name, { page, perPage: 25, ...(search.q === undefined ? {} : { q: search.q }) }),
  );

  const reorder = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) => reorderRows(name, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rows', name] }),
  });

  if (resource === null) {
    return <EmptyState title={copy.errors.notFound} description={name} />;
  }

  const items = rows.data?.items ?? [];
  const canWrite = can(resource.capability);

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const current = items[index];
    const swap = items[target];
    if (current === undefined || swap === undefined) return;

    reorder.mutate([
      { id: Number(current['id']), sortOrder: Number(swap['sortOrder'] ?? target) },
      { id: Number(swap['id']), sortOrder: Number(current['sortOrder'] ?? index) },
    ]);
  }

  return (
    <>
      <PageHead
        title={labelFor(RESOURCE_LABELS, name)}
        {...(rows.data === undefined ? {} : { count: rows.data.meta.total })}
        action={
          canWrite ? (
            <Link
              to="/data/$resource/new"
              params={{ resource: name }}
              className={buttonClass({ size: 'sm' })}
            >
              {copy.list.create}
            </Link>
          ) : undefined
        }
      />

      {resource.search.length > 0 && (
        <form
          className="mb-6 flex max-w-[420px] gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({
              to: '/data/$resource',
              params: { resource: name },
              search: term.trim() === '' ? {} : { q: term.trim() },
            });
          }}
        >
          <Input
            type="search"
            value={term}
            placeholder={copy.list.search}
            aria-label={copy.list.search}
            onChange={(event) => {
              setTerm(event.target.value);
            }}
          />
          <Button type="submit" variant="outline" size="sm">
            {copy.list.search}
          </Button>
        </form>
      )}

      <QueryState
        isPending={rows.isPending}
        isError={rows.isError}
        onRetry={() => void rows.refetch()}
        labels={{
          loading: copy.list.loading,
          errorTitle: copy.list.failed,
          errorHint: copy.errors.offline,
          retry: copy.list.retry,
        }}
        skeletonCount={6}
        skeletonClassName="h-[54px] rounded-panel-sm"
        gridClassName="flex flex-col gap-2"
      >
        {items.length === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.list.emptyHint} />
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {items.map((row, index) => (
              <li
                key={String(row['id'])}
                className="flex items-center gap-4 rounded-panel-sm border border-line bg-surface px-4 py-3"
              >
                <span className="w-12 shrink-0 text-label uppercase tracking-[0.16em] text-muted">
                  {String(row['id'])}
                </span>

                <Link
                  to="/data/$resource/$id"
                  params={{ resource: name, id: String(row['id']) }}
                  className="min-w-0 flex-1 truncate text-bodySm font-medium text-ink hover:text-accent-text"
                >
                  {titleOf(row, resource)}
                </Link>

                {row['isPublished'] === false && <Badge variant="scrim">Черновик</Badge>}
                {typeof row['status'] === 'string' && (
                  <Badge variant="tint">{copy.statuses[row['status']] ?? row['status']}</Badge>
                )}

                {resource.orderable && canWrite && (
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={copy.list.up}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => {
                        move(index, -1);
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={copy.list.down}
                      disabled={index === items.length - 1 || reorder.isPending}
                      onClick={() => {
                        move(index, 1);
                      }}
                    >
                      ↓
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {rows.data !== undefined && rows.data.meta.totalPages > 1 && (
        <nav className="mt-6 flex items-center gap-3" aria-label={copy.list.page}>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() =>
              void navigate({
                to: '/data/$resource',
                params: { resource: name },
                search: (previous: Record<string, unknown>) => ({ ...previous, page: page - 1 }),
              })
            }
          >
            {copy.list.prev}
          </Button>
          <span className="text-bodySm text-muted">
            {page} {copy.list.of} {rows.data.meta.totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.data.meta.hasMore}
            onClick={() =>
              void navigate({
                to: '/data/$resource',
                params: { resource: name },
                search: (previous: Record<string, unknown>) => ({ ...previous, page: page + 1 }),
              })
            }
          >
            {copy.list.next}
          </Button>
        </nav>
      )}
    </>
  );
}

/**
 * Something to click, whatever the table is.
 *
 * Tried in the order a human would: the translated title, then a name, then a slug or a code,
 * then the primary key. A row that shows only «#41» is still openable, which is the point —
 * some of these tables genuinely have no human-facing name.
 */
function titleOf(row: Row, resource: AdminResourceMeta): string {
  for (const field of resource.fields) {
    const value = row[field.name];

    if (field.kind === 'localized' && value !== null && typeof value === 'object') {
      const first = Object.values(value as Record<string, string>).find(
        (text) => typeof text === 'string' && text.trim() !== '',
      );
      if (first !== undefined) return first;
    }
  }

  for (const key of [
    'slug',
    'code',
    'keyName',
    'settingKey',
    'blockCode',
    'slotKey',
    'authorName',
  ]) {
    const value = row[key];
    if (typeof value === 'string' && value !== '') return value;
  }

  for (const key of ['departAt', 'dayNumber', 'createdAt']) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      return `${labelFor(FIELD_LABELS, key)}: ${show(value)}`;
    }
  }

  return `#${String(row['id'])}`;
}
