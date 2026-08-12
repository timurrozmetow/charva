import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ImageSlot } from './ImageSlot';
import { buildSrcSet, IMAGE_WIDTHS, Img } from './Img';

describe('buildSrcSet', () => {
  it('points at the resize endpoint for a stored upload', () => {
    const set = buildSrcSet('https://api.charva-travel.com/uploads/2026/07/abc123.webp');
    expect(set).toContain('https://api.charva-travel.com/img/2026/07/abc123.webp?w=640 640w');
    expect(set?.split(', ')).toHaveLength(IMAGE_WIDTHS.length);
  });

  it('works for a root-relative path too', () => {
    expect(buildSrcSet('/uploads/2026/07/abc.jpg')).toContain('/img/2026/07/abc.jpg?w=320 320w');
  });

  it('declines anything the endpoint will not resize', () => {
    // The API accepts a fixed set of widths and formats; asking it for an SVG or a URL it does
    // not serve produces a page full of 404s instead of a page full of photographs.
    expect(buildSrcSet('/uploads/2026/07/logo.svg')).toBeUndefined();
    expect(buildSrcSet('https://youtube.com/thumb.jpg')).toBeUndefined();
  });
});

describe('Img', () => {
  it('lazy-loads and reserves its space', () => {
    render(<Img src="/uploads/a.webp" alt="Кратер Дарваза" width={1600} height={900} />);

    const img = screen.getByAltText('Кратер Дарваза');
    expect(img).toHaveAttribute('loading', 'lazy');
    // Both dimensions, or the page jumps as each photograph arrives.
    expect(img).toHaveAttribute('width', '1600');
    expect(img).toHaveAttribute('height', '900');
  });

  it('loads the hero eagerly and without a fade', () => {
    // Fading in the largest element on the page is how a Largest Contentful Paint score is lost.
    render(<Img src="/uploads/hero.webp" alt="Герой" priority />);

    const img = screen.getByAltText('Герой');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).not.toHaveClass('opacity-0');
  });

  it('becomes visible even when the image fails', () => {
    // Otherwise a broken photograph sits at zero opacity and its alternative text with it.
    render(<Img src="/uploads/gone.webp" alt="Подпись" />);

    const img = screen.getByAltText('Подпись');
    expect(img).toHaveClass('opacity-0');
    // Through `fireEvent`, so React's synthetic handler runs inside `act`.
    fireEvent.error(img);
    expect(screen.getByAltText('Подпись')).not.toHaveClass('opacity-0');
  });

  it('positions on the subject when the media says where it is', () => {
    render(<Img src="/uploads/a.webp" alt="Портрет" focalX={0.25} focalY={0.1} />);
    expect(screen.getByAltText('Портрет')).toHaveStyle({ objectPosition: '25% 10%' });
  });
});

describe('ImageSlot', () => {
  const BRIEF = 'Газовый кратер Дарваза ночью — широкий кадр 21:9';

  it('renders the photograph once there is one', () => {
    render(
      <ImageSlot
        slotKey="g-hero-1"
        brief={BRIEF}
        media={{ src: '/uploads/darvaza.webp', alt: 'Кратер Дарваза ночью' }}
        ratio="21/9"
      />,
    );
    expect(screen.getByAltText('Кратер Дарваза ночью')).toBeInTheDocument();
  });

  it('holds the space, named, while there is not', () => {
    // 151 of these, and the project has to be buildable and demonstrable before any of them
    // are filled. The key is what ties the rectangle to its row in `content_slots`.
    const { container } = render(<ImageSlot slotKey="g-hero-1" brief={BRIEF} ratio="21/9" />);

    const slot = container.querySelector('[data-slot="g-hero-1"]');
    expect(slot).toBeInTheDocument();
    expect(slot).toHaveStyle({ aspectRatio: '21/9' });
    expect(slot).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps the Russian art direction out of a Turkmen page by default', () => {
    const { rerender } = render(<ImageSlot slotKey="u-pack" brief={BRIEF} />);
    expect(screen.queryByText(BRIEF)).not.toBeInTheDocument();

    rerender(<ImageSlot slotKey="u-pack" brief={BRIEF} showBrief />);
    expect(screen.getByText(BRIEF)).toBeInTheDocument();
  });

  it('shows the size the photographer needs to deliver', () => {
    render(
      <ImageSlot
        slotKey="g-hero-1"
        brief={BRIEF}
        showBrief
        recommended={{ width: 2560, height: 1100 }}
      />,
    );
    expect(screen.getByText('2560×1100')).toBeInTheDocument();
  });
});
