import { type AdminResourceMeta, type Site } from '@charva/contracts';
import { Badge, buttonClass, cn } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Fragment } from 'react';

import { resourcesQuery } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { copy, labelFor, RESOURCE_LABELS } from '../i18n/copy';
import { PARENT_OF } from '../lib/present';

/**
 * The frame every screen sits in.
 *
 * The navigation is built from `/admin/resources` rather than written out, so a table added to
 * the registry appears in the sidebar without anybody editing this file — the same property the
 * list and form screens have, and the reason twenty entities cost one screen each rather than
 * three.
 *
 * **One department at a time.** Everything for the pilgrimage — its trips, its programme, its
 * places, its groups, its photographs, its signups — is under «Умра», and everything for the
 * tour operator is under «Global». Before, all twenty-one tables were on screen at once in four
 * flat groups, and somebody who only ever touches the pilgrimage had to read past the hotel
 * catalogue every time. Grouping is not the same as separating: the sidebar was already grouped
 * by site and it still asked the reader to do the filtering.
 *
 * The department is read from the route and from nothing else, and the switcher navigates. Any
 * other arrangement has two sources for one fact: the first version remembered a choice and
 * used it only when the URL was silent — which it is on exactly one screen — so the switcher
 * did nothing anywhere else, and «не нажимается» was the correct description of it.
 */

type Department = Site | 'shared';

/** Short labels: three of «Charva Travel» would not fit across a 260px column. */
const DEPARTMENTS: readonly { key: Department; label: string }[] = [
  { key: 'global', label: copy.nav.globalShort },
  { key: 'umrah', label: copy.nav.umrahShort },
  { key: 'shared', label: copy.nav.sharedShort },
];

/** The three tables that price a tour. Their own section: they are a machine, not a catalogue. */
const BUILDER = new Set(['builder_steps', 'builder_options', 'pricing_rules']);

/**
 * A table both departments edit, each seeing only its own rows.
 *
 * `content_blocks` is one table for seven small ordered lists (decision D-17) — Umrah's package
 * composition sits in it beside Global's visa steps — so it appears in both departments,
 * narrowed by `?site=`, and in neither department's resource list.
 */
const SHARED_BY_SITE = new Set(['content_blocks']);

interface Group {
  title: string;
  children: React.ReactNode;
}

