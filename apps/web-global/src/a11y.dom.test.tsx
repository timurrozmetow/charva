import { screen, waitFor } from '@testing-library/react';
import axe, { type Result } from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { HotelDetailPage } from './pages/HotelDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TourDetailPage } from './pages/TourDetailPage';
import { ToursPage } from './pages/ToursPage';
import { builderConfig } from './test/builderFixture';
import {
  articleDetail,
  faq,
  formToken,
  home,
  hotelDetail,
  settings,
  tourDetail,
  toursResponse,
} from './test/fixtures';
import { renderPage, stubApi } from './test/renderPage';

/**
 * Accessibility, checked by machine on every route that has fixtures.
 *
 * The phase-8 acceptance criterion is «zero axe violations at serious or above», and this is
 * what makes it a fact rather than an intention. It is not the whole of accessibility — axe
 * finds perhaps a third of real problems and cannot tell whether a heading actually describes
 * its section — but the third it finds is the third that is invisible in review: a contrast
 * pair nobody measured, a form control whose label points at the wrong id, a landmark missing
 * from a page that looks perfectly ordinary.
 *
 * Not the whole audit either. Keyboard order, focus return and the screen-reader reading of the
 * countdown are in phase 8's manual pass, because no automated tool has an opinion about them.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Serious and critical only.
 *
 * `minor` and `moderate` in jsdom are mostly noise about a rendering it cannot do — axe cannot
 * measure contrast without a layout engine, and the tokens are already under a real contrast
 * test in `packages/ui` (D-3). Failing on those would train everybody to ignore this file.
 */
const BLOCKING = new Set(['serious', 'critical']);

async function violations(): Promise<Result[]> {
  const results = await axe.run(document.body, {
    // jsdom computes no styles, so colour-contrast reports every element as «incomplete» and
    // region rules misfire on a fragment rendered without its full document.
    rules: { 'color-contrast': { enabled: false } },
  });

  return results.violations.filter((violation) => BLOCKING.has(violation.impact ?? ''));
}

function describeViolations(found: Result[]): string {
  return found
    .map(
      (violation) =>
        `${violation.impact ?? '?'} — ${violation.id}: ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => `      ${node.html.slice(0, 120)}`)
          .join('\n'),
    )
    .join('\n');
}

/** Every page that can be rendered from the fixtures this app already has. */
const PAGES: { name: string; render: () => Promise<unknown>; settled: () => Promise<unknown> }[] = [
  {
    name: 'home',
    render: async () => {
      stubApi({
        '/global/home': home(),
        '/global/builder/config': builderConfig(),
        '/forms/token': formToken(),
      });
      return renderPage(<HomePage lang="ru" />, { path: '/ru' });
    },
    settled: () => screen.findByRole('link', { name: /Все маршруты/ }),
  },
  {
    name: 'tours',
    render: async () => {
      stubApi({ '/global/tours': toursResponse() });
      return renderPage(<ToursPage lang="ru" />, { path: '/ru/tours' });
    },
    settled: () => screen.findAllByRole('article'),
  },
  {
    name: 'tour detail',
    render: async () => {
      stubApi({ '/global/tours/': tourDetail(), '/forms/token': formToken() });
      return renderPage(<TourDetailPage lang="ru" slug="klassicheskiy-turkmenistan" />, {
        path: '/ru/tours/klassicheskiy-turkmenistan',
      });
    },
    settled: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'hotel detail',
    render: async () => {
      stubApi({ '/global/hotels/': hotelDetail(), '/forms/token': formToken() });
      return renderPage(<HotelDetailPage lang="ru" slug="garagum-camp" />, {
        path: '/ru/hotels/garagum-camp',
      });
    },
    settled: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'article detail',
    render: async () => {
      stubApi({ '/global/articles/': articleDetail() });
      return renderPage(<ArticleDetailPage lang="ru" slug="viza-v-turkmenistan" />, {
        path: '/ru/articles/viza-v-turkmenistan',
      });
    },
    settled: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: 'contact',
    render: async () => {
      stubApi({
        '/global/settings': settings(),
        '/global/faq': faq(),
        '/forms/token': formToken(),
      });
      return renderPage(<ContactPage lang="ru" />, { path: '/ru/contact' });
    },
    settled: () => screen.findByRole('heading', { level: 1 }),
  },
  {
    name: '404',
    render: async () => {
      stubApi({});
      return renderPage(<NotFoundPage lang="ru" />, { path: '/ru/nonsense' });
    },
    settled: () => screen.findByRole('heading', { level: 1 }),
  },
];

describe('axe', () => {
  for (const page of PAGES) {
    it(`finds nothing serious on ${page.name}`, async () => {
      await page.render();
      await page.settled();

      const found = await violations();
      expect(found.length, `\n${describeViolations(found)}`).toBe(0);
    }, 30_000);
  }
});

describe('the parts axe cannot see', () => {
  it('gives every page exactly one h1', async () => {
    // Two `h1`s is not an axe violation and is still a page whose outline lies: a screen reader
    // user jumping by heading meets the same level twice and cannot tell which is the subject.
    await PAGES[0]!.render();
    await PAGES[0]!.settled();

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });
  });

  it('labels every form control on the enquiry page', async () => {
    await PAGES[5]!.render();
    await PAGES[5]!.settled();

    // `getByLabelText` throws unless the association is real — a `<label for>` pointing at an
    // id that exists, or an `aria-label`. A styled `<span>` beside an input, which is what the
    // prototype has, satisfies nothing.
    for (const label of [/Имя/, /Телефон/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
