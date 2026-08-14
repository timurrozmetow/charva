/**
 * `2026-09-18T06:00:00Z` → «18.09.2026», in Ashgabat.
 *
 * Two decisions, both deliberate.
 *
 * **The same numeric form in both languages.** A Turkmen reader and a Russian reader are
 * looking at the same flight, and «18 sentýabr» beside «18 сентября» in a forwarded screenshot
 * is two renderings of one fact. The design draws `18.09.2026` on both, and that is right here
 * even though the Global site formats its dates per locale — an article's publication date is
 * prose, a departure is a document.
 *
 * **Ashgabat, not the reader's timezone.** `departAt` is stored UTC, and a departure at 22:00Z
 * is the next morning in Turkmenistan. Formatting in whatever zone the browser happens to be in
 * would show a pilgrim abroad a date one day off the one on their ticket.
 *
 * Returns null for anything unparseable, so callers omit the line rather than print
 * «Invalid Date» at somebody.
 */
const ASHGABAT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ashgabat',
});

export function formatDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return ASHGABAT.format(date);
}
