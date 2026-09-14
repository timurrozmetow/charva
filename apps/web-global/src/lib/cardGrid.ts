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

/**
 * A preview on a phone is shorter than a preview on a desk, and this is where that is decided.
 *
 * Below 768 every grid on the homepage becomes one column, so a section that reads as two tidy
 * rows on a monitor becomes six full-width cards one after another — and the homepage has four
 * such sections. Measured at 375×667 it ran to about nineteen screens of scrolling before the
 * footer, most of it previews of pages that each have a «смотреть все» button directly above
 * them. Somebody who wants the sixth tour is one tap from the catalogue; somebody who wants the
 * enquiry form at the bottom was three thousand pixels away from it.
 *
 * `display: none` and not a shorter request: the homepage is one call (`GET /global/home`) whose
 * whole point is that the page arrives in one round trip, and the server has no idea how wide
 * the screen is. Splitting the payload by viewport would mean guessing from a header — the same
 * mistake as choosing a language from `Accept-Language` (D-54). Hidden this way the cards are
 * out of the layout *and* out of the accessibility tree, so a screen reader on a phone hears
 * exactly what a sighted visitor sees.
 *
 * The counts stay where the section is rendered rather than being centralised here: how many
 * tours make a useful preview is a judgement about that section, not a rule about phones.
 */
export function beyondPhonePreview(index: number, keep: number): string {
  return index < keep ? '' : 'mob:hidden';
}
