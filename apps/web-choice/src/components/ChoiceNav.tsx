import { type Lang, LANG_NAMES, SITE_LANGS } from '@charva/contracts';
import { LangSwitcher } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import logoMark from '../assets/logo-mark-sand.png';
import { COPY } from '../i18n';

export interface ChoiceNavProps {
  lang: Lang;
}

/**
 * The floating bar: a logo and four languages, and no menu items at all.
 *
 * The wrapper does not take pointer events, so the two halves stay hoverable underneath it
 * across their full width — without that, a 44-pixel-tall strip across the top of the screen
 * would silently collapse whichever half the cursor entered through.
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
      <div className="pointer-events-auto mx-auto flex max-w-island-choice items-center justify-between">
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
  );
}
