/**
 * Does the layout survive the screens people actually hold?
 *
 * A real engine, driven over the DevTools protocol, because none of this can be answered from
 * the source. Whether a row fits, whether a link ends up past the edge, how tall a button
 * really is — these are results of layout, and the only honest way to read them is to lay the
 * page out and measure. jsdom reports every rectangle as zero.
 *
 * No dependency: Node's own `WebSocket` speaks CDP, and Chrome is already on any machine that
 * can look at the site. If Chrome is not found the script says so and exits 0 — it is a guard
 * to run against a deployment, not a gate that can fail a build on a machine without a browser,
 * which is why it is not part of `pnpm verify`.
 *
 * Two lessons are baked into the checks, both learned by getting them wrong first:
 *
 *   1. `documentElement.scrollWidth > clientWidth` is NOT sideways overflow. Chrome's mobile
 *      emulation widens its own idea of the viewport around content that cannot shrink — a
 *      `min-w-[720px]` table inside an `overflow-x-auto` wrapper made every phone width report
 *      hundreds of pixels of overflow on a page that scrolls perfectly. The question «can the
 *      visitor scroll sideways» is answered by trying: set `scrollLeft` and read it back.
 *
 *   2. Something past the right edge of a page that does NOT scroll is worse than one that
 *      does. On the Umrah and Global footers at 320px the imo link sat at x=300 in a 280-wide
 *      window with no scroll to reach it: present, announced, and unreachable. That is the
 *      check that found it.
 *
 * Usage:
 *   node scripts/responsive-audit.mjs                       # the three live sites
 *   node scripts/responsive-audit.mjs http://localhost:4181/ru
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/**
 * The widths, and why each one is here.
 *
 * Not a ladder of round numbers: every row is a screen somebody is holding. The narrow end is
 * where foldables live when they are shut, and it is the end that breaks — a cover screen is
 * narrower than any phone the design was drawn for. The 673–884 band is the same devices open,
 * which is also small tablets in portrait, and it is the band that falls on the wrong side of
 * a `max-width` breakpoint most often.
 */
const DEVICES = [
  { name: 'Fold cover', w: 280, h: 653 },
  { name: 'SE / older', w: 320, h: 568 },
  { name: 'ZFold cover', w: 344, h: 882 },
  { name: 'Android', w: 360, h: 800 },
  { name: 'iPhone SE', w: 375, h: 667 },
  { name: 'Pixel', w: 412, h: 915 },
  { name: 'iPhone Max', w: 430, h: 932 },
  { name: 'Duo pane', w: 540, h: 720 },
  { name: 'ZFold open', w: 673, h: 841 },
  { name: 'iPad mini', w: 744, h: 1133 },
  { name: 'iPad', w: 820, h: 1180 },
  { name: 'Phone land', w: 844, h: 390 },
  { name: 'ZFold wide', w: 884, h: 1104 },
  { name: 'iPad Pro P', w: 1024, h: 1366 },
  { name: 'iPad Pro L', w: 1194, h: 834 },
  { name: 'Laptop', w: 1280, h: 800 },
  { name: 'Desktop', w: 1440, h: 900 },
];

const DEFAULT_PAGES = [
  'https://charva-travel.com/',
  'https://global.charva-travel.com/ru',
  'https://global.charva-travel.com/ru/builder',
  'https://global.charva-travel.com/ru/hotels',
  'https://global.charva-travel.com/ru/contact',
  'https://umra.charva-travel.com/tm',
  'https://umra.charva-travel.com/tm/suratlar',
  'https://umra.charva-travel.com/tm/yazylmak',
];

const PROBE = String.raw`(() => {
  const root = document.scrollingElement;
  const vw = root.clientWidth;

  /* Can the visitor scroll sideways? Ask by trying, not by comparing widths. */
  const before = root.scrollLeft;
  root.scrollLeft = 99999;
  const sideways = Math.round(root.scrollLeft);
  root.scrollLeft = before;

  const path = (el) => {
    const bits = [];
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 4; i += 1) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (typeof n.className === 'string' && n.className.trim())
        s += '.' + n.className.trim().split(/\s+/).slice(0, 5).join('.');
      bits.unshift(s);
      n = n.parentElement;
    }
    return bits.join(' > ');
  };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  /* Inside a box that scrolls, being past the edge is the box's job, not a defect. */
  const insideAScroller = (el) => {
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (getComputedStyle(n).overflowX !== 'visible') return true;
    }
    return false;
  };

  /* --- past the edge, with no scroll to reach it ------------------------------- */
  const stranded = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!shown(el) || insideAScroller(el)) continue;
    const r = el.getBoundingClientRect();
    /* The honeypot is parked at -9999px on purpose (D-19) and is nobody's target. */
    if (r.left < -4000) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (stranded.some((s) => s.el.contains(el))) continue;
    stranded.push({ el, x: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
  }

  /* --- targets smaller than SC 2.5.8 asks for ---------------------------------- */
  const SELECTOR =
    'a[href], button, [role="button"], [role="tab"], [role="radio"], [role="switch"], input, select, textarea, summary';
  const small = [];
  for (const el of document.body.querySelectorAll(SELECTOR)) {
    /*
      A control whose label is the visible thing is measured by the label.

      Both the consent checkbox and the chips of a radio group draw a styled box and keep the
      real input either 17px or screen-reader-only; the whole label is what a finger lands on,
      and that is deliberate. Measuring the input alone reported two failures that are not.
    */
    const label = el.closest('label');
    const target = label ?? el;
    if (!shown(target)) continue;
    const cs = getComputedStyle(el);
    /* WCAG's inline exception: a link in a run of prose is sized by the prose. */
    if (el.tagName === 'A' && cs.display.startsWith('inline')) {
      const p = el.parentElement;
      if (
        p &&
        /^(P|SPAN|LI|TD|DD|DT|LABEL)$/.test(p.tagName) &&
        p.textContent.trim().length > (el.textContent || '').trim().length + 4
      )
        continue;
    }
    const r = target.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w >= 24 && h >= 24) continue;
    small.push({
      el,
      w,
      h,
      text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30),
    });
  }

  const take = (list, n, map) => list.slice(0, n).map(map);
  return {
    vw,
    sideways,
    stranded: take(stranded, 8, (o) => ({ sel: path(o.el), x: o.x, right: o.right, w: o.w })),
    strandedCount: stranded.length,
    small: take(small, 8, (o) => ({ sel: path(o.el), w: o.w, h: o.h, text: o.text })),
    smallCount: small.length,
  };
})()`;

