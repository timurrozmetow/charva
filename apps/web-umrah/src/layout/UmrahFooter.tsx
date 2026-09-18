import { type Lang, type SiteSettings } from '@charva/contracts';
import { contactLinks, type FooterColumn, type FooterSocial, SiteFooter } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import logoMark from '../assets/logo-mark-sand.png';
import { copyFor, fill } from '../i18n';
import { path, SITE_URLS } from '../lib/routes';

export interface UmrahFooterProps {
  lang: Lang;
  /** From `GET /umrah/settings`. Null while it is still in flight or if the request failed. */
  settings: SiteSettings | null;
}

/**
 * The footer.
 *
 * Contacts, the address and the licence number come from `settings`, not from the copy files:
 * they are content an editor changes without a deploy. The prototype types the same phone
 * number into both sites' footers with two different e-mail domains — question Q-12.
 *
 * Everything else renders before the request lands. A footer that waits for the network to draw
 * its headings flashes empty on every page load.
 */
export function UmrahFooter({ lang, settings }: UmrahFooterProps) {
  const copy = copyFor(lang);
  const contacts = settings?.contacts;

  const columns: FooterColumn[] = [
    {
      key: 'trip',
      title: copy.footer.columns.trip,
      links: [
        { key: 'paket', label: copy.footer.links.paket, href: path.paket(lang) },
        { key: 'maksatnama', label: copy.footer.links.maksatnama, href: path.maksatnama(lang) },
        { key: 'ziyarat', label: copy.footer.links.ziyarat, href: path.ziyarat(lang) },
        { key: 'yazylmak', label: copy.footer.links.yazylmak, href: path.yazylmak(lang) },
      ],
    },
    {
      key: 'about',
      title: copy.footer.columns.about,
      links: [
        { key: 'suratlar', label: copy.footer.links.suratlar, href: path.suratlar(lang) },
        // A licence obligation rather than a place anybody is going — last, and quiet.
        { key: 'credits', label: copy.footer.links.credits, href: path.credits(lang) },
      ],
    },
    {
      key: 'contacts',
      title: copy.footer.columns.contacts,
      // Built in `packages/ui`, from the settings row. Both footers wrote the same six
      // «if it is not empty, make a link» branches and had already drifted apart: this one had
      // no branch for a second phone number, and neither had one for the WhatsApp line.
      links: contactLinks(contacts),
    },
  ];

  /*
   * Seven channels in one table rather than seven blocks of four lines.
   *
   * The order is the order they appear in the footer, the pair is the key in `settings` and the
   * two letters the design draws in the circle, and an account with no address is dropped by
   * `SiteFooter` — so this list is every channel the operator *could* have, not every one they
   * do. A channel gained in the admin appears without a deploy.
   */
  const socials: FooterSocial[] = (
    [
      ['instagram', 'IG', 'instagram'],
      ['telegram', 'TG', 'telegram'],
      ['whatsapp', 'WA', 'whatsapp'],
      ['tiktok', 'TT', 'tiktok'],
      ['facebook', 'FB', 'facebook'],
      ['youtube', 'YT', 'youtube'],
      /*
       * imo, last, and here for a reason the other six are not.
       *
       * It is the messenger most of Turkmenistan actually uses, which makes it the channel this
       * audience reaches for first and one almost no travel site outside the region carries.
       */
      ['imo', 'IM', 'chat'],
    ] as const
  ).map(([key, short, icon]) => ({
    key,
    short,
    icon,
    label: copy.footer.socials[key],
    href: settings?.socials[key] ?? '',
  }));

  return (
    <SiteFooter
      label={copy.footer.label}
      logo={
        <Link to={path.home(lang)} aria-label={copy.nav.home} className="inline-flex items-center">
          <img src={logoMark} alt={copy.brand} width={88} height={56} className="h-14 w-auto" />
        </Link>
      }
      // Same as Global: a licence clause only when there is a licence to name.
      legal={
        settings?.legal.license == null || settings.legal.license === ''
          ? fill(copy.footer.legalPlain, { address: contacts?.address ?? '' })
          : fill(copy.footer.legal, {
              address: contacts?.address ?? '',
              license: settings.legal.license,
            })
      }
      copyright={fill(copy.footer.copyright, {
        // The year is the only date this site reads from the clock, and it is the copyright
        // line. Every other date comes from `umrah_trips` — see `no-hardcoded-date.test.ts`.
        year: new Date().getFullYear(),
      })}
      socials={socials}
      columns={columns}
      crossLinks={[
        { key: 'choice', href: SITE_URLS.choice, label: copy.footer.cross.choice },
        { key: 'global', href: SITE_URLS.global, label: copy.footer.cross.global },
      ]}
      renderLink={(link, props) =>
        // A line with no destination — opening hours, the street address — is text, not a link.
        link.href === '' ? (
          <span key={link.key} className={props.className}>
            {props.children}
          </span>
        ) : link.href.startsWith('/') ? (
          <Link key={link.key} to={link.href} className={props.className}>
            {props.children}
          </Link>
        ) : (
          <a key={link.key} href={link.href} className={props.className}>
            {props.children}
          </a>
        )
      }
    />
  );
}
