/** How long the fade lasts. Must match the `transition` on `#boot` in each `index.html`. */
const FADE_MS = 360;

/**
 * Takes down the loading screen that `index.html` painted before any of this existed.
 *
 * The gap it covers is real and nothing else can: between the first byte and React's first
 * paint the browser has to fetch, parse and run about 170KB of script, and on a phone in
 * Ashgabat that is not instant. What it used to show was the browser's white — not the site's
 * cream, not a skeleton, just white, which reads as a page that failed rather than one that is
 * arriving.
 *
 * Called after `render`, and dismissed across two frames: the first lets React commit, the
 * second lets the browser paint what React committed. Dismissing on the first would fade the
 * cover off an empty document and put the flash back.
 *
 * The element is removed rather than left at zero opacity. A fixed layer over the whole
 * viewport is a thing that can trap clicks the day somebody changes `pointer-events`, and the
 * cheapest way for it never to do that is for it not to be there.
 */
export function hideBootSplash(id = 'boot'): void {
  const splash = document.getElementById(id);
  if (splash === null) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.dataset['done'] = '';
      setTimeout(() => {
        splash.remove();
      }, FADE_MS);
    });
  });
}
