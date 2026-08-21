import { type Lang, LANG_NAMES, SITE_LANGS } from '@charva/contracts';
import { LangSwitcher } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import logoMark from '../assets/logo-mark-sand.png';
import { COPY } from '../i18n';

export interface ChoiceNavProps {
  lang: Lang;
}

/**
 * The floating island: a logo and four languages, and no menu items at all.
 *
 * An island rather than a bar spread across the top, and centred rather than pinned to a side.
 * The theme was ready for it — `islandBg` on this site is dark glass rather than the light card
 * the two public sites use, described in `theme.ts` as «over a photograph», which is exactly
 * what it now sits on. Centred because this page is two halves and a nav belonging to neither
 * should straddle the seam rather than sit in one of them.
 *
 * It spans the rail, like the islands on the two public sites. It was built hugging its content
 * first, on the reasoning that a logo and a language switcher have nothing to fill 1440 pixels
 * with — but the owner has seen both and wants the long one, and consistency across the four
 * sites is a better argument than my worry about the space between two elements.
 *
 * The wrapper does not take pointer events, so the two halves stay hoverable underneath it
 * across their full width — without that, a strip across the top of the screen would silently
 * collapse whichever half the cursor entered through. The island itself does take them, and
 * hovering it expands neither half, which is right: it belongs to neither.
 */
export function ChoiceNav({ lang }: ChoiceNavProps) {
  const copy = COPY[lang];

  const options = SITE_LANGS.choice.map((code) => ({
    code,
    name: LANG_NAMES[code],
    href: `/${code}`,
  }));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-11 py-[26px] tab:px-6 tab:py-4">
      <div className="mx-auto flex max-w-island-choice justify-center">
        <div
          className={[
            'pointer-events-auto flex w-full items-center justify-between gap-6 rounded-full',
            'border border-line bg-island py-[10px] pl-[22px] pr-[14px]',
            'shadow-island backdrop-blur-island tab:gap-3 tab:pl-4',
          ].join(' ')}
        >
          <Link
            to="/$lang"
            params={{ lang }}
            aria-label={copy.nav.home}
            className="inline-flex items-center"
          >
            {/*
            Sized in CSS and in the attributes both: the attributes reserve the space before the
            file arrives, which is the difference between a nav that appears and one that shifts
            everything under it. The source is 189×120 for a 40-pixel render — a downscale of the
            781×496 raster the handoff ships, because there is no vector (question Q-15).
          */}
            <img
              src={logoMark}
              alt="Charva"
              width={63}
              height={40}
              className="h-10 w-auto"
              // The largest element above the fold is the headline, not this; but it is the first
              // thing painted in the nav and a late logo reads as a broken page.
              //
              // Lowercase and spread, exactly as `Img` does it. React 18 does not know the
              // camel-cased prop: it warns, drops the attribute, and the hint never reaches the
              // browser — so the version that looks right is the one that does nothing.
              {...({ fetchpriority: 'high' } as Record<string, string>)}
            />
          </Link>

          <LangSwitcher
            options={options}
            value={lang}
            label={copy.nav.langLabel}
            /*
             * `aria-current` is left to the router.
             *
             * `LangSwitcher` offers it — it has to, because it cannot assume an app has a router
             * that knows — but TanStack's `Link` already marks the matching route, and it marks
             * it `page` rather than `true`, which is the more specific and more useful of the two:
             * each language is a page, and `page` is what a screen reader announces as «current
             * page». Setting ours as well would be two sources for one attribute, and the router
             * would win anyway.
             */
            renderLink={(option, props) => (
              <Link
                key={option.code}
                to="/$lang"
                params={{ lang: option.code }}
                className={props.className}
                onClick={props.onClick}
              >
                {props.children}
              </Link>
            )}
          />
        </div>
      </div>
    </div>
  );
}
