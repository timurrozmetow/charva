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
