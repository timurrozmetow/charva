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
      {badge}

      <div
        className={[
          'relative z-[3] px-[70px] pb-[76px] lap:px-12 lap:pb-14 tab:px-8 tab:pb-10 mob:px-5 mob:pb-8',
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

        <h2
          id={headingId}
          className="max-w-[600px] text-hero font-medium text-dark-on lap:text-[52px] mob:text-[38px]"
        >
          {title}
        </h2>

        <p className="mt-6 max-w-[450px] text-[17px] font-light leading-[1.68] text-cream-body mob:text-[15px]">
          {lead}
        </p>

        <ul className="mt-7 flex list-none flex-wrap gap-2 p-0">
          {chips.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-line-chip bg-cream-fill px-3.5 py-1.5 text-[12px] font-medium text-cream-soft"
            >
              {chip}
            </li>
          ))}
        </ul>

        <div className="my-8 flex flex-wrap gap-[34px] mob:gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-[5px]">
              <span className="text-[29px] font-medium leading-none text-accent mob:text-[24px]">
                {stat.value}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[.16em] text-cream-faint">
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
