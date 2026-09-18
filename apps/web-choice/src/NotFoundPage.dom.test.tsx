import { hreflangSet, routeMeta } from '@charva/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SITE_URLS } from './lib/sites';
import { buildRouter } from './router';

/**
 * The chooser's 404, through the real router.
 *
 * Deliberately not `renderWithRouter`: that helper builds a synthetic two-route tree, and the
 * defect being guarded here was that the app's own tree declared no `notFoundComponent` at all.
 * A test that mounted the component directly would have passed throughout — every address on
 * this host but `/` and `/<lang>` rendered TanStack's bare «Not Found» on the near-black page,
 * which is how the owner found it, at `charva-travel.com/ru/gallery`.
 *
 * The address is set on jsdom's own history rather than injected, so `buildRouter` is exercised
 * exactly as `main.tsx` calls it.
 */

/** What the server writes into the head before the bundle runs — the shell, in miniature. */
function seedShellHead(path: string): void {
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = new URL(path, location.origin).href;
  document.head.append(canonical);

  for (const { hreflang, lang } of hreflangSet('choice')) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = hreflang;
    link.href = new URL(`/${lang}`, location.origin).href;
    document.head.append(link);
  }
}

async function openApp(path: string) {
  window.history.replaceState({}, '', path);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={buildRouter(queryClient)} />
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(result.container.textContent).not.toBe('');
  });

  return result;
}

afterEach(() => {
  for (const link of document.head.querySelectorAll('link')) link.remove();
});

describe('an address the chooser does not have', () => {
  it('renders the 404 page, not the router’s bare fallback', async () => {
    await openApp('/ru/gallery');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Страница не найдена');
    // The shape of the defect: TanStack's fallback is the two words and nothing else.
    expect(screen.queryByText('Not Found')).toBeNull();
  });

  it('offers the two sites, because the apex is a door and they are the rooms', async () => {
    await openApp('/ru/gallery');

    // Plain anchors: these are two other origins (D-131), and the router has nothing to say
    // about them. Almost every visit here is a page of one of the two, typed against the apex.
    expect(screen.getByRole('link', { name: /Открыть Global/ })).toHaveAttribute(
      'href',
      SITE_URLS.global,
    );
    expect(screen.getByRole('link', { name: /Открыть Umrah/ })).toHaveAttribute(
      'href',
      SITE_URLS.umrah,
    );
  });

  it('keeps the language from the path, and asks the browser only when there is none', async () => {
    const { unmount } = await openApp('/tm/suratlar');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sahypa tapylmady');
    unmount();

    // No prefix to read: the first segment is not a language this site speaks, so there is
    // nothing in the address to go on. jsdom reports `en-US`, and the header is the only signal
    // left — the same rule the bare `/` follows, and for the same reason: nobody shares a 404.
    await openApp('/nonsense/deeper');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  });

  it('is two segments deep or more — one unknown segment is a language guess', async () => {
    /*
     * `/$lang` matches any single segment, so `/nonsense` is read as somebody guessing at a
     * language and `beforeLoad` redirects it to the chooser (D-54). That is right and worth
     * pinning: the chooser is the only page on this host, so handing over the door beats a
     * dead end. It is also why the 404 only ever sees paths like `/ru/gallery` — which is the
     * shape that actually arrives, a page of one of the other two sites typed at the apex.
     */
    await openApp('/nonsense');
    expect(screen.queryByText('Page not found')).toBeNull();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/en');
    });
  });

  it('titles itself as a 404 rather than as the chooser', async () => {
    await openApp('/ru/gallery');

    // It answered 404 all along — with `Charva Travel — туры по Туркменистану и умра` in the
    // title, which is a page that does not exist described as the homepage.
    await waitFor(() => {
      expect(document.title).toBe(routeMeta('choice', 'notFound', 'ru').title);
    });
  });

  it('owns the whole link set instead of appending to the shell’s', async () => {
    seedShellHead('/ru/gallery');
    await openApp('/ru/gallery');

    /*
     * D-168, which this app had not adopted: it removed only links carrying its own
     * `data-charva` mark and appended beside the server's, so the live chooser shipped eight
     * `hreflang` links. Google's rule for a repeated `rel` is to ignore all of them.
     */
    await waitFor(() => {
      expect(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(
        hreflangSet('choice').length,
      );
    });
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    // The address that was asked for, which is what the shell declared too.
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new URL('/ru/gallery', location.origin).href,
    );
  });
});
