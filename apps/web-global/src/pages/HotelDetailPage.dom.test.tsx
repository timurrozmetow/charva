import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formToken, hotelDetail } from '../test/fixtures';
import { renderPage, stubApi } from '../test/renderPage';

import { HotelDetailPage } from './HotelDetailPage';

/**
 * One hotel.
 *
 * The room list is the whole of this file. Everything else on the page — the cover, the class
 * line, the amenities — is transcription; the rooms are the correction, because a hotel used to
 * carry one price column and therefore said «от 145 $ за ночь» for the single room and for the
 * duplex alike.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(payload: unknown = hotelDetail()) {
  stubApi({ '/global/hotels/': payload, '/forms/token': formToken() });
  return renderPage(<HotelDetailPage lang="ru" slug="yyldyz-hotel" />, {
    path: '/ru/hotels/yyldyz-hotel',
  });
}

describe('a hotel detail page', () => {
  it('lists the kinds of room with what each one holds', async () => {
    await render();

    expect(await screen.findByText('Номера')).toBeInTheDocument();
    expect(screen.getByText('Двухместный')).toBeInTheDocument();
    expect(screen.getByText('Люкс')).toBeInTheDocument();
    expect(screen.getByText(/2 мест\. · 26 м²/)).toBeInTheDocument();
    expect(screen.getByText(/2 мест\. · 74 м² · Вид на площадь\./)).toBeInTheDocument();
  });

  it('falls back to the hotel’s own rate for a room that has no price of its own', async () => {
    /*
     * `price: null` means «this hotel quotes one nightly rate», not «this room is free» — and
     * the seeds leave it null everywhere, because what a duplex costs at a particular hotel is
     * a commercial fact nobody in this repository knows. Printing a zero there would be the
     * worst of the three possible readings.
     */
    await render();

    await screen.findByText('Номера');
    // The suite carries 320 $ of its own; the double falls back to the hotel's 145 $.
    expect(screen.getByText(/320/)).toBeInTheDocument();
    expect(screen.getAllByText(/145/).length).toBeGreaterThan(0);
    // Exactly this string, not a pattern: `/0 \$/` also matches «320 $».
    expect(screen.queryByText((text) => text.trim() === 'от 0 $')).not.toBeInTheDocument();
  });

  it('says nothing at all about rooms when the hotel has none', async () => {
    // A heading over an empty list is worse than no heading: it reads as a page that failed to
    // load rather than as a hotel whose rooms nobody has entered yet.
    await render(hotelDetail({ rooms: [] }));

    expect(await screen.findByText('Удобства')).toBeInTheDocument();
    expect(screen.queryByText('Номера')).not.toBeInTheDocument();
  });
});

describe('the photographs and the facts above the fold', () => {
  const picture = (url: string) => ({
    url,
    alt: 'Отель',
    width: 1600,
    height: 1000,
    lqip: null,
    focalX: null,
    focalY: null,
  });

  it('leads with the cover and offers the rest as thumbnails', async () => {
    await render(
      hotelDetail({
        cover: picture('/api/v1/uploads/cover.webp'),
        gallery: [
          { caption: 'Ванная', media: picture('/api/v1/uploads/bath.webp') },
          { caption: 'Завтрак', media: picture('/api/v1/uploads/breakfast.webp') },
        ],
      }),
    );

    // The cover is the first thumbnail rather than a separate thing above them: treating it as
    // a different kind of picture is what made the page show it twice.
    const thumbs = await screen.findAllByRole('button', { name: /Открыть фотографию/ });
    expect(thumbs.length).toBeGreaterThan(0);
    const images = screen.getAllByRole('img');
    expect(images.some((image) => image.getAttribute('src')?.includes('cover.webp'))).toBe(true);
    expect(images.some((image) => image.getAttribute('src')?.includes('bath.webp'))).toBe(true);
  });

  it('says when a guest may arrive and when they must leave', async () => {
    // Two facts every hotel page in the world carries and this one did not, so a visitor
    // choosing between a morning flight and an evening one had to write and ask.
    await render();

    expect(await screen.findByText(/заезд с 14:00/)).toBeInTheDocument();
    expect(screen.getByText(/выезд до 12:00/)).toBeInTheDocument();
  });

  it('states the class once, not three times in four centimetres', async () => {
    /*
     * The first version put it in the line above the photographs, in the stars beside it, and
     * again in the icon row. A fact repeated is a fact the reader stops trusting the layout
     * about.
     */
    const { container } = await render();

    await screen.findByText(/заезд с 14:00/);

    // «5 ★» belongs to the line above the photographs, where it sits beside the city. The icon
    // row must not say it again — the stars beside it are already the same fact drawn.
    const factRow = container.querySelector('ul.grid-cols-5');
    expect(factRow).not.toBeNull();
    expect(factRow?.textContent).not.toContain('5 ★');
  });

  it('counts the kinds of room and the largest of them', async () => {
    await render();

    // From the rooms themselves — «2 вида номеров» is a COUNT, not a number anybody typed, and
    // the plural form follows the count rather than being «2 видов».
    expect(await screen.findByText('2 вида номеров')).toBeInTheDocument();
    // The largest room, not the sum and not the first: «до 74 м²» beside the room that is 74.
    expect(screen.getByText('до 74 м²')).toBeInTheDocument();
  });
});
