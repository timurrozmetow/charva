import { type MediaRef } from '@charva/contracts';
import { ImageSlot } from '@charva/ui';
import { type ReactNode } from 'react';

export interface HalfStat {
  /** Already formatted for display. Null means «nothing counts this» and the stat is dropped. */
  value: string | null;
  label: string;
}

export interface ChoiceHalfProps {
  eyebrow: string;
  title: string;
  lead: string;
  chips: readonly string[];
  stats: readonly HalfStat[];
  cta: string;
  href: string;
  /** `content_slots` key and its art direction, until a photograph exists (D-21, Q-1). */
  slotKey: string;
  brief: string;
  /**
   * The photograph, once the slot has one.
   *
   * It used to be `null` written into the component, which meant the two pictures this page is
   * mostly made of could never appear however full the database was.
   */
  media: MediaRef | null;
  /** The Umrah half is darkened from a cooler base and shifted six pixels up. */
  variant: 'global' | 'umrah';
  /** The badge, which only the Umrah half has. */
  badge?: ReactNode;
  headingId: string;
}

/**
 * One half of the chooser.
 *
 * The expansion is a `flex-grow` transition on the hovered half alone, which is what produces
 * the design's 59/41 split rather than a symmetric push. It is gated behind
 * `@media (hover: hover)` by the preset, so a tap on a phone opens the link instead of leaving
 * one half stuck open with no way to close it.
 *
 * `focus-within` expands it too. A keyboard user gets no hover, and without this the only
 * feedback that the left half is focused would be the focus ring on a link that fills half the
 * screen — the same affordance, reached a different way.
 */
/**
 * Where the seat badge sits, written against the `pt-…` on the half above.
 *
 * The two numbers are one sum, so here is the sum. The nav island is 26px down and about 62px
 * tall (10px of padding either side of a 40px logo, plus its hairline), so it ends at 88. The
 * badge starts at 96 and is about 37 tall — 10px of padding either side of a 12px line — so it
 * ends at 133, and the column's 150px of top padding starts below that with room to spare.
 *
 * No `lap:` step, and that is deliberate: the island keeps its full 26px offset all the way
 * down to the tablet breakpoint — its own override is `tab:py-4`, not `lap:` — so a badge moved
 * up at `lap` would climb *into* it. Below `tab` the halves stack, the island is over the
 * Global half and the badge is over the Umrah one, so the only clearance that still matters is
 * the badge's own: 80 + 37 = 117, under the half's 124.
 */
const BADGE_POSITION = [
  'absolute right-14 top-24 z-[4]',
  'tab:right-6 tab:top-20 mob:right-4 mob:top-[70px]',
].join(' ');

