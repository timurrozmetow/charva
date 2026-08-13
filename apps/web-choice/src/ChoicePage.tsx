import { type Lang } from '@charva/contracts';
import { useDaysUntil } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';

import { choiceQuery } from './api/choice';
import { ChoiceFooter } from './components/ChoiceFooter';
import { type HalfStat, ChoiceHalf } from './components/ChoiceHalf';
import { ChoiceNav } from './components/ChoiceNav';
import { SignupBadge } from './components/SignupBadge';
import { COPY } from './i18n';
import { SITE_URLS } from './lib/sites';
import { useDocumentMeta } from './lib/useDocumentMeta';

/**
 * The whole site: one screen, two halves, four languages.
 *
 * Nothing here waits for the network. Both halves, their headings and their links are copy from
 * the repository, so the page is complete the moment the bundle runs; the request fills in a
 * seat count and three of the six figures, and a stat with no number is dropped rather than
 * rendered as a dash. A visitor who came to click «Global» never waits for a database.
 */
export interface ChoicePageProps {
  lang: Lang;
}

export function ChoicePage({ lang }: ChoicePageProps) {
  const copy = COPY[lang];
  const { data } = useQuery(choiceQuery(lang));

  const trip = data?.umrah.trip ?? null;

  /*
   * One countdown, one rounding rule.
   *
   * The prototypes compute this twice — `Math.ceil` here and on the signup page, `Math.floor`
   * on the Umrah homepage — so the same departure is 39 days away on one page and 38 on
   * another. `useDaysUntil` lives in `packages/ui` for exactly this reason, and it re-reads the
   * clock every thirty seconds so the number rolls over at midnight without a reload; the
   * prototype's signup page computes it inline during render, with no timer at all.
   */
  const daysLeft = useDaysUntil(trip?.departAt ?? Date.now());

  useDocumentMeta(lang, copy.meta.title, copy.meta.description);

  const globalStats: HalfStat[] = [
    { value: format(data?.stats.global.tours), label: copy.global.stats.tours },
    { value: format(data?.stats.global.hotels), label: copy.global.stats.hotels },
    // Null until somebody records it in `settings`: nothing in the schema counts visitors, and
    // «1 400+» in a component is a number nobody can correct. Decision D-6, question Q-5.
    { value: format(data?.stats.global.guestsPerYear), label: copy.global.stats.guests },
  ];

  const umrahStats: HalfStat[] = [
    { value: trip === null ? null : String(daysLeft), label: copy.umrah.stats.days },
    { value: format(data?.stats.umrah.seatsTotal), label: copy.umrah.stats.seats },
    { value: format(data?.stats.umrah.groups), label: copy.umrah.stats.groups },
  ];

  return (
    <main className="relative flex h-dvh min-h-[760px] overflow-hidden bg-bg tab:h-auto tab:min-h-dvh tab:flex-col">
      <ChoiceNav lang={lang} />

      <ChoiceHalf
        variant="global"
        numeral="01"
        headingId="half-global"
        eyebrow={copy.global.eyebrow}
        title={copy.global.title}
        lead={copy.global.lead}
        chips={copy.global.chips}
        stats={globalStats.filter(hasValue)}
        cta={copy.global.cta}
        href={SITE_URLS.global}
        slotKey="choice-global"
        brief="Фон: каньон Йангыкала на закате или Ашхабад ночью — вертикальный кадр"
      />

      <ChoiceHalf
        variant="umrah"
        numeral="02"
        headingId="half-umrah"
        eyebrow={copy.umrah.eyebrow}
        title={copy.umrah.title}
        lead={copy.umrah.lead}
        chips={copy.umrah.chips}
        stats={umrahStats.filter(hasValue)}
        cta={copy.umrah.cta}
        href={SITE_URLS.umrah}
        slotKey="choice-umrah"
        brief="Фон: паломники у Каабы или силуэт мечети Пророка — вертикальный кадр"
        badge={<SignupBadge trip={trip} lang={lang} />}
      />

      <ChoiceFooter lang={lang} license={data?.legal.license ?? null} />
    </main>
  );
}

/** A count that has not arrived yet and a count that does not exist both render as nothing. */
function format(value: number | null | undefined): string | null {
  if (typeof value !== 'number') return null;
  // Grouped with a non-breaking space, the separator `formatMoney` uses, and without a locale:
  // all four languages here group thousands identically, and a fixed `ru-RU` would apply a
  // Russian convention to a Turkmen page for no reason.
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function hasValue(stat: HalfStat): stat is HalfStat & { value: string } {
  return stat.value !== null;
}
