import { type ReactNode } from 'react';

import { cn } from '../cn';

import { Container } from './Container';

export interface FooterLink {
  key: string;
  label: ReactNode;
  href: string;
}

export interface FooterLinkProps {
  className: string;
  children: ReactNode;
}

export interface FooterColumn {
  key: string;
  title: ReactNode;
  links: readonly FooterLink[];
}

export interface FooterSocial {
  key: string;
  /** Two letters — IG, TG, WA, YT — as the design draws them. */
  short: string;
  /** The full name, for anyone who cannot see the two letters. */
  label: string;
  href: string;
}

export interface SiteFooterProps {
  /** The sand logo, already wrapped in the app's link. */
  logo: ReactNode;
  /** Company, address, licence number. */
  legal: ReactNode;
  socials: readonly FooterSocial[];
  columns: readonly FooterColumn[];
  copyright: ReactNode;
  /** Links to the chooser page and the other site. */
  crossLinks?: ReactNode;
  renderLink: (link: FooterLink, props: FooterLinkProps) => ReactNode;
  /** Names the landmark — «Подвал сайта». */
  label: string;
  className?: string;
}

/**
 * The site footer.
 *
 * Both footers in the handoff are the same component with different colours and different
 * words, so this is one component and the colours are theme variables. It sits on the darkest
 * brand surface, which means `data-surface="dark"` — the hairline between the columns, the
 * muted text and the link accent all resolve for a dark backdrop without a prop.
 *
 * The social buttons carry their full name for assistive technology. «IG» read aloud is two
 * letters, and there are four of them in a row.
 */
export function SiteFooter({
  logo,
  legal,
  socials,
  columns,
  copyright,
  crossLinks,
  renderLink,
  label,
  className,
}: SiteFooterProps) {
  return (
    <footer
      aria-label={label}
      data-surface="dark"
      className={cn(
        'mt-section-lg bg-dark pt-[76px] text-dark-on [--c-bg:var(--c-dark)]',
        className,
      )}
    >
      <Container>
        <div
          className={cn(
            'grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-[50px] border-b border-line pb-[60px]',
            'lap:grid-cols-2 mob:grid-cols-1 mob:gap-8',
          )}
        >
          <div className="flex flex-col gap-6">
            {logo}
            <p className="m-0 max-w-[300px] text-bodySm font-light leading-[1.7] text-muted">
              {legal}
            </p>
            <ul className="m-0 flex list-none gap-3 p-0">
              {socials.map((social) => (
                <li key={social.key}>
                  <a
                    href={social.href}
                    aria-label={social.label}
                    className={cn(
                      'grid h-tap w-tap place-items-center rounded-full border border-line',
                      'text-label font-bold uppercase text-dark-on no-underline',
                      'transition-colors duration-colour hover:bg-accent hover:text-accent-on',
                    )}
                  >
                    <span aria-hidden="true">{social.short}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <nav key={column.key} className="flex flex-col gap-5">
              <h2 className="m-0 font-black uppercase text-label tracking-[0.22em] text-accent">
                {column.title}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {column.links.map((link) => (
                  <li key={link.key}>
                    {renderLink(link, {
                      className:
                        'inline-flex min-h-tap items-center text-bodySm text-muted no-underline transition-colors duration-colour hover:text-accent',
                      children: link.label,
                    })}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex items-center justify-between gap-6 py-[26px] pb-[30px] text-[12px] text-muted mob:flex-col mob:items-start mob:gap-3">
          <p className="m-0">{copyright}</p>
          {crossLinks}
        </div>
      </Container>
    </footer>
  );
}
