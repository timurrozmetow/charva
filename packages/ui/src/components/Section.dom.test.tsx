import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Section } from './Section';

/**
 * Vertical rhythm, and the one gap it used to leave to whoever noticed.
 *
 * A light section takes padding at the top only, because sections stack and the next one's top
 * padding is the gap — two that each claimed both edges would sit 200px apart. That holds right
 * up until the next section paints, because a painted section starts painting at its first
 * pixel: the cards, list or heading above it end flush against the colour.
 *
 * Four pages had found this and each had patched it differently — two with `mt-16` on the band,
 * one with `pb-16` on the block above, and the homepage not at all, which is what the owner was
 * looking at. It belongs in the component that owns the rhythm.
 */

function classesOf(markup: React.ReactElement): string {
  const { container } = render(markup);
  return container.querySelector('section')?.className ?? '';
}

describe('the gap above a painted band', () => {
  it('is kept by the band itself, so no page has to remember it', () => {
    expect(
      classesOf(
        <Section tone="dark" space="md">
          x
        </Section>,
      ),
    ).toContain('mt-16');
  });

  it('steps down with the rest of the rhythm on narrow screens', () => {
    const classes = classesOf(
      <Section tone="dark" space="md">
        x
      </Section>,
    );
    expect(classes).toContain('tab:mt-12');
    expect(classes).toContain('mob:mt-10');
  });

  it('is not taken by a light section, which would double the gap between two of them', () => {
    expect(classesOf(<Section space="md">x</Section>)).not.toContain('mt-16');
  });

  it('is not taken by a band that asked for no rhythm at all', () => {
    /*
     * `space="none"` is the opt-out, and it already means the right thing everywhere it is used:
     * the dark heroes on `/video` and `/maksatnama` open their page, and the statistics strip on
     * the Umrah homepage is deliberately flush and 34px tall. All three set their own padding.
     */
    expect(
      classesOf(
        <Section tone="dark" space="none">
          x
        </Section>,
      ),
    ).not.toContain('mt-');
  });
});

describe('what a painted section owns', () => {
  it('paints both its edges, unlike a light one', () => {
    // The rule that made the gap above go missing in the first place, kept honest here so that
    // nobody fixes this file by giving light sections bottom padding.
    expect(
      classesOf(
        <Section tone="dark" space="md">
          x
        </Section>,
      ),
    ).toContain('pb-section');
    expect(classesOf(<Section space="md">x</Section>)).not.toContain('pb-section');
  });

  it('marks itself as a dark surface rather than colouring its children', () => {
    const { container } = render(
      <Section tone="dark" space="md">
        x
      </Section>,
    );
    // Decision D-97: the attribute re-points the theme variables, so nothing inside is told.
    expect(container.querySelector('section')?.dataset['surface']).toBe('dark');
  });
});
