/**
 * Page views and goals, for whichever counter the owner has configured.
 *
 * Three properties, and each one is the reason this is a module rather than four lines copied
 * into three applications:
 *
 * **Nothing is hard-coded.** The counter ids come from `settings`, are injected into the head by
 * the shell, and reach the browser as `window.__charvaAnalytics`. An unset counter emits no
 * script at all — there is no snippet sitting on the page with a placeholder id in it, which is
 * the usual way a site ends up reporting into somebody else's account.
 *
 * **Nothing here can break a page.** Every call is wrapped: a counter blocked by an extension,
 * by a corporate proxy, or by a country — and this site's Umrah audience is entirely inside
 * Turkmenistan, where reachability of any given third party is not something to assume — must
 * cost a visitor nothing. An analytics failure that throws inside a router subscription would
 * take the navigation with it.
 *
 * **A single-page application has to say when it navigated.** Both counters record the first
 * page by themselves and neither sees a client-side route change reliably, so every later view
 * is reported here or not at all.
 */

interface AnalyticsConfig {
  /** Yandex.Metrika counter number. */
  metrika?: number;
  /** GA4 measurement id, `G-XXXXXXXXXX`. */
  ga?: string;
}

declare global {
  interface Window {
    __charvaAnalytics?: AnalyticsConfig;
    ym?: (id: number, action: string, ...rest: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

function config(): AnalyticsConfig {
  if (typeof window === 'undefined') return {};
  return window.__charvaAnalytics ?? {};
}

/** Swallows everything. A counter is never a reason for a page to stop working. */
function attempt(run: () => void): void {
  try {
    run();
  } catch {
    // Deliberately silent: there is nothing a visitor could do about it, and a console full of
    // counter errors trains whoever debugs this site next to ignore the console.
  }
}

/**
 * The address the counters have already been told about.
 *
 * Seeded with the page the bundle loaded on, because the snippets in the head counted that one
 * as they ran — a router fires its first `onResolved` on the page it started from, and without
 * this every visit would open with two views of the same URL and a bounce rate of nonsense.
 */
let lastReported = typeof window === 'undefined' ? '' : window.location.href;

/**
 * One view, reported after the router has changed the address.
 *
 * Metrika wants the URL it should record; GA4 wants `page_location` set on the call rather than
 * read from `document`, because at the moment a router fires its subscription the two can still
 * disagree.
 */
export function trackPageview(url: string): void {
  if (url === lastReported) return;
  lastReported = url;

  const { metrika, ga } = config();

  attempt(() => {
    if (metrika !== undefined && window.ym !== undefined) {
      window.ym(metrika, 'hit', url);
    }
  });

  attempt(() => {
    if (ga !== undefined && window.gtag !== undefined) {
      window.gtag('event', 'page_view', { page_location: url, page_path: new URL(url).pathname });
    }
  });
}

/**
 * Something worth counting happened — an enquiry sent, a phone number tapped.
 *
 * These are the numbers that mean anything to this business. Visits are a vanity metric for a
 * tour operator: what matters is how many of them ended in somebody writing in, and which page
 * they were on when they did.
 */
export function trackGoal(name: string, params: Record<string, unknown> = {}): void {
  const { metrika, ga } = config();

  attempt(() => {
    if (metrika !== undefined && window.ym !== undefined) {
      window.ym(metrika, 'reachGoal', name, params);
    }
  });

  attempt(() => {
    if (ga !== undefined && window.gtag !== undefined) {
      window.gtag('event', name, params);
    }
  });
}
