import { BUILDER_DEFAULTS } from '@charva/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../test/app';

/**
 * The builder, over the wire.
 *
 * This file used to be about the price. There were nine assertions on `quote()` — a base fee, a
 * rate per night, a fee per city, a breakdown that adds up, and twenty random selections proving
 * the server and the browser could not disagree because they ran the same function (D-11).
 *
 * All of it went on 2026-09-11, and then the day after. The owner took pricing off the site and
 * then out of the enquiry: an operator works a selection out and sends a price back. What those
 * tests proved was that an invented formula was applied consistently — the rates were the
 * designer's and question Q-10 never confirmed them — which is true and worth nothing.
 *
 * What is worth asserting now is the shape of the thing that replaced it: this endpoint hands
 * over nine questions, keyed by codes a translation cannot move, and not one number that could
 * be read as money.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterAll(async () => {
  await context.close();
});

describe('GET /builder/config', () => {
  let response: Awaited<ReturnType<TestApp['app']['inject']>>;

  beforeAll(async () => {
    response = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/global/builder/config`,
    });
  });

  it('hands over nine steps keyed by stable ASCII codes', () => {
    expect(response.statusCode).toBe(200);

    const body = response.json<{
      steps: { code: string; title: string; options: { code: string }[] }[];
      defaults: { defaultNights: number; defaultPax: number };
    }>();

    expect(body.steps).toHaveLength(9);
    for (const step of body.steps) {
      for (const option of step.options) {
        // The prototype keys its options by «3 ★» and «3–5» — with a real star and an en dash —
        // so a translated label would have been a different answer (D-10). The codes are what
        // go into a shared URL and into the enquiry, so they have to survive translation.
        expect(option.code, option.code).toMatch(/^[a-z0-9_]+$/);
      }
    }

    expect(body.defaults.defaultNights).toBe(BUILDER_DEFAULTS.defaultNights);
    expect(body.defaults.defaultPax).toBe(BUILDER_DEFAULTS.defaultPax);
  });

  it('carries no money at all', () => {
    /*
     * The structural half of the owner's decision, and the reason it is not a hidden element: a
     * response schema is the serialiser (D-12), so a rate that is not in it cannot reach a
     * browser however the query is written.
     *
     * The sweep is over the raw body rather than over named fields, because naming them is
     * exactly the check that passes on the day a seventh one is added beside them. `response.body`
     * and not the response object: stringifying that drags in a `content-length` and matches on
     * it instead.
     */
    for (const word of ['priceModifier', 'Minor', 'currency', 'USD', 'TMT', 'modifierType']) {
      expect(response.body, word).not.toContain(word);
    }
  });

  it('translates the labels and leaves the codes alone', async () => {
    const russian = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/global/builder/config?lang=ru`,
    });
    const english = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/global/builder/config?lang=en`,
    });

    const codesOf = (raw: string): string[] =>
      (JSON.parse(raw) as { steps: { options: { code: string }[] }[] }).steps.flatMap((step) =>
        step.options.map((option) => option.code),
      );

    expect(codesOf(english.body)).toEqual(codesOf(russian.body));
    expect(english.body).not.toBe(russian.body);
  });
});

describe('POST /builder/quote', () => {
  it('is gone', async () => {
    /*
     * Asserted rather than assumed, because «the client stopped calling it» and «it stopped
     * answering» are different facts and only the second one is a decision.
     *
     * It priced a selection and returned «1 296 $» to anybody who asked. An endpoint like that
     * is a price channel whether or not a screen renders what it says, which is the whole reason
     * the removal went as deep as the route rather than stopping at the panel.
     */
    const response = await context.app.inject({
      method: 'POST',
      url: `${context.prefix}/global/builder/quote`,
      payload: { selection: {} },
    });

    expect(response.statusCode).toBe(404);
  });
});
