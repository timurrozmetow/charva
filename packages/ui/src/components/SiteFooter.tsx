import { type ReactNode } from 'react';

import { cn } from '../cn';

import { BrandIcon, type BrandName } from './brandIcons';
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
  /**
   * The brand mark. Omit it and the two letters below are drawn instead.
   *
   * The design draws two letters in each circle, and the owner asked for the marks — a logo is
   * recognised without being read, which matters most for the row a visitor scans rather than
   * reads. The letters stay as the fallback, so a channel whose mark this project does not have
   * still gets a circle rather than an empty one.
   */
  icon?: BrandName;
  /** Two letters — IG, TG, WA, YT — drawn when there is no mark. */
  short: string;
  /** The full name. It is the accessible name either way: a logo reads aloud as nothing. */
  label: string;
  href: string;
}

/**
 * Does this social account have somewhere to go?
 *
 * `#` and the empty string are the two ways «not set yet» is spelled: the first is what the
 * settings row was seeded with, the second is what clearing the field in the admin produces.
 * Anything else is taken at face value — validating the shape of a URL here would be a second
 * opinion about a value the admin form already accepted.
 */
function isReachable(social: FooterSocial): boolean {
  const href = social.href.trim();
  return href !== '' && href !== '#';
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
            {/*
              An account nobody has given an address to is not offered.

              Both sites shipped with four circles in the footer whose `href` was `#` — the
              value the settings row was seeded with, not a fallback in the code — so Instagram,
              Telegram, WhatsApp and YouTube each looked like a link and did nothing when
              tapped. That is worse than a shorter footer for the same reason an empty section
              is (D-144): a promise that is not kept costs more than one never made, and this
              audience decides whether to trust an operator by whether the small things work.

              Filtered here rather than in either app, so the third one cannot forget. Each
              circle comes back by itself the day the address is filled in from the admin.
            */}
            <ul className="m-0 flex list-none gap-3 p-0">
              {socials.filter(isReachable).map((social) => (
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
                    {social.icon === undefined ? (
                      <span aria-hidden="true">{social.short}</span>
                    ) : (
                      // Decorative: the anchor already carries the name, and an icon that
                      // announced itself would say it twice.
                      <BrandIcon name={social.icon} size={18} />
                    )}
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

/** The subset of a site's `contacts` this turns into footer links. */
export interface FooterContacts {
  phone: string;
  phoneAlt: string;
  whatsapp: string;
  email: string;
  hours: string;
  address: string;
}

/**
 * The contacts column, built from the settings row rather than written out twice.
 *
 * Both footers had the same six spread-conditionals — «if the field is not empty, make a link» —
 * and they had already drifted: Umrah rendered a second phone line and Global had no branch for
 * one at all, so a second Global number could be entered in the admin and would appear nowhere.
 * `whatsapp` was in the schema, in the seed and in neither footer, which is how a field ends up
 * holding a number for months with no reader.
 *
 * Every line is a real link where a real link exists. A phone number on a phone should dial; an
 * address should be selectable and nothing more, so it gets an empty `href` and `SiteFooter`
 * renders it as text.
 *
 * The WhatsApp number dials rather than opening a chat, and the circle in the row above opens
 * the chat. That is not the same fact twice: it is one number and the two things anyone does
 * with it — and the operator's WhatsApp is a different number from the office line, which is
 * the reason the field exists at all.
 */
export function contactLinks(contacts: Partial<FooterContacts> | undefined): FooterLink[] {
  const dial = (value: string): string => `tel:${value.replace(/[^\d+]/g, '')}`;

  const entries: [keyof FooterContacts, (value: string) => string][] = [
    ['phone', dial],
    ['phoneAlt', dial],
    ['whatsapp', dial],
    ['email', (value) => `mailto:${value}`],
    ['hours', () => ''],
    ['address', () => ''],
  ];

  return entries.flatMap(([key, href]) => {
    const value = contacts?.[key] ?? '';
    return value === '' ? [] : [{ key, label: value, href: href(value) }];
  });
}
