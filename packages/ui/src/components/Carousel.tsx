import { fill } from '@charva/contracts';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../cn';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { interval as intervalToken } from '../tokens';

import { Icon } from './Icon';

export interface CarouselSlide {
  id: string;
  /** Shown beside the indicator on the vertical rail — «Дарваза», «Йангыкала». */
  label?: string;
  content: ReactNode;
}

export interface CarouselLabels {
  /** Names the carousel as a whole — «Слайдер главной страницы». */
  region: string;
  /** «Слайд 2 из 4». Built by the caller: the word order differs across four languages. */
  slide: (number: number, total: number) => string;
  /** Accessible name of an indicator — «Перейти к слайду 2, Йангыкала». */
  goTo: (number: number, label?: string) => string;
  pause: string;
  play: string;
}

/*
 * Both callbacks take the *one-based* position, and the parameter is named `number` because it
 * was named `index` and both homepages read that the way the word is normally used.
 *
 * They each added a `+ 1` on top of the one this component already applies, so the first slide
 * announced itself as «Слайд 2 из 4» and the last as «Слайд 5 из 4» — a number past the total,
 * on both sites, to every screen reader. Nothing caught it: the unit test and the Storybook
 * story happen to use the argument as given, so the component was right and only its two real
 * consumers were wrong. A name that invites one reading and means the other is the defect; the
 * `+ 1` was the symptom.
 */

/** The five strings each site's copy already holds for its slider, under `home`. */
export interface CarouselCopy {
  /** «Слайдер главной страницы» */
  sliderLabel: string;
  /** «Слайд {index} из {total}» */
  slide: string;
  /** «Перейти к слайду {index}» — the place name is appended by the builder below. */
  goToSlide: string;
  pause: string;
  play: string;
}

/*
 * One builder for both homepages, for the reason recorded as D-155 about the footer: the same
 * eight lines written twice is two chances for one of them to be wrong, and here both copies
 * were wrong in the same way. The caller no longer does arithmetic on the position at all, so
 * the mistake has nowhere left to live, and the numbering is tested once instead of never.
 *
 * The key inside the templates stays `{index}` because that is what the translators have already
 * written in eight JSON files across two sites; it is the parameter of this function that had to
 * stop inviting the wrong reading.
 */
export function carouselLabels(copy: CarouselCopy): CarouselLabels {
  return {
    region: copy.sliderLabel,
    slide: (number, total) => fill(copy.slide, { index: number, total }),
    goTo: (number, label) =>
      `${fill(copy.goToSlide, { index: number })}${label === undefined ? '' : `, ${label}`}`,
    pause: copy.pause,
    play: copy.play,
  };
}

export type CarouselIndicators = 'rail' | 'dots' | 'none';

export interface CarouselProps {
  slides: readonly CarouselSlide[];
  labels: CarouselLabels;
  /** 6500 for the two heroes, 5000 for the Umrah package slider. */
  intervalMs?: number;
  /** 1200 for the heroes, 1000 for the package slider. */
  transitionMs?: number;
  /** Vertical rail on the right for Global, horizontal bars underneath for Umrah. */
  indicators?: CarouselIndicators;
  className?: string;
  indicatorsClassName?: string;
}

/**
 * One carousel for all four sliders in the design.
 *
 * The prototypes implement this four times, and every copy has the same three problems.
 *
 * The timer never resets. Clicking an indicator changes the slide but leaves the interval
 * running, so the slide the visitor deliberately chose can be replaced a hundred milliseconds
 * later. Here the timer is a `setTimeout` keyed on the current index, so any change — manual
 * or automatic — starts the clock again from that moment. That is not a workaround; it is what
 * "the interval is measured from the last change" actually means.
 *
 * It never stops. Not on hover, not on focus, not when the tab is in the background, and not
 * under `prefers-reduced-motion` — where suppressing the transition, as the stylesheet does,
 * only makes it worse: the slide then changes instantly rather than fading.
 *
 * And there is no way to stop it at all. WCAG 2.2.2 requires a mechanism for anything that
 * starts moving on its own and runs for more than five seconds; both of these run forever. The
 * pause control is the one piece of visible interface here that the design does not contain.
 *
 * Slides that are not showing are `invisible` rather than unmounted or merely transparent.
 * Transparent leaves their links in the tab order, so a keyboard user tabs into a slide nobody
 * can see; unmounting makes the cross-fade impossible. `visibility: hidden` does both jobs —
 * out of the tab order, out of the accessibility tree, still able to fade.
 */
