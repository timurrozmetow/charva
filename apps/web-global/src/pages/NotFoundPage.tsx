import { type Lang } from '@charva/contracts';
import { buttonClass, Container, Heading, Section } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor } from '../i18n';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface NotFoundPageProps {
  lang: Lang;
}

/**
 * The page the handoff does not contain.
 *
 * It will be reached: every card in the prototypes links to `#`, so every link anyone has ever
 * shared from a preview is already wrong, and slugs outlive the rows behind them. It offers the
 * two ways forward that actually help — the catalogue and the contact form — rather than an
 * apology.
 */
export function NotFoundPage({ lang }: NotFoundPageProps) {
  const copy = copyFor(lang);

  useDocumentMeta(
    { title: copy.common.notFoundTitle, description: copy.common.notFoundHint, pathAfterLang: '' },
    lang,
  );

  return (
    <Section space="lg">
      <Container>
        <div className="mx-auto flex max-w-[560px] flex-col items-center gap-6 py-24 text-center">
          <p aria-hidden="true" className="text-hero font-medium leading-none text-tint-line">
            404
          </p>
          <Heading level={1} size="h2">
            {copy.common.notFoundTitle}
          </Heading>
          <p className="text-lead font-light text-body">{copy.common.notFoundHint}</p>

          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link to={path.home(lang)} className={buttonClass({ variant: 'solid' })}>
              {copy.common.backHome}
            </Link>
            <Link to={path.tours(lang)} className={buttonClass({ variant: 'outline' })}>
              {copy.nav.items.tours}
            </Link>
            <Link to={path.contact(lang)} className={buttonClass({ variant: 'outline' })}>
              {copy.nav.cta}
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}
