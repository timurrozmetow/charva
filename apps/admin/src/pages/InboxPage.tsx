import { ApiRequestError, formatMoney } from '@charva/contracts';
import { Badge, Button, EmptyState, Field, Input, Modal, QueryState, Select } from '@charva/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { leadsQuery, patchLead, patchSignup, revealPassport, signupsQuery } from '../api/queries';
import { useSession } from '../auth/SessionProvider';
import { copy } from '../i18n/copy';
import { PageHead } from '../layout/Shell';

/**
 * What the forms produced, in the order it arrived.
 *
 * Two lists, one shape. The difference that matters is on the pilgrimage side: a signup may
 * carry a passport number, the list never shows it, and reading one is an action that states a
 * reason and gets written down (decision D-18).
 */

const LEAD_STATUSES = ['new', 'in_progress', 'won', 'lost', 'spam'];
const SIGNUP_STATUSES = ['new', 'contacted', 'confirmed', 'cancelled', 'spam'];

const labels = {
  loading: copy.list.loading,
  errorTitle: copy.list.failed,
  errorHint: copy.errors.offline,
  retry: copy.list.retry,
};

interface LeadRow {
  id: number;
  kind: string;
  name: string;
  phone: string;
  email: string | null;
  guests: number | null;
  message: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  quoteSnapshot: unknown;
}