// ====================================================================================
// A very small CDP client
// ====================================================================================

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      const slot = msg.id === undefined ? undefined : pending.get(msg.id);
      if (slot === undefined) return;
      pending.delete(msg.id);
      if (msg.error) slot.reject(new Error(msg.error.message));
      else slot.resolve(msg.result);
    });
    socket.addEventListener('error', reject);
    socket.addEventListener('open', () => {
      resolve({
        socket,
        send(method, params = {}, sessionId) {
          const id = nextId;
          nextId += 1;
          const payload = { id, method, params };
          if (sessionId !== undefined) payload.sessionId = sessionId;
          socket.send(JSON.stringify(payload));
          return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }));
        },
      });
    });
  });
}

async function launch() {
  const binary = CHROME_PATHS.find((p) => existsSync(p));
  if (binary === undefined) return null;
  const profile = mkdtempSync(join(tmpdir(), 'charva-responsive-'));
  const port = 9222 + Math.floor(Math.random() * 500);
  const child = spawn(
    binary,
    [
      '--headless=new',
      `--remote-debugging-port=${String(port)}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let version = null;
  for (let i = 0; i < 100 && version === null; i += 1) {
    try {
      version = await (await fetch(`http://127.0.0.1:${String(port)}/json/version`)).json();
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (version === null) throw new Error('Chrome opened no debugging port');
  const browser = await connect(version.webSocketDebuggerUrl);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  await browser.send('Page.enable', {}, sessionId);
  await browser.send('Runtime.enable', {}, sessionId);
  /*
    Reduced motion, so the scroll reveal is not mistaken for an empty page: a section that has
    not been scrolled past is `opacity: 0` by design, and measuring it would be measuring the
    animation rather than the layout.
  */
  await browser.send(
    'Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
    sessionId,
  );
  return {
    async viewport(w, h) {
      await browser.send(
        'Emulation.setDeviceMetricsOverride',
        { width: w, height: h, deviceScaleFactor: 2, mobile: w < 900 },
        sessionId,
      );
    },
    async visit(url) {
      await browser.send('Page.navigate', { url }, sessionId);
      await new Promise((r) => setTimeout(r, 2000));
    },
    async probe() {
      const out = await browser.send(
        'Runtime.evaluate',
        { expression: PROBE, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      if (out.exceptionDetails) throw new Error('probe failed');
      return out.result.value;
    },
    async close() {
      try {
        browser.socket.close();
      } catch {
        /* already gone */
      }
      child.kill();
      await new Promise((r) => setTimeout(r, 300));
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* Windows holds the profile for a moment */
      }
    },
  };
}

// ====================================================================================

const pages = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_PAGES;
const chrome = await launch();
if (chrome === null) {
  console.log('No Chrome or Edge found — skipping the responsive audit.');
  process.exit(0);
}

/** One defect, however many widths show it. */
const findings = new Map();
const record = (kind, key, width, detail) => {
  const row = findings.get(key) ?? { kind, widths: [], detail };
  row.widths.push(width);
  findings.set(key, row);
};

for (const url of pages) {
  process.stdout.write(`\n${url}\n`);
  for (const device of DEVICES) {
    await chrome.viewport(device.w, device.h);
    await chrome.visit(url);
    let r;
    try {
      r = await chrome.probe();
    } catch {
      process.stdout.write(`  ${String(device.w).padStart(4)}  probe failed\n`);
      continue;
    }
    const flags = [];
    if (r.sideways > 0) flags.push(`scrolls sideways ${String(r.sideways)}px`);
    if (r.strandedCount > 0) flags.push(`${String(r.strandedCount)} past the edge`);
    if (r.smallCount > 0) flags.push(`${String(r.smallCount)} targets under 24px`);
    process.stdout.write(
      `  ${String(device.w).padStart(4)} ${device.name.padEnd(12)} ${flags.length === 0 ? 'ok' : flags.join(', ')}\n`,
    );
    if (r.sideways > 0) record('scroll', `${url} | the page itself`, device.w, { px: r.sideways });
    for (const s of r.stranded) record('stranded', `${url} | ${s.sel}`, device.w, s);
    for (const s of r.small) record('target', `${url} | ${s.sel} | ${s.text}`, device.w, s);
  }
}

await chrome.close();

if (findings.size === 0) {
  console.log('\nNothing stranded, nothing scrolling sideways, no target under 24px.');
  process.exit(0);
}

console.log(`\n\n${String(findings.size)} finding(s):`);
for (const [key, row] of findings) {
  console.log(`\n  [${row.kind}] at ${row.widths.join(', ')}px`);
  console.log(`  ${JSON.stringify(row.detail)}`);
  console.log(`  ${key}`);
}
process.exit(1);
