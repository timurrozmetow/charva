import { type Lang } from '@charva/contracts';
import {
  Accordion,
  Container,
  Eyebrow,
  Heading,
  ImageSlot,
  Section,
  Skeleton,
  Tabs,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

import { faqQuery, settingsQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { LeadForm, type LeadKind } from '../components/LeadForm';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface ContactPageProps {
  lang: Lang;
}

const TAB_KINDS = ['tour', 'question'] as const;
type TabKind = (typeof TAB_KINDS)[number];

/**
 * The tab, in the URL.
 *
 * Not `useListSearch`: there is no page to paginate and the parameter is named for what it
 * actually is. The reason it is in the address at all is the same one — «напишите нам» from a
 * tour page and «есть вопрос» from the footer should be two different links, and after a failed
 * submission the back button should not silently switch which form somebody was filling in.
 */
function useContactTab(basePath: string): [TabKind, (value: string) => void] {
  const navigate = useNavigate();
  const search: Record<string, unknown> = useSearch({ strict: false });

  const raw = search['kind'];
  const kind: TabKind = raw === 'question' ? 'question' : 'tour';

  const setKind = useCallback(
    (value: string) => {
      void navigate({
        to: basePath,
        // `tour` is the default and never reaches the address bar: one page, one address.
        search: value === 'tour' ? {} : { kind: value },
        replace: true,
      });
    },
    [navigate, basePath],
  );

  return [kind, setKind];
}

/**
 * The enquiry page.
 *
 * The prototype's two tabs change nothing — the fields are identical either way and the note in
 * `SCREENS.md` leaves the question open. They are resolved here by making the tab mean
 * something: `kind` is stored on the lead, so the inbox can tell a booking from a question, and
 * a general question stops asking for a party size and a list of interests it has no use for.
 *
 * Everything else on the page is the same argument as the footer's: the phone number, the hours
 * and the licence come from `settings`, because an editor changes them without a deploy — and
 * the prototype has the number typed into two files with two different e-mail domains (Q-12).
 */
export function ContactPage({ lang }: ContactPageProps) {
  const copy = copyFor(lang);
  const [tab, setTab] = useContactTab(path.contact(lang));
  const settings = useQuery(settingsQuery(lang));
  const faq = useQuery(faqQuery(lang));

  useDocumentMeta({ route: 'contact', pathAfterLang: '/contact' }, lang);

  const contacts = settings.data?.contacts;
  const socials = settings.data?.socials;

  const rows: { key: keyof typeof copy.contact.labels; value: string; href: string }[] = [
    {
      key: 'phone',
      value: contacts?.phone ?? '',
      href: `tel:${(contacts?.phone ?? '').replace(/[^\d+]/g, '')}`,
    },
    {
      key: 'whatsapp',
      value: contacts?.whatsapp ?? '',
      href: `https://wa.me/${(contacts?.whatsapp ?? '').replace(/\D/g, '')}`,
    },
    { key: 'email', value: contacts?.email ?? '', href: `mailto:${contacts?.email ?? ''}` },
    // Opening hours are a fact, not a destination.
    { key: 'hours', value: contacts?.hours ?? '', href: '' },
  ];

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.contact.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4 max-w-[820px]">
            {copy.contact.title}
          </Heading>
          <p className="mt-6 max-w-[620px] text-lead font-light text-body">{copy.contact.lead}</p>

          <div className="mt-14 grid grid-cols-[1.15fr_1fr] items-start gap-[26px] tab:grid-cols-1">
            <div className="rounded-panel border border-line bg-surface p-11 mob:p-6">
              <Tabs
                items={TAB_KINDS.map((value) => ({ value, label: copy.contact.tabs[value] }))}
                value={tab}
                onValueChange={setTab}
                label={copy.contact.tabsLabel}
              />

              {/*
                Keyed by the tab.

                Remounting on a switch is deliberate: the two tabs submit different `kind`s and
                show different fields, and carrying a half-filled «Гостей» into «Общий вопрос»
                would send a number the form no longer displays. What is lost is a name and a
                phone, which is a fair trade for never submitting something invisible.
              */}
              <LeadForm key={tab} lang={lang} kind={tab satisfies LeadKind} className="mt-9" />
            </div>

            <div className="flex flex-col gap-[26px]">
              <div
                data-surface="dark"
                className="rounded-panel bg-dark-alt p-10 text-dark-on mob:p-6"
              >
                <Heading level={2} size="h3">
                  {copy.contact.contactsTitle}
                </Heading>

                <dl className="mt-7">
                  {settings.isPending
                    ? Array.from({ length: 4 }, (_, index) => (
                        <Skeleton key={index} className="my-4 h-6 w-full" />
                      ))
                    : rows
                        .filter((row) => row.value !== '')
                        .map((row) => (
                          <div
                            key={row.key}
                            className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-4"
                          >
                            <dt className="text-label font-bold uppercase text-muted">
                              {copy.contact.labels[row.key]}
                            </dt>
                            <dd className="text-body text-ink">
                              {row.href === '' ? (
                                row.value
                              ) : (
                                <a
                                  href={row.href}
                                  className="transition-colors duration-colour hover:text-accent-text"
                                >
                                  {row.value}
                                </a>
                              )}
                            </dd>
                          </div>
                        ))}
                </dl>

                <p className="mt-8 text-label font-bold uppercase text-muted">
                  {copy.contact.socialsLabel}
                </p>
                <ul className="mt-4 flex list-none flex-wrap gap-3 p-0">
                  {(
                    [
                      ['instagram', 'IG'],
                      ['telegram', 'TG'],
                      ['whatsapp', 'WA'],
                      ['youtube', 'YT'],
                    ] as const
                  ).map(([key, short]) => (
                    <li key={key}>
                      <a
                        href={socials?.[key] ?? '#'}
                        // Named for what it is, not for the two letters drawn inside it: «IG»
                        // is announced as «eye gee» and means nothing.
                        aria-label={copy.footer.socials[key]}
                        className="flex size-[42px] items-center justify-center rounded-full border border-line text-label font-bold text-ink transition-colors duration-colour hover:border-accent hover:text-accent-text"
                      >
                        <span aria-hidden="true">{short}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <ImageSlot
                slotKey="contact-office"
                brief={copy.contact.officeCaption}
                media={null}
                ratio="4/3"
                className="h-[300px] w-full rounded-panel"
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section space="md" className="pb-section">
        <Container>
          <Heading level={2} size="h2">
            {copy.contact.faqTitle}
          </Heading>

          {faq.isPending ? (
            <div className="mt-10 grid grid-cols-2 gap-4 tab:grid-cols-1">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-[76px] rounded-panel-sm" />
              ))}
            </div>
          ) : (
            <Accordion
              columns={2}
              className="mt-10"
              headingLevel={3}
              items={(faq.data?.items ?? []).map((item) => ({
                id: String(item.id),
                question: item.question,
                answer: item.answer,
              }))}
              // The design opens the first row, and it is worth keeping: an accordion whose
              // rows are all shut looks like a list of links until somebody presses one.
              defaultOpen={faq.data?.items[0] === undefined ? [] : [String(faq.data.items[0].id)]}
            />
          )}
        </Container>
      </Section>
    </>
  );
}
