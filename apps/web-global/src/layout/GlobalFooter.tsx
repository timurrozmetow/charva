import { type Lang, type SiteSettings } from '@charva/contracts';
import { contactLinks, type FooterColumn, type FooterSocial, SiteFooter } from '@charva/ui';
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
  // The same rule as the menu: a link into an empty section is a dead end, and it comes back
  // by itself the day something is published there.
  const has = settings?.sections;

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
        { key: 'journal', label: copy.footer.links.journal, href: path.articles(lang) },
        ...(has?.gallery === true
          ? [{ key: 'gallery', label: copy.footer.links.gallery, href: path.gallery(lang) }]
          : []),
        ...(has?.video === true
          ? [{ key: 'video', label: copy.footer.links.video, href: path.video(lang) }]
          : []),
        ...(has?.reviews === true
          ? [{ key: 'reviews', label: copy.footer.links.reviews, href: path.reviews(lang) }]
          : []),
        // A licence obligation, not a navigation aid — which is why it is last and quiet.
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
      /*
        Two sentences, not one with a hole in it. The operator has no licence number to print,
        and «Лицензия № .» is worse than saying nothing — it reads as a value that failed to
        load rather than as a clause that does not apply.
      */
      legal={
        settings?.legal.license == null || settings.legal.license === ''
          ? fill(copy.footer.legalPlain, { address: contacts?.address ?? '' })
          : fill(copy.footer.legal, {
              address: contacts?.address ?? '',
              license: settings.legal.license,
            })
      }
      copyright={fill(copy.footer.copyright, {
        // The year is the only date this site computes, and it is the copyright line. Reading
        // the clock is right here and wrong everywhere else — see `no-hardcoded-date.test.ts`.
        year: new Date().getFullYear(),
      })}
      socials={socials}
      columns={columns}
      crossLinks={[
        { key: 'choice', href: SITE_URLS.choice, label: copy.footer.cross.choice },
        { key: 'umrah', href: SITE_URLS.umrah, label: copy.footer.cross.umrah },
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
