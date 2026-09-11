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
  slide: (index: number, total: number) => string;
  /** Accessible name of an indicator — «Перейти к слайду 2, Йангыкала». */
  goTo: (index: number, label?: string) => string;
  pause: string;
  play: string;
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
      /*
       * `isolate` — a stacking context, so the slides' z-indexes stay inside this component.
       *
       * Not decoration. The slides carry `z-[1]` and `z-[2]` so the arriving one can fade over
       * the one it replaces instead of cross-fading through to the page behind. Neither this
       * element, nor the wrapper both homepages put it in, nor the `<section>` around that
       * establishes a context on its own — `position: relative` with `z-index: auto` does not —
       * so those numbers escaped and competed with the hero's text column, which is `relative`
       * with no z-index of its own. A positive z-index paints above `auto` whatever the document
       * order, so the photograph covered the headline, the paragraph and the search bar on both
       * homepages. The owner saw the text appear for a moment and then vanish, which is exactly
       * what it looks like: the copy renders before the slides arrive, and is buried when they do.
       *
       * One word here rather than a z-index on every caller: a component that introduces
       * layering is the thing responsible for containing it.
       */
      className={cn('relative isolate', className)}
    >
      <>
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
              {slide.content}
            </div>
          );
        })}

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
      </>
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
        rail
          ? 'right-gutter top-1/2 -translate-y-1/2 flex-col gap-[14px] lap:right-10 tab:right-8 mob:hidden'
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
              'group flex items-center gap-3 transition-colors duration-caret',
              rail && 'justify-end',
            )}
          >
            {rail && slide.label !== undefined && (
              <span
                aria-hidden="true"
                className={cn(
                  'font-bold uppercase text-label tracking-[0.14em] transition-opacity duration-caret',
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
          'grid h-8 w-8 place-items-center rounded-full border border-line text-dark-on',
          'transition-colors duration-colour hover:bg-line-soft',
          rail ? 'mt-2 self-end' : 'ml-2',
        )}
      >
        <Icon name={running ? 'pause' : 'play'} size={12} />
      </button>
    </div>
  );
}
