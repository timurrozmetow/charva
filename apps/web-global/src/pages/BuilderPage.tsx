import { type Lang } from '@charva/contracts';
import { Container, Eyebrow, Heading, Section, StatStrip } from '@charva/ui';

import { TourBuilder } from '../builder/TourBuilder';
import { Breadcrumbs } from '../components/Breadcrumbs';
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

  useDocumentMeta(
    {
      title: copy.builder.metaTitle,
      description: copy.builder.metaDescription,
      pathAfterLang: '/builder',
    },
    lang,
  );

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.builder.breadcrumb }]} />

      <Section space="sm">
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
          <TourBuilder lang={lang} basePath={path.builder(lang)} />
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
