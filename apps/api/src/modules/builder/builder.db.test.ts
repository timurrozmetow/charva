import { DEFAULT_PRICING_RULES, formatMoney, quote } from '@charva/contracts';
import { type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, problem, type TestApp } from '../../test/app';

import { loadConfig } from './service';

/**
 * The builder over the wire.
 *
 * The point of these is decision D-11: the client computes its instant estimate with the same
 * `quote()` this endpoint calls, so the two cannot disagree — there is no second implementation
 * to disagree with. The last test in this file is what proves that claim rather than asserting
 * it, by running the shared function directly and comparing it to what the API answered.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterAll(async () => {
  await context.close();
});

async function postQuote(body: Record<string, unknown>): Promise<LightMyRequestResponse> {
  return context.app.inject({
    method: 'POST',
    url: `${context.prefix}/global/builder/quote`,
    payload: body,
  });
}

describe('POST /builder/quote', () => {
  it('prices an untouched builder at 1 296 $', async () => {
    /*
     * The phase's headline number and the one every visitor sees before their first click:
     * six nights at the four-star rate, for two people, plus the base fee. It comes out of the
     * three default rules as much as out of the rates — question Q-10 asks the owner to bless
     * all six numbers.
     */
    const response = await postQuote({});
    expect(response.statusCode).toBe(200);

    const body = response.json<{ total: { minor: number; currency: 'USD' } }>();
    expect(body.total.minor).toBe(129_600);
    // Non-breaking spaces, written as escapes: the separator `formatMoney` uses is
    // indistinguishable from an ordinary space in a diff, and phase 2 already lost time to it.
    expect(formatMoney(body.total)).toBe('1 296 $');
  });

  it('gives byte-identical answers to twenty identical requests', async () => {
    // Integer arithmetic throughout, so there is no float drifting in the last cent between the
    // instant estimate and the authoritative one.
    const selection = { selection: { dest: ['dest_ashgabat', 'dest_mary'], dates: 'nights_7' } };
    const bodies = new Set<string>();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await postQuote(selection);
      expect(response.statusCode).toBe(200);
      bodies.add(response.body);
    }

    expect(bodies.size, 'twenty requests produced more than one body').toBe(1);
  });

  it('reads what an option means separately from what it costs', async () => {
    // `nights_7` is seven nights, not seven dollars — decision D-10, and the mistake the
    // handoff's single `price_modifier` column forces.
    const seven = (await postQuote({ selection: { dates: 'nights_7' } })).json<{
      nights: number;
    }>();
    expect(seven.nights).toBe(7);

    const people = (await postQuote({ selection: { people: 'pax_6_10' } })).json<{ pax: number }>();
    // «6–10» means eight, which is one of the numbers question Q-10 asks about.
    expect(people.pax).toBe(8);
  });

  it('multiplies by people and adds per city and per activity', async () => {
    const body = (
      await postQuote({
        selection: {
          dates: 'nights_7',
          hotel: 'hotel_4star',
          dest: ['dest_ashgabat', 'dest_mary'],
          activities: ['act_darvaza'],
          people: 'pax_2',
        },
      })
    ).json<{
      perPerson: { minor: number };
      total: { minor: number };
      pax: number;
      breakdown: { kind: string; count: number; amountMinor: number }[];
    }>();

    const accommodation = body.breakdown.find((line) => line.kind === 'accommodation');
    expect(accommodation?.count).toBe(7);
    expect(accommodation?.amountMinor).toBe(7 * 7_800);

    const cities = body.breakdown.find((line) => line.kind === 'cities');
    expect(cities?.count).toBe(2);
    expect(cities?.amountMinor).toBe(2 * DEFAULT_PRICING_RULES.cityFeeMinor);

    expect(body.total.minor).toBe(body.perPerson.minor * body.pax);
  });

  it('says which priced steps are still guesses', async () => {
    const untouched = (await postQuote({})).json<{
      isEstimate: boolean;
      missingSteps: string[];
    }>();
    expect(untouched.isEstimate).toBe(true);
    expect(untouched.missingSteps).toContain('hotel');

    const answered = (
      await postQuote({
        selection: {
          dest: ['dest_ashgabat'],
          dates: 'nights_7',
          hotel: 'hotel_4star',
          activities: ['act_darvaza'],
          people: 'pax_2',
        },
      })
    ).json<{ isEstimate: boolean; missingSteps: string[] }>();

    expect(answered.missingSteps).toEqual([]);
    expect(answered.isEstimate).toBe(false);
  });

  it('refuses a step nobody defined rather than silently ignoring it', async () => {
    // A quietly dropped field is a quote that looks right and prices something else.
    const response = await postQuote({ selection: { hotels: 'hotel_4star' } });
    expect(response.statusCode).toBe(400);
    expect(problem(response).error.code).toBe('validation_failed');
  });

  it('refuses a body carrying a price', async () => {
    // There is no field for one, and `.strict()` makes that a rejection rather than a silently
    // ignored key. The client never sends a total; the server computes it.
    const response = await postQuote({ selection: {}, total: { minor: 1, currency: 'USD' } });
    expect(response.statusCode).toBe(400);
  });

  it('agrees exactly with the function the browser runs — on twenty random selections', async () => {
    /*
     * Decision D-11, proven rather than asserted.
     *
     * `quote()` here is the identical import the SPA uses; the config is what `GET /config`
     * hands the client. If these ever diverged it would mean somebody wrote a second
     * implementation, which is the thing the decision exists to prevent.
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

      const clientSide = quote(selection, config);
      const server = (await postQuote({ selection })).json<{
        total: { minor: number };
        perPerson: { minor: number };
      }>();

      expect(server.total.minor, JSON.stringify(selection)).toBe(clientSide.total.minor);
      expect(server.perPerson.minor, JSON.stringify(selection)).toBe(clientSide.perPerson.minor);
    }
  });
});

describe('GET /builder/config', () => {
  it('hands over nine steps keyed by stable ASCII codes', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/global/builder/config`,
    });
    expect(response.statusCode).toBe(200);

    const body = response.json<{
      steps: { code: string; title: string; options: { code: string }[] }[];
      rules: { defaultNights: number; defaultPax: number };
    }>();

    expect(body.steps).toHaveLength(9);
    for (const step of body.steps) {
      for (const option of step.options) {
        // The prototype keys its rate table by «3 ★» and «3–5» — with a real star and an
        // en dash — so translating a label would silently reprice the tour.
        expect(option.code, option.code).toMatch(/^[a-z0-9_]+$/);
      }
    }

    expect(body.rules.defaultNights).toBe(DEFAULT_PRICING_RULES.defaultNights);
    expect(body.rules.defaultPax).toBe(DEFAULT_PRICING_RULES.defaultPax);
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
