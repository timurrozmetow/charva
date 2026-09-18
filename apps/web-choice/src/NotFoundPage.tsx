import { type Lang } from '@charva/contracts';
import { buttonClass } from '@charva/ui';

import { ChoiceFooter } from './components/ChoiceFooter';
import { ChoiceNav } from './components/ChoiceNav';
import { copyFor } from './i18n';
import { SITE_URLS } from './lib/sites';
import { useDocumentMeta } from './lib/useDocumentMeta';

export interface NotFoundPageProps {
  lang: Lang;
}

/**
 * The page the chooser never had.
 *
 * Every address on this host but `/` and `/<lang>` reached TanStack's own fallback — black
 * background, «Not Found» in the browser's default serif, nothing else. The owner found it by
 * opening `charva-travel.com/ru/gallery`, and that is the shape of almost every visit here: a
 * page of one of the other two sites, typed or pasted against the apex domain. The routes-map on
 * the API believed the chooser could not have a missing page because its router redirects
 * everything to its one screen — it redirects an unknown *language*, and nothing else.
 *
 * So the answer is not «go home». The apex is a door, and what it has to offer is the two rooms:
 * the same two destinations the chooser itself is made of, one click nearer. The footer's own
 * line already says «Выберите направление», which is the instruction this page wanted anyway.
 *
 * Nothing here waits for the network. The chooser's own page fetches a seat count and six
 * figures; a 404 has no use for any of them, and a page that shows an error after a round trip
 * is worse than one that is simply there. The licence is `null` for the same reason — the footer
 * renders the hint and omits the number rather than printing an empty «Лицензия».
 */
export function NotFoundPage({ lang }: NotFoundPageProps) {
  const copy = copyFor(lang);

  useDocumentMeta(lang, 'notFound');

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-6 py-32">
      <ChoiceNav lang={lang} />

      <div className="flex max-w-[620px] flex-col items-center gap-6 text-center">
        {/*
          Decoration, and marked as such. The number is in the title the screen reader already
          announced; hearing «404» again before the sentence that explains it helps nobody.
        */}
        <p aria-hidden="true" className="text-hero font-medium leading-none text-cream-faint">
          404
        </p>

        <h1 className="text-h2 font-medium text-ink">{copy.notFound.title}</h1>
        <p className="text-lead font-light text-body">{copy.notFound.hint}</p>

        {/*
          Two plain anchors, because these are two other origins (D-131) and the router has
          nothing to say about them. Global first, in the order the halves are drawn.
        */}
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <a href={SITE_URLS.global} className={buttonClass({ variant: 'solid' })}>
            {copy.global.cta}
          </a>
          <a href={SITE_URLS.umrah} className={buttonClass({ variant: 'outline' })}>
            {copy.umrah.cta}
          </a>
        </div>
      </div>

      <ChoiceFooter lang={lang} license={null} />
    </main>
  );
}