export function Shell() {
  const { user, signOut, can } = useSession();
  const resources = useQuery(resourcesQuery());
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const searchSite = useRouterState({
    select: (state) => (state.location.search as { site?: string }).site,
  });

  const all = resources.data?.resources ?? [];
  const department = departmentOf(pathname, searchSite, all);

  const of = (site: Site | null, predicate: (name: string) => boolean = () => true) =>
    all.filter(
      (resource) =>
        resource.site === site && !SHARED_BY_SITE.has(resource.name) && predicate(resource.name),
    );

  const groups: Group[] = [];

  if (department === 'global' || department === 'umrah') {
    const site = department;

    if (can('leads.read')) {
      groups.push({
        title: copy.nav.inbox,
        children:
          site === 'global' ? (
            <NavLink to="/inbox/leads" label={copy.nav.leads} pathname={pathname} />
          ) : (
            <NavLink to="/inbox/signups" label={copy.nav.signups} pathname={pathname} />
          ),
      });
    }

    groups.push({
      title: copy.nav.content,
      children: <ResourceLinks resources={of(site, (name) => !BUILDER.has(name))} />,
    });

    if (site === 'global') {
      groups.push({
        title: copy.nav.builder,
        children: <ResourceLinks resources={of(site, (name) => BUILDER.has(name))} />,
      });
    }

    groups.push({
      title: copy.nav.pages,
      children: (
        <>
          <NavLink
            to="/data/$resource"
            params={{ resource: 'content_blocks' }}
            search={{ site }}
            label={labelFor(RESOURCE_LABELS, 'content_blocks')}
            pathname={pathname}
            activeSite={searchSite}
            expectSite={site}
          />
          <NavLink
            to="/slots"
            search={{ site }}
            label={copy.nav.slots}
            pathname={pathname}
            activeSite={searchSite}
            expectSite={site}
          />
        </>
      ),
    });
  } else {
    groups.push({
      title: copy.nav.media,
      children: (
        <>
          <NavLink to="/media" label={copy.nav.library} pathname={pathname} />
          <NavLink to="/slots" label={copy.nav.allSlots} pathname={pathname} expectSite={null} />
        </>
      ),
    });

    groups.push({
      title: copy.nav.shared,
      children: <ResourceLinks resources={of(null)} />,
    });
  }

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-bg tab:grid-cols-1">
      {/* `text-ink` rather than `text-dark-on`: inside a dark surface `--c-ink` *is* the cream,
          and nothing here writes a colour of its own for it to collide with (D-97). */}
      <aside
        data-surface="dark"
        className="flex flex-col gap-7 bg-dark px-6 py-8 text-ink tab:px-4 tab:py-5"
      >
        <div>
          <Link to="/" className="text-h3 font-medium leading-none">
            {copy.brand}
          </Link>
          <p className="mt-2 text-label uppercase tracking-[0.28em] text-muted">{copy.subtitle}</p>
        </div>

        <nav aria-label={copy.subtitle} className="flex flex-1 flex-col gap-6 overflow-y-auto">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <NavLink to="/" label={copy.nav.overview} pathname={pathname} exact />
          </ul>

          <DepartmentSwitcher current={department} homeOf={(next) => homeOf(next, all, can)} />

          {groups.map((group) => (
            <NavSection key={group.title} title={group.title}>
              {group.children}
            </NavSection>
          ))}
        </nav>

        <div className="border-t border-line pt-5">
          <p className="text-bodySm font-medium">{user?.name}</p>
          <p className="mt-1 text-label uppercase tracking-[0.2em] text-muted">{user?.role}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 text-bodySm text-accent-text underline underline-offset-4"
          >
            {copy.nav.signOut}
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-10 py-9 tab:px-5 tab:py-6">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Which department the open screen belongs to.
 *
 * Read from the URL and nothing else. It used to fall back to a remembered choice when the URL
 * said nothing, which meant the URL won whenever it *did* say something — and it says something
 * on every screen but the overview, so the switcher was inert almost everywhere. One source
 * decides, the address bar, and choosing a department is a navigation like any other.
 */
function departmentOf(
  pathname: string,
  site: string | undefined,
  resources: readonly AdminResourceMeta[],
): Department {
  if (site === 'global' || site === 'umrah') return site;
  if (pathname.startsWith('/inbox/signups')) return 'umrah';
  if (pathname.startsWith('/media')) return 'shared';

  const name = /^\/data\/([^/?]+)/.exec(pathname)?.[1];
  if (name !== undefined && !SHARED_BY_SITE.has(name)) {
    const found = resources.find((resource) => resource.name === name);
    if (found !== undefined) return found.site ?? 'shared';
  }

  // The overview and the un-narrowed shared table belong to nobody; Global is the larger site
  // and the more likely reason somebody opened the panel.
  return 'global';
}

/**
 * Where a department opens.
 *
 * Its inbox, when the account may read one — that is what somebody signing in to work on a site
 * usually wants — and otherwise its first table. Never a dead link: an account with no
 * capability for either lands on the overview rather than on a screen that would refuse it.
 */
function homeOf(
  department: Department,
  resources: readonly AdminResourceMeta[],
  can: (capability: 'leads.read') => boolean,
): DepartmentLink {
  if (department === 'shared') return { to: '/media' };

  if (can('leads.read')) {
    return { to: department === 'global' ? '/inbox/leads' : '/inbox/signups' };
  }

  const first = resources.find(
    (resource) => resource.site === department && !SHARED_BY_SITE.has(resource.name),
  );

  return first === undefined
    ? { to: '/' }
    : { to: '/data/$resource', params: { resource: first.name } };
}

interface DepartmentLink {
  to: string;
  params?: Record<string, string>;
}

function DepartmentSwitcher({
  current,
  homeOf: targetOf,
}: {
  current: Department;
  homeOf: (department: Department) => DepartmentLink;
}) {
  return (
    <div>
      <p className="text-label font-bold uppercase tracking-[0.24em] text-muted">
        {copy.nav.department}
      </p>
      {/*
        Links, not buttons.

        As buttons they only changed what the menu listed, which left the visitor looking at one
        department's screen under another's menu and — because the menu was really driven by the
        URL — usually did nothing visible at all. A department is a place; going there is a
        navigation, and as links these also carry `aria-current`, open in a tab, and survive
        being bookmarked.

        No letter-spacing and 11px: «GLOBAL» tracked out at 0.1em did not fit a third of a
        260px column and rendered as «GLOB…».
      */}
      <div className="mt-3 flex gap-1 rounded-full border border-line p-1">
        {DEPARTMENTS.map((item) => {
          const target = targetOf(item.key);
          return (
            <Link
              key={item.key}
              to={target.to}
              {...(target.params === undefined ? {} : { params: target.params })}
              aria-current={current === item.key ? 'true' : undefined}
              className={cn(
                'flex-1 rounded-full px-1.5 py-1.5 text-center text-[11px] font-bold uppercase',
                'no-underline transition-colors duration-colour',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                'focus-visible:outline-accent',
                current === item.key
                  ? 'bg-accent text-accent-on'
                  : 'text-muted hover:bg-cream-fill hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The tables of one section, with children under their parent.
 *
 * «Дни тура» and «Галерея тура» are parts of a tour, and listed flat beside «Отели» they read
 * as three unrelated things — «непонятно, куда идти». Indenting them says what belongs to what
 * without moving where they are edited: the relation is drawn, the screens stay put.
 */
function ResourceLinks({ resources }: { resources: readonly AdminResourceMeta[] }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const parents = resources.filter((resource) => PARENT_OF[resource.name] === undefined);
  const childrenOf = (parent: string) =>
    resources.filter((resource) => PARENT_OF[resource.name] === parent);

  // A child whose parent is not in this section would otherwise vanish from the menu entirely.
  const orphans = resources.filter((resource) => {
    const parent = PARENT_OF[resource.name];
    return parent !== undefined && !resources.some((other) => other.name === parent);
  });

  const link = (resource: AdminResourceMeta, nested: boolean) => (
    <NavLink
      key={resource.name}
      to="/data/$resource"
      params={{ resource: resource.name }}
      label={labelFor(RESOURCE_LABELS, resource.name)}
      pathname={pathname}
      nested={nested}
    />
  );

  return (
    <>
      {parents.map((resource) => (
        <Fragment key={resource.name}>
          {link(resource, false)}
          {childrenOf(resource.name).map((child) => link(child, true))}
        </Fragment>
      ))}
      {orphans.map((resource) => link(resource, false))}
    </>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-label font-bold uppercase tracking-[0.24em] text-muted">{title}</p>
      <ul className="mt-3 flex list-none flex-col gap-1 p-0">{children}</ul>
    </div>
  );
}

interface NavLinkProps {
  to: string;
  label: string;
  pathname: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  /** The `?site=` currently in the URL, when this link is one of a site-narrowed pair. */
  activeSite?: string | undefined;
  /** What `?site=` has to be for this link to count as open. `null` means «no site at all». */
  expectSite?: Site | null;
  /** A child table, drawn under its parent so the relation is visible. */
  nested?: boolean;
  exact?: boolean;
}

function NavLink({
  to,
  label,
  pathname,
  params,
  search,
  activeSite,
  expectSite,
  nested = false,
  exact = false,
}: NavLinkProps) {
  const href =
    params === undefined ? to : to.replace(/\$(\w+)/g, (_, key: string) => params[key] ?? '');

  const pathMatches = exact ? pathname === href : pathname.startsWith(href);
  /*
   * Two links can share a path and differ only by `?site=`.
   *
   * Without this, «Блоки контента» under Global and under Умра are the same `/data/…` and both
   * would light up — telling the reader they are in two places at once, which is the opposite
   * of what the departments are for.
   */
  const siteMatches = expectSite === undefined || (activeSite ?? null) === expectSite;
  const active = pathMatches && siteMatches;

  return (
    <li>
      <Link
        to={to}
        {...(params === undefined ? {} : { params })}
        {...(search === undefined ? {} : { search })}
        // The router sets `aria-current` itself for an exact match; this one has to say so for
        // a section, where the child route is what is actually open.
        aria-current={active ? 'page' : undefined}
        className={cn(
          'block rounded-panel-sm px-3 py-2 text-bodySm transition-colors duration-colour',
          nested && 'ml-3 border-l border-line pl-3 text-muted',
          active ? 'bg-tint text-accent-active' : 'text-body hover:text-accent-text',
        )}
      >
        {label}
      </Link>
    </li>
  );
}

/** A page heading with an optional action, so every screen starts the same way. */
export function PageHead({
  title,
  lead,
  action,
  count,
}: {
  title: string;
  lead?: string;
  action?: React.ReactNode;
  count?: number;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-h2Sm font-medium text-ink">
          {title}
          {count !== undefined && <Badge variant="tint">{count}</Badge>}
        </h1>
        {lead !== undefined && <p className="mt-2 max-w-[70ch] text-bodySm text-muted">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

export { buttonClass };
