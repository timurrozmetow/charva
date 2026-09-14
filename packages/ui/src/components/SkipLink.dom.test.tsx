import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkipLink } from './SkipLink';

/**
 * The link that was never written for the target that was always there.
 *
 * `Layout` has carried `<main id="content">` since it was built, with a comment calling the id
 * «the skip link's target». Nothing pointed at it, so every keyboard user tabbed through seven
 * menu entries, a language switcher and a call to action on every page of the site.
 */
describe('SkipLink', () => {
  it('points at the target and is the first thing focus reaches', () => {
    render(
      <>
        <SkipLink targetId="content">Перейти к содержимому</SkipLink>
        <a href="/ru/tours">Туры</a>
      </>,
    );

    const link = screen.getByRole('link', { name: 'Перейти к содержимому' });
    expect(link).toHaveAttribute('href', '#content');

    // First in document order, which is what puts it first in the tab order.
    expect(screen.getAllByRole('link')[0]).toBe(link);
  });

  it('is off-screen rather than hidden, and returns on focus', () => {
    // `sr-only` would serve a screen reader and abandon the sighted keyboard user, who is the
    // person most likely to need it. So it is moved out of view and comes back when focused.
    render(<SkipLink targetId="content">Перейти к содержимому</SkipLink>);

    const link = screen.getByRole('link');
    expect(link.className).toContain('-translate-y-full');
    expect(link.className).toContain('focus-visible:translate-y-0');
    expect(link.className).not.toContain('sr-only');
  });
});
