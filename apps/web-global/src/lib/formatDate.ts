import { type Lang } from '@charva/contracts';

/**
 * A date, written the way the reader's language writes one.
 *
 * The API sends ISO strings because that is the only form three languages agree on; «14 августа
 * 2026», «14 August 2026» and «14 Ağustos 2026» are renderings, and rendering is the browser's
 * job. The handoff stores the rendering instead — `visited_on` is the string «Май 2026» — which
 * is exactly why its «Сначала новые» filter sorts nothing.
 *
 * Returns null for a null or unparseable value, so callers omit the line rather than print
 * «Invalid Date» at somebody.
 */
export function formatDate(value: string | null, lang: Lang): string | null {
  if (value === null) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    date,
  );
}
