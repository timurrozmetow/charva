import { Badge, Button, buttonClass, EmptyState, Input, QueryState } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { mediaByIdsQuery, reorderRows, type Row, rowsQuery } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { copy, labelFor, RESOURCE_LABELS } from '../i18n/copy';
import { PageHead } from '../layout/Shell';
import { presentRow, publicUrl } from '../lib/present';

import { MediaThumb } from './MediaPage';
import { useResource } from './useResource';

/**
 * One list, for every table.
 *
 * What a row shows is decided by its own columns — see `lib/present.ts`. There is no per-entity
 * column configuration because there is no per-entity code: the screen reads `/admin/resources`
 * and lays out what is there.
 *
 * It used to print the primary key and one title, which for `tour_days` reads «День: 3» beside
 * twenty other rows reading «День: 3» — true, and useless. A row now shows its photograph, its
 * name, two or three facts from its own columns, and whether it is live. The id is still there,
 * quietly, because sometimes it is the thing somebody needs.
 *
 * Ordering is arrows rather than dragging. Drag-and-drop needs a pointer, and this is a list
 * somebody may well be reordering on a laptop trackpad in a hurry; arrows work from the
 * keyboard, need no library, and say what they do.
 */
export function ResourceListPage({ resource: name }: { resource: string }) {
  const resource = useResource(name);
  const search: { q?: string; page?: number; site?: string } = useSearch({ strict: false });
  const navigate = useNavigate();
  const { can } = useSession();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState(search.q ?? '');
  const page = search.page ?? 1;

  /*
   * `?site=umrah` narrows a shared table to one department's rows.
   *
   * Passed through only when the resource declares `site` as a filter, so an unrelated table
   * cannot be sent a parameter the API would reject. `content_blocks` is the reason this
   * exists: one table holding the Umrah package composition beside Global's visa steps.
   */
  const siteFilter = resource?.filters.includes('site') === true ? search.site : undefined;

  const rows = useQuery(
    rowsQuery(name, {
      page,
      perPage: 25,
      ...(search.q === undefined ? {} : { q: search.q }),
      ...(siteFilter === undefined ? {} : { site: siteFilter }),
    }),
  );

  const items = rows.data?.items ?? [];
  const cards = resource === null ? [] : items.map((row) => presentRow(row, resource));

  // One extra request for this page's covers, so a list of tours shows tours rather than
  // twenty-five identical grey rectangles.
  const covers = useQuery(
    mediaByIdsQuery(cards.map((card) => card.mediaId).filter((id): id is number => id !== null)),
  );
  const byId = new Map((covers.data?.items ?? []).map((item) => [item.id, item]));

  const reorder = useMutation({
    mutationFn: (updates: { id: number; sortOrder: number }[]) => reorderRows(name, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rows', name] }),
  });

  if (resource === null) {
    return <EmptyState title={copy.errors.notFound} description={name} />;
  }

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
              // The department's narrowing survives a search: dropping it would quietly show
              // the other site's rows to somebody who only ever asked for theirs.
              search: {
                ...(siteFilter === undefined ? {} : { site: siteFilter }),
                ...(term.trim() === '' ? {} : { q: term.trim() }),
              },
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
        skeletonClassName="h-[86px] rounded-panel-sm"
        gridClassName="flex flex-col gap-2"
      >
        {items.length === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.list.emptyHint} />
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {items.map((row, index) => {
              const card = cards[index];
              if (card === undefined) return null;
              const cover = card.mediaId === null ? undefined : byId.get(card.mediaId);
              const href = publicUrl(name, row);

              return (
                <li
                  key={String(row['id'])}
                  className="flex items-center gap-4 rounded-panel-sm border border-line bg-surface p-3 transition-colors duration-colour hover:border-line-strong"
                >
                  {/* The picture only where the table has one. A column of empty grey boxes
                      beside `pricing_rules` would be furniture, not information. */}
                  {card.mediaId !== null && (
                    <span className="block w-[92px] shrink-0 overflow-hidden rounded-panel-sm bg-field">
                      {cover === undefined ? (
                        <span className="flex aspect-[4/3] items-center justify-center text-label uppercase tracking-[0.14em] text-muted">
                          —
                        </span>
                      ) : (
                        <MediaThumb media={cover} className="aspect-[4/3] w-full object-cover" />
                      )}
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <Link
                      to="/data/$resource/$id"
                      params={{ resource: name, id: String(row['id']) }}
                      className="block truncate text-body font-medium text-ink no-underline hover:text-accent-text"
                    >
                      {card.title}
                    </Link>

                    {card.facts.length > 0 && (
                      <span className="mt-1 block truncate text-bodySm text-muted">
                        {card.facts.join(' · ')}
                      </span>
                    )}

                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      {card.badges.map((badge) => (
                        <Badge
                          key={badge.label}
                          variant={badge.tone === 'draft' ? 'scrim' : 'tint'}
                        >
                          {badge.label}
                        </Badge>
                      ))}
                      <span className="text-label uppercase tracking-[0.14em] text-muted">
                        {copy.list.id} {String(row['id'])}
                      </span>
                      {href !== null && (
                        // «Не видно результата»: the row as a visitor meets it, one click away.
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-label uppercase tracking-[0.14em] text-accent-text underline underline-offset-4"
                        >
                          {copy.list.viewOnSite} ↗
                        </a>
                      )}
                    </span>
                  </span>

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
              );
            })}
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

export type { Row };
