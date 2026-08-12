import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Carousel, type CarouselLabels } from './Carousel';

const LABELS: CarouselLabels = {
  region: 'Слайдер главной страницы',
  slide: (index, total) => `Слайд ${String(index)} из ${String(total)}`,
  goTo: (index, label) =>
    `Перейти к слайду ${String(index)}${label === undefined ? '' : `, ${label}`}`,
  pause: 'Остановить',
  play: 'Продолжить',
};

const SLIDES = [
  { id: 'darvaza', label: 'Дарваза', content: <p>Кратер Дарваза</p> },
  { id: 'yangykala', label: 'Йангыкала', content: <p>Каньон Йангыкала</p> },
  { id: 'merv', label: 'Мерв', content: <p>Древний Мерв</p> },
];

/** jsdom has no `matchMedia`; the reduced-motion hook asks for it on mount. */
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

function showing(): string {
  return screen.getByRole('group', { name: /Слайд/ }).textContent;
}

describe('Carousel', () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('announces itself as a carousel with named slides', () => {
    render(<Carousel slides={SLIDES} labels={LABELS} />);

    const region = screen.getByRole('region', { name: 'Слайдер главной страницы' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getByRole('group', { name: 'Слайд 1 из 3' })).toHaveAttribute(
      'aria-roledescription',
      'slide',
    );
  });

  it('keeps the slides that are not showing out of reach', () => {
    // Transparent-but-present is the usual mistake: a keyboard user tabs into a slide that
    // nobody can see. `visibility: hidden` takes it out of the tab order and the a11y tree.
    render(<Carousel slides={SLIDES} labels={LABELS} />);
    expect(screen.getAllByRole('group', { name: /Слайд/ })).toHaveLength(1);
    expect(showing()).toBe('Кратер Дарваза');
  });

  it('advances on its own', () => {
    vi.useFakeTimers();
    try {
      render(<Carousel slides={SLIDES} labels={LABELS} intervalMs={5000} />);
      expect(showing()).toBe('Кратер Дарваза');

      act(() => {
        vi.advanceTimersByTime(5001);
      });
      expect(showing()).toBe('Каньон Йангыкала');
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts the clock when a slide is chosen by hand', () => {
    // The defect this component exists to fix: the prototypes leave the interval running, so
    // the slide the visitor just picked can be replaced a fraction of a second later.
    vi.useFakeTimers();
    try {
      render(<Carousel slides={SLIDES} labels={LABELS} intervalMs={5000} />);

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      act(() => {
        screen.getByRole('button', { name: 'Перейти к слайду 3, Мерв' }).click();
      });
      expect(showing()).toBe('Древний Мерв');

      // A further 4 seconds is 8 in total. With the prototype's interval the slide would have
      // moved on at 5; here the clock restarted at the click, so it has not.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(showing()).toBe('Древний Мерв');

      act(() => {
        vi.advanceTimersByTime(1001);
      });
      expect(showing()).toBe('Кратер Дарваза');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not move while the pointer is over it', async () => {
    const user = userEvent.setup();
    render(<Carousel slides={SLIDES} labels={LABELS} intervalMs={50} />);

    await user.hover(screen.getByRole('region'));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(showing()).toBe('Кратер Дарваза');
  });

  it('does not move while something inside it has focus', async () => {
    const user = userEvent.setup();
    render(<Carousel slides={SLIDES} labels={LABELS} intervalMs={50} />);

    await user.tab();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(showing()).toBe('Кратер Дарваза');
  });

  it('stands still entirely when less motion is asked for', () => {
    // Suppressing the transition without stopping the timer is worse than doing nothing: the
    // slide then changes instantly instead of fading.
    stubMatchMedia(true);
    vi.useFakeTimers();
    try {
      render(<Carousel slides={SLIDES} labels={LABELS} intervalMs={1000} />);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(showing()).toBe('Кратер Дарваза');
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers a way to stop it, which the design does not', async () => {
    // WCAG 2.2.2. Both sliders in the handoff run indefinitely with no control at all.
    const user = userEvent.setup();
    render(<Carousel slides={SLIDES} labels={LABELS} intervalMs={50} />);

    await user.click(screen.getByRole('button', { name: 'Остановить' }));
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(showing()).toBe('Кратер Дарваза');
  });

  it('marks the indicator of the slide being shown', async () => {
    const user = userEvent.setup();
    render(<Carousel slides={SLIDES} labels={LABELS} />);

    expect(screen.getByRole('button', { name: /слайду 1/ })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /слайду 2/ }));
    expect(screen.getByRole('button', { name: /слайду 2/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('shows no indicators for a single slide and nothing at all for none', () => {
    const { rerender } = render(<Carousel slides={[SLIDES[0]!]} labels={LABELS} />);
    expect(screen.queryByRole('button', { name: /слайду/ })).not.toBeInTheDocument();

    rerender(<Carousel slides={[]} labels={LABELS} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
