import { screen } from '@testing-library/react';
import axe, { type Result } from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaPage } from './pages/MediaPage';
import { SignupPage } from './pages/SignupPage';
import { ZiyaratPage } from './pages/ZiyaratPage';
import { formToken, groups, settings, trip, ziyarat } from './test/fixtures';
import { renderPage, stubApi } from './test/renderPage';

/**
 * Accessibility on the Umrah site, checked by machine.
 *
 * The same acceptance criterion as Global's — zero axe violations at serious or above — and it
 * matters more here. This audience is older on average, more of it is reading in a second
 * language, and the pages carry the two things automated checks are actually good at catching:
 * a tab list whose panel is somewhere else in the document, and a form that asks for a passport
 * number.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

const BLOCKING = new Set(['serious', 'critical']);

async function violations(): Promise<Result[]> {
  // jsdom computes no layout, so contrast is unmeasurable here; the tokens are under a real
  // contrast test in `packages/ui` instead (D-3).
  const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
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

describe('axe', () => {
  it('finds nothing serious on the places of ziyarat', async () => {
    stubApi({ '/umrah/ziyarat': ziyarat() });
    await renderPage(<ZiyaratPage lang="tm" />, { path: '/tm/ziyarat' });
    await screen.findByRole('group');

    const found = await violations();
    expect(found.length, `\n${describeViolations(found)}`).toBe(0);
  }, 30_000);

  it('finds nothing serious on the group photographs', async () => {
    stubApi({ '/umrah/groups': groups() });
    await renderPage(<MediaPage lang="tm" />, { path: '/tm/suratlar' });
    await screen.findByRole('tablist');

    /*
     * The page this check was written for.
     *
     * Its tabs sit in one section and the mosaic they control in the next, so `aria-controls`
     * pointed at an element that was never rendered — a tab announcing that it controls
     * something a screen reader cannot find. Both call sites of `Tabs` in this repository
     * shipped that way until this ran.
     */
    const found = await violations();
    expect(found.length, `\n${describeViolations(found)}`).toBe(0);
  }, 30_000);

  it('finds nothing serious on the signup form', async () => {
    stubApi({
      '/umrah/trip/current': trip(),
      '/umrah/settings': settings(),
      '/forms/token': formToken(),
    });
    await renderPage(<SignupPage lang="tm" />, { path: '/tm/yazylmak' });
    await screen.findByRole('heading', { level: 1 });

    const found = await violations();
    expect(found.length, `\n${describeViolations(found)}`).toBe(0);
  }, 30_000);
});

describe('the tab list and the panel it controls', () => {
  it('points every tab at a panel that exists', async () => {
    stubApi({ '/umrah/groups': groups() });
    await renderPage(<MediaPage lang="tm" />, { path: '/tm/suratlar' });

    const tabs = await screen.findAllByRole('tab');
    expect(tabs.length).toBeGreaterThan(0);

    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(selected).toBeDefined();

    // The reference has to resolve, and the thing it resolves to has to be the panel.
    const panelId = selected!.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId!);
    expect(panel, `aria-controls="${panelId ?? ''}" points at nothing`).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe(selected!.id);
  });
});