export function LeadsPage() {
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();
  const { can } = useSession();

  const leads = useQuery(leadsQuery({ perPage: 50, ...(status === '' ? {} : { status }) }));

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      patchLead(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  return (
    <>
      <PageHead
        title={copy.inbox.leadsTitle}
        {...(leads.data === undefined ? {} : { count: leads.data.meta.total })}
      />

      <StatusFilter statuses={LEAD_STATUSES} value={status} onChange={setStatus} />

      <QueryState
        isPending={leads.isPending}
        isError={leads.isError}
        onRetry={() => void leads.refetch()}
        labels={labels}
        skeletonCount={5}
        skeletonClassName="h-[120px] rounded-panel-sm"
        gridClassName="flex flex-col gap-3"
      >
        {(leads.data?.items.length ?? 0) === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.inbox.leadsTitle} />
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {(leads.data?.items ?? []).map((lead) => (
              <li
                key={lead.id}
                className="rounded-panel-sm border border-line bg-surface px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <strong className="text-bodySm font-semibold text-ink">{lead.name}</strong>
                  <a href={`tel:${lead.phone}`} className="text-bodySm text-accent-text">
                    {lead.phone}
                  </a>
                  {lead.email !== null && (
                    <a href={`mailto:${lead.email}`} className="text-bodySm text-muted">
                      {lead.email}
                    </a>
                  )}
                  <Badge variant="tint">{lead.kind}</Badge>
                  <span className="ml-auto text-label uppercase tracking-[0.16em] text-muted">
                    {new Date(lead.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>

                {lead.message !== null && lead.message !== '' && (
                  <p className="mt-3 whitespace-pre-line text-bodySm text-body">{lead.message}</p>
                )}

                <Quote snapshot={(lead as unknown as LeadRow).quoteSnapshot} />

                <RowActions
                  statuses={LEAD_STATUSES}
                  status={lead.status}
                  notes={lead.adminNotes}
                  disabled={!can('leads.write') || update.isPending}
                  onSave={(body) => {
                    update.mutate({ id: lead.id, body });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}

export function SignupsPage() {
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();
  const { can } = useSession();
  const [revealing, setRevealing] = useState<{ id: number; name: string } | null>(null);

  const signups = useQuery(signupsQuery({ perPage: 50, ...(status === '' ? {} : { status }) }));

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      patchSignup(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signups'] }),
  });

  return (
    <>
      <PageHead
        title={copy.inbox.signupsTitle}
        {...(signups.data === undefined ? {} : { count: signups.data.meta.total })}
      />

      <StatusFilter statuses={SIGNUP_STATUSES} value={status} onChange={setStatus} />

      <QueryState
        isPending={signups.isPending}
        isError={signups.isError}
        onRetry={() => void signups.refetch()}
        labels={labels}
        skeletonCount={5}
        skeletonClassName="h-[120px] rounded-panel-sm"
        gridClassName="flex flex-col gap-3"
      >
        {(signups.data?.items.length ?? 0) === 0 ? (
          <EmptyState title={copy.list.empty} description={copy.inbox.signupsTitle} />
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {(signups.data?.items ?? []).map((signup) => (
              <li
                key={signup.id}
                className="rounded-panel-sm border border-line bg-surface px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <strong className="text-bodySm font-semibold text-ink">{signup.fullName}</strong>
                  <a href={`tel:${signup.phone}`} className="text-bodySm text-accent-text">
                    {signup.phone}
                  </a>
                  <span className="text-bodySm text-muted">
                    {copy.inbox.people}: {signup.peopleCount}
                  </span>
                  {signup.roomType !== null && <Badge variant="tint">{signup.roomType}</Badge>}
                  <span className="ml-auto text-label uppercase tracking-[0.16em] text-muted">
                    {new Date(signup.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>

                {signup.comment !== null && signup.comment !== '' && (
                  <p className="mt-3 whitespace-pre-line text-bodySm text-body">{signup.comment}</p>
                )}

                <p className="mt-3 flex items-center gap-3 text-bodySm text-muted">
                  <span>{copy.inbox.passport}:</span>
                  {!signup.hasPassport ? (
                    <span>{copy.inbox.passportNone}</span>
                  ) : can('passport.reveal') ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRevealing({ id: signup.id, name: signup.fullName });
                      }}
                    >
                      {copy.inbox.reveal}
                    </Button>
                  ) : (
                    // Hidden *and* refused: this button's absence is a courtesy, and the server
                    // is what actually says no.
                    <span title={copy.inbox.noPermission}>{copy.inbox.passportHidden}</span>
                  )}
                </p>

                <RowActions
                  statuses={SIGNUP_STATUSES}
                  status={signup.status}
                  notes={signup.adminNotes}
                  disabled={!can('leads.write') || update.isPending}
                  onSave={(body) => {
                    update.mutate({ id: signup.id, body });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {revealing !== null && (
        <PassportDialog
          signup={revealing}
          onClose={() => {
            setRevealing(null);
          }}
        />
      )}
    </>
  );
}

function StatusFilter({
  statuses,
  value,
  onChange,
}: {
  statuses: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={value === '' ? 'solid' : 'outline'}
        onClick={() => {
          onChange('');
        }}
      >
        {copy.slots.all}
      </Button>
      {statuses.map((status) => (
        <Button
          key={status}
          size="sm"
          variant={value === status ? 'solid' : 'outline'}
          onClick={() => {
            onChange(status);
          }}
        >
          {copy.statuses[status] ?? status}
        </Button>
      ))}
    </div>
  );
}

function RowActions({
  statuses,
  status,
  notes,
  disabled,
  onSave,
}: {
  statuses: string[];
  status: string;
  notes: string | null;
  disabled: boolean;
  onSave: (body: Record<string, unknown>) => void;
}) {
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftNotes, setDraftNotes] = useState(notes ?? '');

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
      <Field label={copy.inbox.status} className="w-[180px]">
        <Select
          value={draftStatus}
          disabled={disabled}
          onChange={(event) => {
            setDraftStatus(event.target.value);
            onSave({ status: event.target.value });
          }}
        >
          {statuses.map((option) => (
            <option key={option} value={option}>
              {copy.statuses[option] ?? option}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={copy.inbox.notes} className="min-w-[260px] flex-1">
        <Input
          value={draftNotes}
          disabled={disabled}
          onChange={(event) => {
            setDraftNotes(event.target.value);
          }}
        />
      </Field>

      <Button
        size="sm"
        variant="outline"
        disabled={disabled || draftNotes === (notes ?? '')}
        onClick={() => {
          onSave({ adminNotes: draftNotes === '' ? null : draftNotes });
        }}
      >
        {copy.inbox.saveNotes}
      </Button>
    </div>
  );
}

/** The price the server worked out at submission — never a number that came from a browser. */
function Quote({ snapshot }: { snapshot: unknown }) {
  if (snapshot === null || typeof snapshot !== 'object') return null;

  const quote = snapshot as { total?: { minor?: number; currency?: string } };
  const total = quote.total;
  if (total?.minor === undefined) return null;

  return (
    <p className="mt-3 text-bodySm text-muted">
      {copy.inbox.quote}:{' '}
      <strong className="text-ink">
        {formatMoney({ minor: total.minor, currency: (total.currency ?? 'USD') as 'USD' | 'TMT' })}
      </strong>
    </p>
  );
}

/**
 * The one dialog in this admin that writes to the log before it answers.
 *
 * The reason is required by the API, not by this form — but asking for it here, in a sentence
 * that says the request is recorded, is the difference between a control somebody uses
 * carefully and one they click through.
 */
function PassportDialog({
  signup,
  onClose,
}: {
  signup: { id: number; name: string };
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const reveal = useMutation({
    mutationFn: () => revealPassport(signup.id, reason),
    onSuccess: (result) => {
      setShown(result.passportNumber);
    },
    onError: (error) => {
      setFailure(error instanceof ApiRequestError ? error.message : copy.errors.offline);
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${copy.inbox.passport} — ${signup.name}`}
      closeLabel={copy.form.cancel}
    >
      {shown === null ? (
        <div className="flex flex-col gap-4">
          <Field label={copy.inbox.revealReason} hint={copy.inbox.revealHint} required>
            <Input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </Field>

          {failure !== null && <p className="text-bodySm text-danger">{failure}</p>}

          <Button
            busy={reveal.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => {
              reveal.mutate();
            }}
          >
            {copy.inbox.revealConfirm}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="rounded-panel-sm border border-line bg-field px-4 py-3 text-h3 tracking-[0.08em] text-ink">
            {shown}
          </p>
          <p className="text-bodySm text-muted">{copy.inbox.revealed}</p>
        </div>
      )}
    </Modal>
  );
}