export function ChoiceHalf({
  eyebrow,
  title,
  lead,
  chips,
  stats,
  cta,
  href,
  slotKey,
  brief,
  media,
  variant,
  badge,
  headingId,
}: ChoiceHalfProps) {
  const umrah = variant === 'umrah';

  return (
    <a
      href={href}
      aria-labelledby={headingId}
      className={[
        'group relative flex min-w-0 flex-1 flex-col justify-end overflow-hidden no-underline',
        'transition-[flex-grow] duration-choiceExpand ease-expand',
        'hover:grow-[1.45] focus-within:grow-[1.45]',
        /*
          The top band is reserved, not hoped for.

          The content is bottom-anchored, so it grows upwards, and the two things above it — the
          nav island and the Umrah seat badge — are positioned from the top. Nothing connected
          the two, so on a short window the headline simply grew into them: the eyebrow ended up
          behind the island and the first line of «Умра с туркменской группой» was cut off by
          the edge of the screen. Padding here is what the growing content stops against, and
          `BADGE_TOP` below is written against this number rather than beside it.

          150px is the arithmetic in `BADGE_POSITION` above: island to 88, badge to 133, then
          clearance. 124 below the tablet breakpoint, where the halves stack and the badge — at
          80 plus its own 37 — is the only thing left to clear.
        */
        'pt-[150px] tab:pt-[124px] mob:pt-[112px]',
        // Below the tablet breakpoint the two halves stack and neither expands: there is no
        // pointer to expand them with, and a 45vh panel that grows to 65vh just hides the other.
        'tab:min-h-[50vh] tab:!grow',
        umrah ? 'border-l border-l-tint-line tab:border-l-0 tab:border-t' : '',
      ].join(' ')}
    >
      <div className="absolute inset-0 z-0">
        <ImageSlot
          slotKey={slotKey}
          brief={brief}
          media={
            media === null
              ? null
              : {
                  src: media.url,
                  alt: media.alt,
                  ...(media.lqip === null ? {} : { lqip: media.lqip }),
                  ...(media.width === null ? {} : { width: media.width }),
                  ...(media.height === null ? {} : { height: media.height }),
                }
          }
          // Both halves are above the fold on every screen this page has, so neither waits.
          priority
          className="size-full"
        />
      </div>

      {/*
        The scrim. The two halves darken from different bases — cooler on the Umrah side — and
        the Umrah one is shifted six pixels up. Both gradients are built in `tokens.ts` from
        four shared stops, so the difference is one line there instead of two hundred characters
        of `linear-gradient` in a className that no test can read.
      */}
      <div
        aria-hidden="true"
        className={
          umrah
            ? 'pointer-events-none absolute inset-x-0 -top-1.5 bottom-0 z-[1] bg-scrim-choice-umrah'
            : 'pointer-events-none absolute inset-0 z-[1] bg-scrim-choice-global'
        }
      />

      {/*
        The «01» / «02» numerals used to sit here.

        Restored under D-1 because the README described them and the export had dropped them,
        which read as a truncated file rather than a design change. The owner has since asked
        for them gone, and that is their call to make: the numerals were a guess about intent
        and the person whose brand it is has stated the intent. See D-128.
      */}
      {/*
        The badge is placed here, not by itself.

        It used to carry `absolute right-[70px] top-[118px]` in its own file, which meant the
        offset that has to clear the nav and the padding that has to clear the offset lived two
        components apart with nothing relating them. They drifted, and the result was the seat
        pill sitting on top of the headline. Now the pill is a pill and this is the only file
        that has an opinion about where it goes.
      */}
      {badge === undefined ? null : <div className={BADGE_POSITION}>{badge}</div>}

      {/*
        The text column is sized to the narrow state, not to the half.

        The halves are 50/50 at rest and 59/41 while one is hovered, and until this was fixed the
        copy inside was simply `width: auto` — so every expansion re-wrapped it. The headline went
        from three lines to two and back, the paragraph reflowed under it, and the whole block
        grew and shrank on every pass of the cursor. That is what the owner saw and called the
        text distorting; it is not a font-size change, it is line breaking.

        41vw is the width a half has while the *other* one is open, which is the narrowest this
        column ever has to fit into. Pinning it there means the line breaks are decided once and
        never revisited: expanding a half now widens the photograph beside the text rather than
        the text. Below the tablet breakpoint the halves stack and neither expands, so the column
        goes back to filling what it is given.

        The side padding is 56px rather than the mockup's 70. `box-sizing: border-box` puts that
        padding *inside* the 41vw, so on a 1366 laptop 70+70 left 419px of line — which is why
        the headline broke into three lines and the three Umrah figures wrapped onto two rows.
        28px back is 28px of line length at the one width where the design is tightest, and it
        is the difference between two lines and three on both halves.
      */}
      <div
        className={[
          'relative z-[3] px-14 pb-16 lap:px-11 lap:pb-12 tab:px-8 tab:pb-10 mob:px-5 mob:pb-8',
          // 41vw, not 41vw minus the padding: `box-sizing: border-box` is on everything, so the
          // padding is already inside this number.
          'w-[41vw] tab:w-full',
          'motion-safe:animate-fade-up',
          umrah ? 'motion-safe:[animation-delay:120ms]' : '',
        ].join(' ')}
      >
        <div className="mb-6 flex items-center gap-[13px]">
          <span aria-hidden="true" className="h-px w-[38px] bg-accent" />
          <span className="text-[11px] font-black uppercase tracking-[.3em] text-accent">
            {eyebrow}
          </span>
        </div>

        {/*
          No `lap:` override any more. It was a flat 52px, and a flat number is exactly what
          cannot work here: at 1279x900 there is room for more and at 1279x680 there is room
          for less. `--c-hero-size` now reads `min(4.5vw, 7.2vh)`, which answers both. Below
          the tablet breakpoint the halves stack and the page scrolls, so height stops being
          the binding axis and the size goes back to width alone.
        */}
        <h2
          id={headingId}
          className="max-w-[600px] text-hero font-medium text-dark-on tab:text-[clamp(30px,5.4vw,46px)] mob:text-[34px]"
        >
          {title}
        </h2>

        <p className="mt-5 max-w-[450px] text-[16px] font-light leading-[1.6] text-cream-body mob:text-[15px]">
          {lead}
        </p>

        <ul className="mt-6 flex list-none flex-wrap gap-2 p-0">
          {chips.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-line-chip bg-cream-fill px-3 py-1.5 text-[12px] font-medium text-cream-soft"
            >
              {chip}
            </li>
          ))}
        </ul>

        {/*
          Separate row and column gaps, and a smaller label.

          One `gap-[34px]` set the space between the figures and the space between rows to the
          same 34px, so the moment three Umrah figures did not fit on one line the block grew by
          124px — on the half that was already the taller of the two. At 10px and .12em the
          three labels measure about 318px against 447px of column, so they fit on one row at
          every width the split layout is used at, and the row gap only matters on a phone.
        */}
        <div className="my-7 flex flex-wrap gap-x-8 gap-y-5 mob:gap-x-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-[5px]">
              <span className="text-[26px] font-medium leading-none text-accent mob:text-[23px]">
                {stat.value}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[.12em] text-cream-faint">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/*
          Not a `<button>` and not a nested `<a>`: the whole half is already the link, and a
          control inside a link is both invalid and a second tab stop to the same destination.
          It is styled as the call to action and announced as part of the link it sits in.
        */}
        <span
          className={[
            'inline-flex items-center rounded-full text-[13px] font-black uppercase tracking-[.14em]',
            'gap-3.5 transition-all duration-colour group-hover:gap-[22px]',
            umrah
              ? 'border border-tint-edge bg-cream-fill-strong px-[31px] py-[17px] text-cream-soft group-hover:bg-accent group-hover:text-accent-on'
              : 'bg-accent px-8 py-[18px] text-accent-on group-hover:bg-dark-on',
          ].join(' ')}
        >
          {cta}
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </a>
  );
}
