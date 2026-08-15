import { buttonClass } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { leadsQuery, mediaQuery, signupsQuery, slotsQuery } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { copy } from '../i18n/copy';
import { PageHead } from '../layout/Shell';

/**
 * What is waiting, counted rather than estimated.
 *
 * Four numbers, each of which is a thing somebody has to do: answer an enquiry, answer a
 * signup, take a photograph, replace a stand-in before deployment (decision D-25). Nothing here
 * is a metric for its own sake — the marketing figures the prototype prints were replaced by
 * aggregates in phase 3 precisely because a number nobody acts on is noise.
 */
export function OverviewPage() {
  const { user, can } = useSession();
  const inbox = can('leads.read');

  const leads = useQuery({ ...leadsQuery({ perPage: 1, status: 'new' }), enabled: inbox });
  const signups = useQuery({ ...signupsQuery({ perPage: 1, status: 'new' }), enabled: inbox });
  const slots = useQuery(slotsQuery({ perPage: 1 }));
  const placeholders = useQuery(mediaQuery({ perPage: 1, placeholders: 'true' }));

  return (
    <>
      <PageHead title={`${copy.overview.title} — ${user?.name ?? ''}`} lead={copy.overview.lead} />

      <div className="grid grid-cols-4 gap-5 lap:grid-cols-2 mob:grid-cols-1">
        {inbox && (
          <Stat
            title={copy.overview.newLeads}
            value={leads.data?.meta.total}
            href="/inbox/leads"
            action={copy.overview.openInbox}
          />
        )}
        {inbox && (
          <Stat
            title={copy.overview.newSignups}
            value={signups.data?.meta.total}
            href="/inbox/signups"
            action={copy.overview.openInbox}
          />
        )}
        <Stat
          title={copy.overview.slotsFilled}
          value={slots.data?.progress.filled}
          total={slots.data?.progress.total}
          href="/slots"
          action={copy.overview.openSlots}
        />
        <Stat
          title={copy.overview.placeholders}
          value={placeholders.data?.meta.total}
          hint={copy.overview.slotsHint}
          href="/media"
          action={copy.nav.library}
        />
      </div>
    </>
  );
}

function Stat({
  title,
  value,
  total,
  hint,
  href,
  action,
}: {
  title: string;
  value: number | undefined;
  total?: number | undefined;
  hint?: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface p-6">
      <p className="text-label font-bold uppercase tracking-[0.2em] text-muted">{title}</p>
      <p className="mt-3 text-h2Sm font-medium text-ink">
        {value ?? '—'}
        {total !== undefined && <span className="text-body text-muted"> / {total}</span>}
      </p>
      {hint !== undefined && <p className="mt-2 text-label text-muted">{hint}</p>}
      <Link
        to={href}
        className={buttonClass({ variant: 'ghost', size: 'sm', className: 'mt-auto self-start' })}
      >
        {action}
      </Link>
    </div>
  );
}