export function Carousel({
  slides,
  labels,
  intervalMs = intervalToken.hero,
  transitionMs = 1200,
  indicators = 'rail',
  className,
  indicatorsClassName,
}: CarouselProps) {
  const [index, setIndex] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const base = useId();

  const total = slides.length;
  const running = total > 1 && !interacting && !stopped && !reducedMotion;

  /*
   * The slide being left, held opaque underneath until the new one has finished arriving.
   *
   * A cross-fade dips. Both slides were transitioning opacity at once, so halfway through each
   * was at 0.5 and the pair covered 1 - 0.5x0.5 = 75% of what is behind them — the cream page.
   * Every six and a half seconds the homepage photograph washed a quarter of the way to the
   * background colour and back, on the largest element either site has.
   *
   * Fading only the incoming slide, over an outgoing one that stays fully opaque, is a fade
   * rather than a cross-fade and covers everything at every instant. It costs this one piece of
   * state: something has to know when the arrival is over so the slide underneath can be taken
   * out of the page again.
   */
  const [leaving, setLeaving] = useState<number | null>(null);
  const shown = useRef(index);

  /*
   * The highest slide whose content has been put in the page. Everything past it is an empty
   * shell until the carousel gets near it.
   *
   * Measured on the live homepage, throttled to slow 4G on a 412px phone: the page pulled 406 KB
   * of photographs and 255 KB of that — 63% — was slides 2, 3 and 4, which appear at 6.5, 13 and
   * 19.5 seconds. They were downloading in the same seconds as the one the visitor is actually
   * looking at, on the connection this audience has, and competing with it for the bandwidth.
   *
   * This is not D-36 revisited. That decision is about a slide that is *in rotation*: hidden with
   * `visibility` rather than unmounted, because unmounting makes the cross-fade impossible and
   * transparency leaves its links in the tab order. Both still hold — a slide once reached stays
   * mounted forever, so every fade has both halves. What changes is only the slides nobody has
   * been near yet, which have no fade to take part in.
   */
  const [reached, setReached] = useState(0);

  /*
   * The slide being shown is mounted at once — including the case nobody plans for, where the
   * visitor presses the last indicator before the carousel has ever advanced. It comes up empty
   * for as long as its photograph takes, and that is what the held slide underneath is for: the
   * one being left stays fully opaque until the fade is over (see `leaving`).
   */
  useEffect(() => {
    setReached((current) => Math.max(current, index));
  }, [index]);

  /*
   * Its neighbour waits for the page to go quiet.
   *
   * It has `intervalMs` — six and a half seconds on both heroes — to arrive before it is needed,
   * so there is no reason for it to compete with the LCP photograph, the stylesheet and the
   * bundle, which is exactly what all four slides were doing. `requestIdleCallback` is missing in
   * Safari before 16.4; the timeout is the fallback for it rather than a second call, and either
   * way `setReached` only ever raises the number, so arriving twice costs nothing.
   */
  useEffect(() => {
    if (total < 2) return;

    const advance = () => {
      setReached((current) => Math.max(current, index + 1));
    };

    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(advance, { timeout: 2000 });
      return () => {
        cancelIdleCallback(handle);
      };
    }

    const timer = setTimeout(advance, 1200);
    return () => {
      clearTimeout(timer);
    };
  }, [index, total]);

  useEffect(() => {
    if (shown.current === index) return;

    setLeaving(shown.current);
    shown.current = index;

    const timer = setTimeout(() => {
      setLeaving(null);
    }, transitionMs);

    return () => {
      clearTimeout(timer);
    };
  }, [index, transitionMs]);

  useEffect(() => {
    if (!running) return;

    // A timeout rather than an interval, keyed on `index`: every change to the slide — a click
    // on an indicator included — tears this down and starts a fresh one. That is the whole fix
    // for the prototype advancing out from under a deliberate choice.
    const timer = setTimeout(() => {
      setIndex((current) => (current + 1) % total);
    }, intervalMs);

    return () => {
      clearTimeout(timer);
    };
  }, [running, index, intervalMs, total]);

  // The tab going into the background is the same case as a hover: nobody is looking.
  useEffect(() => {
    const onVisibility = () => {
      setInteracting(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (total === 0) return null;

  return (
    // Pausing on hover is required carousel behaviour, not an interaction the element offers:
    // there is nothing to activate here and nothing to reach by keyboard. The rule's real
    // concern — that a pointer-only affordance has no keyboard equivalent — is answered two
    // lines down, where focus pauses it too, and by the pause button, which is a real control.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      onMouseEnter={() => {
        setInteracting(true);
      }}
      onMouseLeave={() => {
        setInteracting(false);
      }}
      // Focus counts as interaction too: someone tabbing through a slide's links must not have
      // it swapped out mid-sentence.
      onFocusCapture={() => {
        setInteracting(true);
      }}
      onBlurCapture={() => {
        setInteracting(false);
      }}
      className={cn('relative', className)}
    >
      {/*
        The slides get a stacking context of their own; the controls stay outside it.

        They carry `z-[1]` and `z-[2]` so the arriving slide can fade *over* the one it replaces
        rather than both fading through to the page behind. Nothing around them establishes a
        context — `position: relative` with `z-index: auto` does not, and that is all the root
        below, the wrapper the homepages put it in, and the `<section>` around that have — so
        those numbers escaped and were measured against the hero's text column. A positive
        z-index paints above `auto` whatever the document order, and the photograph buried the
        headline, the paragraph and the search bar on both homepages.

        The first fix put `isolate` on the root, which trapped the indicators' `z-[4]` with it.
        That number was never decoration either: the hero lays a full-height `<Container>` over
        the carousel, later in document order, and the rail only ever reached the pointer by
        sitting above it. Trapped, the rail went under a transparent element that swallowed
        every click — the text came back and the slider stopped responding.

        So the boundary belongs here rather than around everything: this is the layer that has
        internal ordering to contain. The controls keep the one thing they need, which is to be
        above whatever the page lays on top of the photograph.
      */}
      <div className="absolute inset-0 isolate">
        {slides.map((slide, position) => {
          const showing = position === index;
          // Still painted, but only as a backdrop for the one arriving over it.
          const holding = position === leaving;

          return (
            <div
              key={slide.id}
              id={`${base}-${slide.id}`}
              role="group"
              aria-roledescription="slide"
              aria-label={labels.slide(position + 1, total)}
              // `visibility: hidden` already takes a hidden slide out of the accessibility
              // tree and the tab order; this states the same thing where it can be read
              // without a stylesheet — in a test, and before CSS applies.
              aria-hidden={showing ? undefined : true}
              /*
               * The held slide is the one case where a slide is visible and must not be
               * reachable: `visibility: hidden` is doing that job for every other hidden slide,
               * and this one is deliberately still painted. Without `inert` a reader tabbing
               * during the second the fade takes could land on a link belonging to the slide
               * that just left.
               *
               * Spread and lowercase because this is React 18, which drops `inert` written as a
               * camel-cased prop with a warning and passes unknown lowercase attributes
               * through — the same shape of problem as `fetchpriority` in D-94.
               */
              {...(holding ? ({ inert: '' } as Record<string, string>) : {})}
              style={{ transitionDuration: `${String(transitionMs)}ms` }}
              className={cn(
                'absolute inset-0 transition-[opacity,visibility] ease-slide',
                showing
                  ? 'visible z-[2] opacity-100'
                  : holding
                    ? 'visible z-[1] opacity-100'
                    : 'invisible z-0 opacity-0',
              )}
            >
              {/*
                The wrapper stays whatever happens: the indicator for this slide points at its
                id with `aria-controls`, and a control referring to an element that is not in the
                document is the defect D-88 was written about.
              */}
              {position <= reached ? slide.content : null}
            </div>
          );
        })}
      </div>

      {indicators !== 'none' && total > 1 && (
        <Indicators
          slides={slides}
          index={index}
          onSelect={setIndex}
          labels={labels}
          variant={indicators}
          running={running}
          stopped={stopped}
          onToggleStopped={() => {
            setStopped((current) => !current);
          }}
          className={indicatorsClassName}
          idBase={base}
        />
      )}
    </div>
  );
}

interface IndicatorsProps {
  slides: readonly CarouselSlide[];
  index: number;
  onSelect: (index: number) => void;
  labels: CarouselLabels;
  variant: Exclude<CarouselIndicators, 'none'>;
  running: boolean;
  stopped: boolean;
  onToggleStopped: () => void;
  className?: string | undefined;
  idBase: string;
}

function Indicators({
  slides,
  index,
  onSelect,
  labels,
  variant,
  running,
  stopped,
  onToggleStopped,
  className,
  idBase,
}: IndicatorsProps) {
  const rail = variant === 'rail';

  return (
    <div
      className={cn(
        'absolute z-[4] flex',
        /*
          The rail loses its words on a phone, not its controls.

          `mob:hidden` used to sit here, on the whole block — which took the pause button with
          it. Measured in a browser at 412px: five controls in the markup, none of them visible,
          on a photograph that advances by itself every six and a half seconds and never stops.
          WCAG 2.2.2 asks for a mechanism for exactly that, and D-34 records that this button is
          the one visible element in the package added on top of the drawn design to satisfy it.
          Hiding it on the devices most of this audience uses is where it was needed most.

          What genuinely does not fit at 412px is the column of uppercase place names beside the
          bars, so that is what `mob:hidden` moves to. The bars are 18 to 40px wide and sit at
          the right edge, vertically centred, where the hero's own text — bottom-aligned — is not.
        */
        rail
          ? 'right-gutter top-1/2 -translate-y-1/2 flex-col gap-[14px] lap:right-10 tab:right-8'
          : 'bottom-6 left-1/2 -translate-x-1/2 flex-row items-center gap-3',
        className,
      )}
    >
      {slides.map((slide, position) => {
        const showing = position === index;
        return (
          <button
            key={slide.id}
            type="button"
            aria-label={labels.goTo(position + 1, slide.label)}
            aria-current={showing}
            aria-controls={`${idBase}-${slide.id}`}
            onClick={() => {
              onSelect(position);
            }}
            className={cn(
              /*
                The bar is three pixels high and the label beside it eleven — together a target
                of 140×11, which is a quarter of what a finger needs. The padding makes the
                button 24 high and the negative margin gives the space back to the layout, so
                the rail looks exactly as drawn and can be hit.
              */
              'group -my-2.5 flex items-center gap-3 py-2.5 transition-colors duration-caret',
              // With the label hidden the button is only as wide as its bar, and an inactive bar
              // is 18px — under the 24×24 floor WCAG 2.5.8 sets. The extra six pixels are
              // transparent and `justify-end` keeps the bar itself flush against the edge, so
              // the rail looks exactly as drawn and can still be hit.
              rail && 'justify-end mob:min-w-6',
            )}
          >
            {rail && slide.label !== undefined && (
              <span
                aria-hidden="true"
                className={cn(
                  'font-bold uppercase text-label tracking-[0.14em] transition-opacity duration-caret',
                  // The part that does not fit on a phone. The name is still on the button's
                  // `aria-label`, so nothing is lost to a screen reader by dropping the glyphs.
                  'mob:hidden',
                  showing ? 'text-accent opacity-100' : 'text-dark-on opacity-45',
                )}
              >
                {slide.label}
              </span>
            )}
            {/*
              The colour answers the click; the bar takes its time growing.

              Both used to share `duration-indicator`, so pressing an indicator was acknowledged
              over half a second — twice the budget a dropdown gets, on a direct response to a
              press. Splitting them lets the acknowledgement be immediate while the bar keeps the
              unhurried travel that matches the 1200ms cross-fade it is reporting on.
            */}
            <span
              aria-hidden="true"
              className={cn(
                'block h-[3px] rounded-full',
                'transition-[background-color,width] [transition-duration:160ms,500ms] ease-slide',
                showing ? 'bg-accent' : 'bg-line-chip',
                rail ? (showing ? 'w-10' : 'w-[18px]') : showing ? 'w-[34px]' : 'w-[14px]',
              )}
            />
          </button>
        );
      })}

      <button
        type="button"
        onClick={onToggleStopped}
        aria-label={stopped ? labels.play : labels.pause}
        className={cn(
          // 44, not 32: WCAG 2.5.8 sets the floor at 24 and 2.5.5 asks 44, and this is a
          // control somebody reaches for on a phone while a slider is moving under their thumb.
          'grid size-11 place-items-center rounded-full border border-line text-dark-on',
          'transition-colors duration-colour hover:bg-line-soft',
          rail ? 'mt-2 self-end' : 'ml-2',
        )}
      >
        <Icon name={running ? 'pause' : 'play'} size={12} />
      </button>
    </div>
  );
}
