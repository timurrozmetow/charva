import { type Lang, type SiteSettings } from '@charva/contracts';
import { type FooterColumn, type FooterSocial, SiteFooter } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import logoMark from '../assets/logo-mark-sand.png';
import { copyFor, fill } from '../i18n';
import { path, SITE_URLS } from '../lib/routes';

export interface GlobalFooterProps {
  lang: Lang;
  /** From `GET /global/settings`. Null while it is still in flight or if the request failed. */
  settings: SiteSettings | null;
}

/**
 * The footer.
 *
 * Contacts, the address and the licence number come from `settings` rather than from the copy
 * files: they are content an editor changes without a deploy, and the prototype has the phone
 * number typed into two files with two different email domains (Q-12). The words *around* them
 * — the column headings, «Все права защищены» — are copy, and stay in the repository (D-23).
 *
 * Everything renders without the request. A footer that waits for the network to draw its
 * headings is a footer that flashes empty on every page load.
 */
export function GlobalFooter({ lang, settings }: GlobalFooterProps) {
  const copy = copyFor(lang);
  const contacts = settings?.contacts;

  const columns: FooterColumn[] = [
    {
      key: 'tours',
      title: copy.footer.columns.tours,
      links: [
        { key: 'ready', label: copy.footer.links.readyTours, href: path.tours(lang) },
        { key: 'builder', label: copy.footer.links.builder, href: path.builder(lang) },
        { key: 'hotels', label: copy.footer.links.hotels, href: path.hotels(lang) },
        { key: 'contact', label: copy.footer.links.contact, href: path.contact(lang) },
      ],
    },
    {
      key: 'country',
      title: copy.footer.columns.country,
      links: [
        { key: 'country', label: copy.footer.links.country, href: path.country(lang) },
        { key: 'gallery', label: copy.footer.links.gallery, href: path.gallery(lang) },
        { key: 'video', label: copy.footer.links.video, href: path.video(lang) },
        { key: 'reviews', label: copy.footer.links.reviews, href: path.reviews(lang) },
      ],
    },
    {
      key: 'contacts',
      title: copy.footer.columns.contacts,
      // Real links, not text: a phone number on a phone should dial, and an address that
      // cannot be copied is an address nobody uses.
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

  const socials: FooterSocial[] = [
    {
      key: 'instagram',
      short: 'IG',
      label: copy.footer.socials.instagram,
      href: settings?.socials.instagram ?? '#',
    },
    {
      key: 'telegram',
      short: 'TG',
      label: copy.footer.socials.telegram,
      href: settings?.socials.telegram ?? '#',
    },
    {
      key: 'whatsapp',
      short: 'WA',
      label: copy.footer.socials.whatsapp,
      href: settings?.socials.whatsapp ?? '#',
    },
    {
      key: 'youtube',
      short: 'YT',
      label: copy.footer.socials.youtube,
      href: settings?.socials.youtube ?? '#',
    },
  ];

  return (
    <SiteFooter
      label={copy.footer.label}
      logo={
        <Link to={path.home(lang)} aria-label={copy.nav.home} className="inline-flex items-center">
          <img src={logoMark} alt={copy.brand} width={88} height={56} className="h-14 w-auto" />
        </Link>
      }
      legal={fill(copy.footer.legal, {
        address: contacts?.address ?? '',
        license: settings?.legal.license ?? '',
      })}
      copyright={fill(copy.footer.copyright, {
        // The year is the only date this site computes, and it is the copyright line. Reading
        // the clock is right here and wrong everywhere else — see `no-hardcoded-date.test.ts`.
        year: new Date().getFullYear(),
      })}
      socials={socials}
      columns={columns}
      crossLinks={
        <>
          <a href={SITE_URLS.choice}>{copy.footer.cross.choice}</a>
          <a href={SITE_URLS.umrah}>{copy.footer.cross.umrah}</a>
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
