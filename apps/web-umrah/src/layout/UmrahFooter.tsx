import { type Lang, type SiteSettings } from '@charva/contracts';
import { type FooterColumn, type FooterSocial, SiteFooter } from '@charva/ui';
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
      links: [{ key: 'suratlar', label: copy.footer.links.suratlar, href: path.suratlar(lang) }],
    },
    {
      key: 'contacts',
      title: copy.footer.columns.contacts,
      // Real links: a phone number on a phone should dial, and an address that cannot be
      // copied is an address nobody uses.
      links: [
        ...(contacts?.phone === undefined || contacts.phone === ''
          ? []
          : [
              {
                key: 'phone',
                label: contacts.phone,
                href: `tel:${contacts.phone.replace(/[^\d+]/g, '')}`,
              },
            ]),
        // The Umrah desk answers on two lines and both belong in the footer: a pilgrim who
        // cannot get through on the first should not have to hunt for the second.
        ...(contacts?.phoneAlt === undefined || contacts.phoneAlt === ''
          ? []
          : [
              {
                key: 'phoneAlt',
                label: contacts.phoneAlt,
                href: `tel:${contacts.phoneAlt.replace(/[^\d+]/g, '')}`,
              },
            ]),
        ...(contacts?.email === undefined || contacts.email === ''
          ? []
          : [{ key: 'email', label: contacts.email, href: `mailto:${contacts.email}` }]),
        ...(contacts?.hours === undefined || contacts.hours === ''
          ? []
          : [{ key: 'hours', label: contacts.hours, href: '' }]),
        ...(contacts?.address === undefined || contacts.address === ''
          ? []
          : [{ key: 'address', label: contacts.address, href: '' }]),
      ],
    },
  ];

  const socials: FooterSocial[] = (
    [
      ['instagram', 'IG'],
      ['telegram', 'TG'],
      ['whatsapp', 'WA'],
      ['youtube', 'YT'],
    ] as const
  ).map(([key, short]) => ({
    key,
    short,
    label: copy.footer.socials[key],
    href: settings?.socials[key] ?? '#',
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
      crossLinks={
        <>
          <a href={SITE_URLS.choice}>{copy.footer.cross.choice}</a>
          <a href={SITE_URLS.global}>{copy.footer.cross.global}</a>
        </>
      }
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
