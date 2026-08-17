import { type Lang } from '@charva/contracts';
import {
  Accordion,
  buttonClass,
  Container,
  Eyebrow,
  Heading,
  Section,
  StatStrip,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { programQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { copyFor, fill } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface ProgramPageProps {
  lang: Lang;
}

/**
 * The day-by-day programme — the one dark page on this site.
 *
 * `<Section tone="dark">` sets `data-surface="dark"`, which re-points nine theme variables, so
 * every hairline, muted line and card inside renders for a dark backdrop without any component
 * being told (D-29). The prototype sets `html, body { background: #22322B }` and then writes
 * every colour inside as a literal.
 *
 * The ten days actually open. In the handoff a day row only changes its border colour on click:
 * the description is always in the DOM, so a screen reader reads all ten straight through, and
 * the «раскрытие» the design describes does not exist. Here it is a real disclosure list, one
 * row open at a time, and the answer is unmounted when closed rather than hidden — `hidden`
 * alone still lets Ctrl+F find it.
 *
 * The three figures in the header are counted rather than typed. The prototype writes «10 Gün ·
 * 9 Ziýarat ýeri · 45 Adam topar» straight into the markup, and its lead paragraph advertises
 * two packages that do not exist («Adaty paketde 7 gün, VIP-de 12 gün») — decision D-9.
 */
export function ProgramPage({ lang }: ProgramPageProps) {
  const copy = copyFor(lang);
  const query = useQuery(programQuery(lang));
  const data = query.data;

  useDocumentMeta({ route: 'maksatnama', pathAfterLang: '/maksatnama' }, lang);

  const days = data?.days ?? [];
  const places = new Set(days.map((day) => day.city).filter((city) => city !== '')).size;

  return (
    <Section tone="dark" space="none" className="pb-section-lg">
      <Breadcrumbs lang={lang} trail={[{ label: copy.maksatnama.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <div className="grid grid-cols-[1.3fr_1fr] items-end gap-[70px] tab:grid-cols-1 tab:gap-8">
            <div>
              <Eyebrow>{copy.brand}</Eyebrow>
              <Heading level={1} size="h1" className="mt-4">
                {copy.maksatnama.title}
              </Heading>
              <p className="mt-6 max-w-[560px] text-lead font-light text-body">
                {copy.maksatnama.lead}
              </p>
            </div>

            <StatStrip
              items={[
                { value: String(days.length), label: copy.maksatnama.stats.days },
                { value: String(places), label: copy.maksatnama.stats.places },
                {
                  value: String(data?.trip?.seatsTotal ?? 0),
                  label: copy.maksatnama.stats.seats,
                },
              ]}
            />
          </div>
        </Container>
      </Section>

      <Section space="md">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={4}
            skeletonClassName="h-[86px] rounded-panel-sm"
          >
            <Accordion
              headingLevel={2}
              defaultOpen={days[0] === undefined ? [] : [String(days[0].dayNumber)]}
              items={days.map((day) => ({
                id: String(day.dayNumber),
                question: (
                  <span className="flex flex-wrap items-baseline gap-4">
                    <span className="text-label font-black uppercase text-accent-text">
                      {fill(copy.maksatnama.dayLabel, { n: day.dayNumber })}
                    </span>
                    <span>{day.title}</span>
                    {day.city !== '' && (
                      <span className="text-bodySm font-light text-muted">{day.city}</span>
                    )}
                  </span>
                ),
                answer: day.description,
              }))}
            />

            {(data?.routine.length ?? 0) > 0 && (
              <>
                <Heading level={2} size="h2Sm" className="mt-20">
                  {copy.maksatnama.routineTitle}
                </Heading>
                <dl className="mt-8 overflow-hidden rounded-block border border-line bg-surface">
                  {(data?.routine ?? []).map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1fr_1.6fr] gap-[30px] border-t border-line px-8 py-[18px] mob:grid-cols-1 mob:gap-1"
                    >
                      <dt className="text-label font-bold uppercase text-muted">{row.key}</dt>
                      <dd className="text-body text-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            <Link
              to={path.yazylmak(lang)}
              className={buttonClass({ size: 'lg', className: 'mt-14' })}
            >
              {copy.maksatnama.cta}
            </Link>
          </QueryState>
        </Container>
      </Section>
    </Section>
  );
}
