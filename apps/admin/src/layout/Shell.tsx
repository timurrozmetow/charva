import { type AdminResourceMeta } from '@charva/contracts';
import { Badge, buttonClass, cn } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';

import { resourcesQuery } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { copy, labelFor, RESOURCE_LABELS } from '../i18n/copy';

/**
 * The frame every screen sits in.
 *
 * The navigation is built from `/admin/resources` rather than written out, so a table added to
 * the registry appears in the sidebar without anybody editing this file — the same property the
 * list and form screens have, and the reason twenty entities cost one screen each rather than
 * three.
 *
 * Grouped by site, because that is how the people using it think: somebody maintaining the
 * pilgrimage does not want the tour catalogue in their way.
 */

interface Group {
  title: string;
  resources: AdminResourceMeta[];
}

function groupResources(resources: AdminResourceMeta[]): Group[] {
  const builderNames = new Set(['builder_steps', 'builder_options', 'pricing_rules']);

  const global = resources.filter(
    (resource) => resource.site === 'global' && !builderNames.has(resource.name),
  );
  const umrah = resources.filter((resource) => resource.site === 'umrah');
  const builder = resources.filter((resource) => builderNames.has(resource.name));
  const shared = resources.filter((resource) => resource.site === null);

  return [
    { title: copy.nav.global, resources: global },
    { title: copy.nav.umrah, resources: umrah },
    { title: copy.nav.builder, resources: builder },
    { title: copy.nav.shared, resources: shared },
  ].filter((group) => group.resources.length > 0);
}

export function Shell() {
  const { user, signOut, can } = useSession();
  const resources = useQuery(resourcesQuery());
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const groups = groupResources(resources.data?.resources ?? []);

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-bg tab:grid-cols-1">
      <aside
        data-surface="dark"
        className="flex flex-col gap-8 bg-dark px-6 py-8 text-dark-on tab:px-4 tab:py-5"
      >
        <div>
          <Link to="/" className="text-h3 font-medium leading-none">
            {copy.brand}
          </Link>
          <p className="mt-2 text-label uppercase tracking-[0.28em] text-muted">{copy.subtitle}</p>
        </div>

        <nav aria-label={copy.subtitle} className="flex flex-1 flex-col gap-7 overflow-y-auto">
          <NavSection title={copy.nav.overview}>
            <NavLink to="/" label={copy.nav.overview} pathname={pathname} exact />
          </NavSection>

          <NavSection title={copy.nav.media}>
            <NavLink to="/media" label={copy.nav.library} pathname={pathname} />
            <NavLink to="/slots" label={copy.nav.slots} pathname={pathname} />
          </NavSection>

          {can('leads.read') && (
            <NavSection title={copy.nav.inbox}>
              <NavLink to="/inbox/leads" label={copy.nav.leads} pathname={pathname} />
              <NavLink to="/inbox/signups" label={copy.nav.signups} pathname={pathname} />
            </NavSection>
          )}

          {groups.map((group) => (
            <NavSection key={group.title} title={group.title}>
              {group.resources.map((resource) => (
                <NavLink
                  key={resource.name}
                  to="/data/$resource"
                  params={{ resource: resource.name }}
                  label={labelFor(RESOURCE_LABELS, resource.name)}
                  pathname={pathname}
                />
              ))}
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
  exact?: boolean;
}

function NavLink({ to, label, pathname, params, exact = false }: NavLinkProps) {
  const href =
    params === undefined ? to : to.replace(/\$(\w+)/g, (_, key: string) => params[key] ?? '');
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <li>
      <Link
        to={to}
        {...(params === undefined ? {} : { params })}
        // The router sets `aria-current` itself for an exact match; this one has to say so for
        // a section, where the child route is what is actually open.
        aria-current={active ? 'page' : undefined}
        className={cn(
          'block rounded-panel-sm px-3 py-2 text-bodySm transition-colors duration-colour',
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
