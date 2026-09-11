import { DEFAULT_PRICING_RULES, formatMoney, quote } from '@charva/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../test/app';

import { loadConfig, priceSelection } from './service';

/**
 * The builder.
 *
 * The arithmetic used to be reached through `POST /builder/quote`, and these tests posted to it.
 * The route went when the owner took pricing off the site (2026-09-11) — an endpoint answering
 * «1 296 $» to anyone who asks is a price channel whether or not a screen renders it.
 *
 * The formula did not go, and neither did its tests. It runs once now, server-side, when a lead
 * arrives, so the figure the operator opens an enquiry with is exactly what is checked below.
 * Calling `priceSelection` directly rather than through a route is not a weaker test: the route
 * was one line handing the body to this function, and what was ever worth asserting is that
 * seven nights is seven nights and that twenty identical selections give one identical answer.
 *
 * What could not survive is the pair that tested the route's own validation — a step nobody
 * defined, a body carrying a price. There is no body any more. The schema that refused them,
 * `builderSelectionSchema`, is still the one the lead endpoint validates a selection with.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterAll(async () => {
  await context.close();
});

/** What the operator's figure is computed from, straight out of the database. */
async function price(selection: Record<string, string | string[]> = {}) {
  return priceSelection(context.app.db, selection);
}

describe('the price the operator is shown', () => {
  it('prices an untouched builder at 1 296 $', async () => {
    /*
     * The phase's headline number and the one every visitor sees before their first click:
     * six nights at the four-star rate, for two people, plus the base fee. It comes out of the
     * three default rules as much as out of the rates — question Q-10 asks the owner to bless
     * all six numbers.
     */
    const body = await price();
    expect(body.total.minor).toBe(129_600);
    // Non-breaking spaces, written as escapes: the separator `formatMoney` uses is
    // indistinguishable from an ordinary space in a diff, and phase 2 already lost time to it.
    expect(formatMoney(body.total)).toBe('1 296 $');
  });

  it('gives byte-identical answers to twenty identical requests', async () => {
    // Integer arithmetic throughout, so there is no float drifting in the last cent between the
    // instant estimate and the authoritative one.
    const selection = { dest: ['dest_ashgabat', 'dest_mary'], dates: 'nights_7' };
    const bodies = new Set<string>();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      bodies.add(JSON.stringify(await price(selection)));
    }

    expect(bodies.size, 'twenty runs produced more than one answer').toBe(1);
  });

  it('reads what an option means separately from what it costs', async () => {
    // `nights_7` is seven nights, not seven dollars — decision D-10, and the mistake the
    // handoff's single `price_modifier` column forces.
    const seven = await price({ dates: 'nights_7' });
    expect(seven.nights).toBe(7);

    const people = await price({ people: 'pax_6_10' });
    // «6–10» means eight, which is one of the numbers question Q-10 asks about.
    expect(people.pax).toBe(8);
  });

  it('multiplies by people and adds per city and per activity', async () => {
    const body = await price({
      dates: 'nights_7',
      hotel: 'hotel_4star',
      dest: ['dest_ashgabat', 'dest_mary'],
      activities: ['act_darvaza'],
      people: 'pax_2',
    });

    const accommodation = body.breakdown.find((line) => line.kind === 'accommodation');
    expect(accommodation?.count).toBe(7);
    expect(accommodation?.amountMinor).toBe(7 * 7_800);

    const cities = body.breakdown.find((line) => line.kind === 'cities');
    expect(cities?.count).toBe(2);
    expect(cities?.amountMinor).toBe(2 * DEFAULT_PRICING_RULES.cityFeeMinor);

    expect(body.total.minor).toBe(body.perPerson.minor * body.pax);
  });

  it('says which priced steps are still guesses', async () => {
    const untouched = await price();
    expect(untouched.isEstimate).toBe(true);
    expect(untouched.missingSteps).toContain('hotel');

    const answered = await price({
      dest: ['dest_ashgabat'],
      dates: 'nights_7',
      hotel: 'hotel_4star',
      activities: ['act_darvaza'],
      people: 'pax_2',
    });

    expect(answered.missingSteps).toEqual([]);
    expect(answered.isEstimate).toBe(false);
  });

  it('ignores a step nobody defined rather than pricing it', async () => {
    // A quietly priced unknown field is a quote that looks right and charges for something
    // else. The route used to refuse this with a 400; the function is now reached only from
    // the lead endpoint, which validates with the same `builderSelectionSchema` first, so what
    // matters here is that the arithmetic is untouched by a key it does not know.
    expect((await price({ hotels: 'hotel_4star' })).total.minor).toBe((await price()).total.minor);
  });

  it('is the same arithmetic the package exports — on twenty random selections', async () => {
    /*
     * What is left of decision D-11, and still worth proving.
     *
     * The browser no longer prices anything, so the two sides cannot disagree by construction.
     * What this now guards is narrower and still real: that `priceSelection` is a thin wrapper
     * over the exported `quote()` and not a second implementation that grew its own rules.
     */
    const config = await loadConfig(context.app.db);
    const byStep = new Map<string, string[]>();
    for (const option of config.options) {
      byStep.set(option.step, [...(byStep.get(option.step) ?? []), option.code]);
    }

    // Deterministic pseudo-randomness: a failing case has to be reproducible from the file.
    let seed = 20_260_812;
    const next = (bound: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % bound;
    };

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const selection: Record<string, string | string[]> = {};
      for (const [step, codes] of byStep) {
        if (codes.length === 0 || next(3) === 0) continue;
        const pick = codes[next(codes.length)];
        if (pick === undefined) continue;
        selection[step] =
          step === 'dest' || step === 'activities' || step === 'food' ? [pick] : pick;
      }

      const direct = quote(selection, config);
      const server = await price(selection);

      expect(server.total.minor, JSON.stringify(selection)).toBe(direct.total.minor);
      expect(server.perPerson.minor, JSON.stringify(selection)).toBe(direct.perPerson.minor);
    }
  });
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
        // The prototype keys its rate table by «3 ★» and «3–5» — with a real star and an
        // en dash — so translating a label would silently reprice the tour.
        expect(option.code, option.code).toMatch(/^[a-z0-9_]+$/);
      }
    }

    expect(body.defaults.defaultNights).toBe(DEFAULT_PRICING_RULES.defaultNights);
    expect(body.defaults.defaultPax).toBe(DEFAULT_PRICING_RULES.defaultPax);
  });

  it('carries no money at all', () => {
    /*
     * The structural half of the owner's decision, and the reason it is not just a hidden
     * element: a response schema is the serialiser (D-12), so a rate that is not in it cannot
     * reach a browser however the query is written.
     *
     * The sweep is over the raw body rather than over named fields, because naming them is
     * exactly the check that passes while a seventh one is added beside them.
     */
    // `response.body`, not the response: stringifying the whole object drags in Fastify's
    // socket, its headers and a `content-length`, and the sweep matches on those instead.
    for (const word of ['priceModifier', 'Minor', 'currency', 'USD', 'baseFee', 'cityFee']) {
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
  });
});
