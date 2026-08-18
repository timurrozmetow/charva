import { type Lang } from '@charva/contracts';
import { Container, Eyebrow, Heading, Section, StatStrip } from '@charva/ui';

import { TourBuilder } from '../builder/TourBuilder';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { LeadForm } from '../components/LeadForm';
import { copyFor } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface BuilderPageProps {
  lang: Lang;
}

/**
 * The builder's own page.
 *
 * Everything below the header is `TourBuilder`, which the homepage mounts as well. The three
 * figures are the only literals on this page and they are honest ones: nine steps is a fact
 * about the form, and «15 минут» and «0 $» are promises the operator is making rather than
 * counts of anything — so they live in the copy files with the rest of the interface text
 * (D-23) instead of pretending to be aggregates.
 */
export function BuilderPage({ lang }: BuilderPageProps) {
  const copy = copyFor(lang);

  useDocumentMeta({ route: 'builder', pathAfterLang: '/builder' }, lang);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.builder.breadcrumb }]} />

      {/*
        Bottom padding, spelled out.

        A `page`-toned section gets top spacing only — sections stack, and the next one's top
        padding is the gap. That breaks where the next section is dark: its padding is inside
        its own background, so the dark band starts on the line under the lead paragraph and
        the header has no air at all. The values are `space="sm"`'s own, so the gap below
        matches the gap above.
      */}
      <Section space="sm" className="pb-16 tab:pb-12 mob:pb-10">
        <Container>
          <div className="grid grid-cols-[1.3fr_1fr] items-end gap-[70px] tab:grid-cols-1 tab:gap-8">
            <div>
              <Eyebrow>{copy.brand}</Eyebrow>
              <Heading level={1} size="h1" className="mt-4">
                {copy.builder.title}
              </Heading>
              <p className="mt-6 max-w-[560px] text-lead font-light text-body">
                {copy.builder.lead}
              </p>
            </div>

            <StatStrip
              items={[
                { value: '9', label: copy.builder.stats.steps },
                { value: copy.builder.stats.replyValue, label: copy.builder.stats.reply },
                { value: copy.builder.stats.costValue, label: copy.builder.stats.cost },
              ]}
            />
          </div>
        </Container>
      </Section>

      <Section tone="dark" space="md">
        <Container>
          <TourBuilder
            lang={lang}
            basePath={path.builder(lang)}
            /*
             * The ninth step is the same form as the contact page, carrying the selection.
             *
             * The price is not sent with it and there is no field for one: the server prices
             * the codes from the database and stores that in `quote_snapshot`, because a total
             * that arrived from a browser is a total the sender chose. The party size comes
             * from step seven, so the form does not ask for it a second time.
             */
            renderForm={({ selection }) => (
              <LeadForm
                lang={lang}
                kind="builder"
                selection={selection}
                showGuests={false}
                showTopics={false}
              />
            )}
          />
        </Container>
      </Section>

      <Section space="md" className="pb-section">
        <Container>
          <Heading level={2} size="h2Sm">
            {copy.builder.how.title}
          </Heading>
          <ol className="mt-10 grid list-none grid-cols-4 gap-6 p-0 tab:grid-cols-2 mob:grid-cols-1">
            {copy.builder.how.items.map((item) => (
              <li key={item.n} className="flex flex-col gap-3">
                <span aria-hidden="true" className="text-label font-black text-accent-text">
                  {item.n}
                </span>
                <h3 className="text-cardTitle font-medium text-ink">{item.title}</h3>
                <p className="text-bodySm font-light text-body">{item.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
    </>
  );
}
