import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Reveal } from './Reveal';

/**
 * The one thing that must never happen is a section nobody can read.
 *
 * `Reveal` hides its content and waits for an `IntersectionObserver` to put it back, which is
 * the standard way this pattern is written and the standard way it goes wrong: anything that
 * stops the observer arriving leaves a page of invisible text. So the tests below are mostly
 * about the paths where it must *not* hide — no observer, reduced motion, already on screen —
 * rather than about the animation, which is two CSS properties and needs no test.
 */

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

let callbacks: ObserverCallback[] = [];
const originalObserver = globalThis.IntersectionObserver;

function installObserver(): void {
  callbacks = [];
  globalThis.IntersectionObserver = class {
    constructor(callback: ObserverCallback) {
      callbacks.push(callback);
    }
    observe(): void {
      /* the test drives the callback by hand */
    }
    disconnect(): void {
      /* nothing to release */
    }
    unobserve(): void {
      /* nothing to release */
    }
  } as unknown as typeof IntersectionObserver;
}

/** jsdom reports every rect as zero, so «below the fold» has to be stated. */
function placeBelowTheFold(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 2000,
    bottom: 2400,
    left: 0,
    right: 0,
    width: 0,
    height: 400,
    x: 0,
    y: 2000,
    toJSON: () => ({}),
  });
}

function setReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  setReducedMotion(false);
  window.innerHeight = 800;
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.IntersectionObserver = originalObserver;
});

describe('Reveal', () => {
  it('shows its content when there is no IntersectionObserver', () => {
    // @ts-expect-error — deleting it is the whole point of the test.
    delete globalThis.IntersectionObserver;
    placeBelowTheFold();

    render(<Reveal>Каракумы</Reveal>);

    // Never hidden rather than hidden-and-restored: there would be nothing to restore it.
    expect(screen.getByText('Каракумы').getAttribute('data-reveal')).toBe('shown');
  });

  it('shows its content when the reader asked for less motion', () => {
    installObserver();
    placeBelowTheFold();
    setReducedMotion(true);

    render(<Reveal>Каракумы</Reveal>);

    expect(screen.getByText('Каракумы').getAttribute('data-reveal')).toBe('shown');
    // And it does not even watch: there is nothing to wait for.
    expect(callbacks).toHaveLength(0);
  });

  it('leaves alone what is already on screen', () => {
    installObserver();
    // No `placeBelowTheFold`: jsdom's zero rect is top 0, which is on screen.

    render(<Reveal>Каракумы</Reveal>);

    expect(screen.getByText('Каракумы').getAttribute('data-reveal')).toBe('shown');
    expect(callbacks).toHaveLength(0);
  });

  it('hides what is below the fold and shows it when it arrives', () => {
    installObserver();
    placeBelowTheFold();

    render(<Reveal>Каракумы</Reveal>);
    const element = screen.getByText('Каракумы');
    expect(element.getAttribute('data-reveal')).toBe('pending');

    act(() => {
      callbacks[0]?.([{ isIntersecting: true }]);
    });
    expect(element.getAttribute('data-reveal')).toBe('shown');
  });

  it('staggers by position, and only once it is arriving', () => {
    installObserver();
    placeBelowTheFold();

    render(
      <Reveal index={2} data-testid="third">
        Каракумы
      </Reveal>,
    );
    const element = screen.getByText('Каракумы');

    // No delay while hidden: a staggered disappearance is a delay nobody sees, and it would
    // hold the element at full opacity for a moment before it drops.
    expect(element.style.transitionDelay).toBe('');

    act(() => {
      callbacks[0]?.([{ isIntersecting: true }]);
    });
    expect(element.style.transitionDelay).toBe('120ms');
  });

  it('caps the stagger so the end of a long row is not left behind', () => {
    installObserver();
    placeBelowTheFold();

    render(<Reveal index={40}>Каракумы</Reveal>);
    act(() => {
      callbacks[0]?.([{ isIntersecting: true }]);
    });

    // Five steps of sixty, whatever the index: a fortieth card at 2.4 seconds would arrive
    // long after the reader had scrolled past the row it belongs to.
    expect(screen.getByText('Каракумы').style.transitionDelay).toBe('300ms');
  });
});
