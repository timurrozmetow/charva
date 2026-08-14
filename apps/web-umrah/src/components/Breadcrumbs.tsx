import { type Lang } from '@charva/contracts';
import { Container } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor } from '../i18n';
import { path } from '../lib/routes';

export interface Crumb {
  label: string;
  /** Absent on the last crumb, which is the page you are already on. */
  href?: string;
}

export interface BreadcrumbsProps {
  lang: Lang;
  /** Everything after «Главная», which is added here. */
  trail: readonly Crumb[];
}

/**
 * «Baş sahypa / Ziýarat ýerleri / Masjid al-Haram».
 *
 * A real `<nav>` with an ordered list, because that is what it is: the prototype draws it as a
 * row of spans, so a screen reader announces «Baş sahypa slash Paket» as one run of text with no
 * indication that the first part is a link or that this is a hierarchy.
 *
 * The current page is present but not a link — `aria-current="page"` — rather than omitted.
 * Leaving it out saves a word and loses the answer to «where am I».
 */
export function Breadcrumbs({ lang, trail }: BreadcrumbsProps) {
  const copy = copyFor(lang);
  const crumbs: Crumb[] = [{ label: copy.common.breadcrumbHome, href: path.home(lang) }, ...trail];

  return (
    <Container>
      <nav aria-label={copy.common.breadcrumbHome} className="pt-6">
        <ol className="flex flex-wrap items-center gap-2 text-bodySm text-muted">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${String(index)}`} className="flex items-center gap-2">
                {index > 0 && (
                  <span aria-hidden="true" className="text-muted">
                    /
                  </span>
                )}
                {crumb.href === undefined || last ? (
                  <span aria-current="page" className="text-body">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.href}
                    className="transition-colors duration-colour hover:text-accent-text"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </Container>
  );
}
