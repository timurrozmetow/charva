/**
 * The class for a grid of cards, given how many cards there are.
 *
 * Every catalogue on this site is a hard `grid-cols-3`, which is right for nine tours and wrong
 * for one. The tour catalogue holds exactly one published tour today — the owner unpublished the
 * nine invented ones and the real ones are not written yet — so `/ru/tours` renders a single
 * card pinned to the left of a 1480-pixel row with two empty columns beside it. That does not
 * read as «one tour». It reads as a page that failed to load the other two.
 *
 * The fix is not fewer columns on their own: one column across the full width would stretch a
 * card designed at 476 pixels to three times that. So the column count *and* the width of the
 * list both follow the count, and the list is centred. One card looks like one card, deliberately
 * placed; two look like a pair; three or more behave exactly as before.
 *
 * The widths are the card's own: a 1480-pixel container with two 26-pixel gaps divides into
 * three 476-pixel columns, so a row of two is 978 and a row of one is 476. Rounded up to 480 and
 * 986 — a card a few pixels wider than its siblings on another page is not a thing anybody can
 * see, and a number that is obviously derived is easier to keep true than one that is exact.
 *
 * Written out as whole class strings rather than assembled from fragments: Tailwind scans source
 * text for class names and finds nothing in `` `grid-cols-${n}` ``.
 */
export function cardGridClass(count: number): string {
  if (count <= 1) {
    return 'mx-auto grid max-w-[480px] list-none grid-cols-1 gap-[26px] p-0';
  }
  if (count === 2) {
    return 'mx-auto grid max-w-[986px] list-none grid-cols-2 gap-[26px] p-0 mob:grid-cols-1';
  }
  return 'grid list-none grid-cols-3 gap-[26px] p-0 lap:grid-cols-2 mob:grid-cols-1';
}
