import { and, eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as t from '../../db/schema';
import { issueFormToken } from '../../lib/form-token';
import { open } from '../../lib/secret-box';
import { agedFormToken, buildTestApp, problem, type TestApp } from '../../test/app';

/**
 * The five layers, one at a time — decision D-19.
 *
 * No captcha. Turnstile would add a dependency on Cloudflare, whose reachability from
 * Turkmenistan nobody has verified, plus a consent surface to explain on two sites, for a form
 * that receives single digits of genuine traffic a day. Five stateless layers instead, and
 * these tests exist because a defence nobody has fired is a defence nobody knows works.
 *
 * Every test uses its own address. The rate limit is per address and in-process, so sharing one
 * would make each test depend on how many ran before it.
 */

let context: TestApp;
let addressCounter = 0;

function freshAddress(): string {
  addressCounter += 1;
  return `203.0.113.${String(addressCounter % 250)}`;
}

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterEach(async () => {
  // Leads are the one thing these tests create. Clearing them keeps the duplicate window from
  // reaching across tests, which is the failure that would look like a flaky suite.
  await context.pool.query('DELETE FROM leads');
  await context.pool.query('DELETE FROM umrah_signups');
});

afterAll(async () => {
  await context.close();
});

function lead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'question',
    name: 'Мерет Аннаев',
    phone: '+993 65 123456',
    message: 'Расскажите про тур в Дарвазу',
    consent: true,
    formToken: agedFormToken(context.app),
    ...overrides,
  };
}

async function postLead(body: Record<string, unknown>, ip = freshAddress()) {
  return context.app.inject({
    method: 'POST',
    url: `${context.prefix}/global/leads`,
    headers: { 'x-forwarded-for': ip },
    payload: body,
  });
}

async function countLeads(): Promise<number> {
  const [rows] = await context.pool.query('SELECT COUNT(*) AS n FROM leads');
  return (rows as { n: number }[])[0]?.n ?? 0;
}

describe('a genuine submission', () => {
  it('is stored, and answers with the id', async () => {
    const response = await postLead(lead());

    expect(response.statusCode).toBe(201);
    const body = response.json<{ leadId: number; isDuplicate: boolean }>();
    expect(body.leadId).toBeGreaterThan(0);
    expect(body.isDuplicate).toBe(false);
    expect(await countLeads()).toBe(1);
  });

  it('stores the phone in one canonical form', async () => {
    // Layer five, and the reason the duplicate window works at all: `65 123456` and
    // `+993 65 12 34 56` are the same person and have to become the same string.
    await postLead(lead({ phone: '65 12 34 56' }));

    const [row] = await context.app.db.select().from(t.leads).limit(1);
    expect(row?.phone).toBe('+99365123456');
  });

  it('records when consent was given, because retention is counted from a date', async () => {
    await postLead(lead());

    const [row] = await context.app.db.select().from(t.leads).limit(1);
    expect(row?.consentAt).toBeInstanceOf(Date);
  });

  it('refuses without consent rather than assuming it', async () => {
    // The handoff's checkbox is a styled `<span>`: unchecked and uncheckable. Here an absent
    // consent is a rejected submission, not a stored row with an empty column.
    const response = await postLead(lead({ consent: false }));

    expect(response.statusCode).toBe(400);
    expect(await countLeads()).toBe(0);
  });

  it('never stores the address in the clear', async () => {
    await postLead(lead(), '198.51.100.7');

    const [row] = await context.app.db.select().from(t.leads).limit(1);
    expect(row?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.ipHash).not.toContain('198.51.100.7');
  });

  it('prices an attached builder selection itself', async () => {
    /*
     * The request has no field for a total, so there is nothing to ignore — but the selection
     * came from a browser, and this is where it becomes a number the business can stand behind.
     */
    await postLead(
      lead({ kind: 'builder', selection: { dates: 'nights_7', hotel: 'hotel_4star' } }),
    );

    const [row] = await context.app.db.select().from(t.leads).limit(1);
    const snapshot = row?.quoteSnapshot as { total: { minor: number } } | null;
    expect(snapshot?.total.minor).toBe((7 * 7_800 + 18_000) * 2);
  });
});

describe('layer one — the rate limit', () => {
  it('lets five through from one address and turns the sixth away', async () => {
    const address = freshAddress();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      // A different phone each time, so the duplicate window is not what stops them.
      const response = await postLead(lead({ phone: `+9936512345${String(attempt)}` }), address);
      expect(response.statusCode, `submission ${String(attempt + 1)}`).toBe(201);
    }

    const sixth = await postLead(lead({ phone: '+99365999999' }), address);
    expect(sixth.statusCode).toBe(429);
    expect(problem(sixth).error.code).toBe('rate_limited');
  });

  it('counts per address, not globally', async () => {
    // Behind nginx, without `trustProxy`, every visitor would be 127.0.0.1 and this limit would
    // shut the form for everybody the moment one person filled it in five times.
    const busy = freshAddress();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postLead(lead({ phone: `+9936512346${String(attempt)}` }), busy);
    }
    expect((await postLead(lead(), busy)).statusCode).toBe(429);

    expect((await postLead(lead({ phone: '+99361000001' }), freshAddress())).statusCode).toBe(201);
  });
});

describe('layer two — the honeypot', () => {
  it('answers 204 and writes nothing', async () => {
    const response = await postLead(lead({ website: 'https://cheap-pills.example' }));

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await countLeads()).toBe(0);
  });

  it('never says what gave it away', async () => {
    // An error message is a lesson. A bot told which field betrayed it gets that field right
    // next time and the layer is spent.
    const response = await postLead(lead({ website: 'anything' }));

    expect(response.statusCode).not.toBe(400);
    expect(response.body).not.toMatch(/website|honeypot|spam/i);
  });

  it('lets an empty value through, because that is what a person sends', async () => {
    expect((await postLead(lead({ website: '' }))).statusCode).toBe(201);
  });
});

describe('layer three — the time trap', () => {
  it('turns away a form returned in under three seconds', async () => {
    const fresh = issueFormToken(context.app.env.FORM_TOKEN_SECRET).token;
    const response = await postLead(lead({ formToken: fresh }));

    expect(response.statusCode).toBe(400);
    const body = problem(response);
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.details?.[0]?.message).toBe('too_fast');
    expect(await countLeads()).toBe(0);
  });

  it('turns away a timestamp somebody signed themselves', async () => {
    const forged = `${String(Math.floor(Date.now() / 1000) - 60)}.pretend-signature`;
    const response = await postLead(lead({ formToken: forged }));

    expect(response.statusCode).toBe(400);
    expect(await countLeads()).toBe(0);
  });

  it('tells a visitor whose page sat open all afternoon to fetch a new one', async () => {
    // The only failure that happens to real people, so it is the only one whose message is
    // written to be acted on — the client refetches instead of losing what was typed.
    const stale = agedFormToken(context.app, 3 * 60 * 60);
    const response = await postLead(lead({ formToken: stale }));

    expect(response.statusCode).toBe(400);
    const body = problem(response);
    expect(body.error.message).toMatch(/fetch a new token/i);
  });

  it('issues tokens from GET /forms/token that this endpoint later accepts', async () => {
    const issued = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/forms/token`,
    });
    expect(issued.statusCode).toBe(200);

    const { token, expiresInSeconds } = issued.json<{ token: string; expiresInSeconds: number }>();
    expect(token).toMatch(/^\d+\.[\w-]+$/);
    expect(expiresInSeconds).toBe(7200);
  });
});

describe('layer four — the duplicate window', () => {
  it('returns the first id and writes no second row', async () => {
    const first = await postLead(lead());
    const second = await postLead(lead());

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    const firstBody = first.json<{ leadId: number }>();
    const secondBody = second.json<{ leadId: number; isDuplicate: boolean }>();

    expect(secondBody.leadId).toBe(firstBody.leadId);
    expect(secondBody.isDuplicate).toBe(true);
    expect(await countLeads()).toBe(1);
  });

  it('does not collapse two different people', async () => {
    await postLead(lead({ phone: '+99365111111' }));
    await postLead(lead({ phone: '+99365222222' }));

    expect(await countLeads()).toBe(2);
  });

  it('lets the same person ask again after the window', async () => {
    await postLead(lead());
    // Age the first row past the fifteen minutes rather than waiting for them.
    await context.app.db
      .update(t.leads)
      .set({ createdAt: sql`DATE_SUB(NOW(), INTERVAL 20 MINUTE)` })
      .where(sql`1 = 1`);

    const again = await postLead(lead());
    expect(again.json<{ isDuplicate: boolean }>().isDuplicate).toBe(false);
    expect(await countLeads()).toBe(2);
  });

  it('keeps a tour question apart from a pilgrimage signup', async () => {
    // Two genuine intentions from one person, not a repeat, so the endpoint is part of the key.
    await postLead(lead({ phone: '+99365123456' }));
    const signup = await postSignup(signupBody({ phone: '+99365123456' }));

    expect(signup.statusCode).toBe(201);
    expect(signup.json<{ isDuplicate: boolean }>().isDuplicate).toBe(false);
  });
});

describe('layer five — the phone', () => {
  it('refuses something nobody can ring back', async () => {
    const response = await postLead(lead({ phone: 'позвоните мне' }));

    expect(response.statusCode).toBe(400);
    const body = problem(response);
    expect(body.error.details?.[0]?.path).toBe('phone');
    expect(await countLeads()).toBe(0);
  });
});

// ----------------------------------------------------------------------------------------
// Umrah signups
// ----------------------------------------------------------------------------------------

function signupBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fullName: 'Aýgül Berdiýewa',
    phone: '+993 65 654321',
    peopleCount: 2,
    roomType: 'double',
    consent: true,
    formToken: agedFormToken(context.app),
    ...overrides,
  };
}

async function postSignup(body: Record<string, unknown>, ip = freshAddress()) {
  return context.app.inject({
    method: 'POST',
    url: `${context.prefix}/umrah/signups`,
    headers: { 'x-forwarded-for': ip },
    payload: body,
  });
}

describe('signing up for the pilgrimage', () => {
  it('attaches to the open departure', async () => {
    const response = await postSignup(signupBody());
    expect(response.statusCode).toBe(201);

    const [row] = await context.app.db.select().from(t.umrahSignups).limit(1);
    expect(row?.tripId).toBeGreaterThan(0);
    expect(row?.status).toBe('new');
  });

  it('encrypts the passport number, and it never comes back out of the API', async () => {
    await postSignup(signupBody({ passportNumber: 'I-AŞ 1234567' }));

    const [row] = await context.app.db.select().from(t.umrahSignups).limit(1);

    // Decision D-18: a database dump, a backup or a stray SELECT yields ciphertext.
    expect(row?.passportNumber).not.toContain('1234567');
    expect(row?.passportNumber).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(open(row?.passportNumber ?? '', context.app.env.PASSPORT_ENCRYPTION_KEY)).toBe(
      'I-AŞ 1234567',
    );

    // And nothing public exposes it: there is no route that returns a signup at all in phase 3.
    const routes = context.app.registeredRoutes.filter((route) => route.url.includes('signups'));
    expect(routes.map((route) => route.method)).toEqual(['POST']);
  });

  it('records when consent was given, because retention is counted from a date', async () => {
    await postSignup(signupBody());

    const [row] = await context.app.db.select().from(t.umrahSignups).limit(1);
    expect(row?.consentAt).toBeInstanceOf(Date);
  });

  it('refuses without consent rather than assuming it', async () => {
    const response = await postSignup(signupBody({ consent: false }));
    expect(response.statusCode).toBe(400);
  });

  it('refuses once the list is closed, whatever the browser thinks', async () => {
    /*
     * A disabled button is a courtesy. A closed list that still accepts submissions produces
     * people who believe they are going, and that is discovered at an airport.
     */
    await context.app.db
      .update(t.umrahTrips)
      .set({ status: 'draft' })
      .where(and(eq(t.umrahTrips.isCurrent, true)));

    const response = await postSignup(signupBody({ phone: '+99365777777' }));
    expect(response.statusCode).toBe(409);
    expect(problem(response).error.code).toBe('conflict');

    await context.app.db
      .update(t.umrahTrips)
      .set({ status: 'open' })
      .where(and(eq(t.umrahTrips.isCurrent, true)));
  });

  it('has the same five layers as the other form', async () => {
    expect((await postSignup(signupBody({ website: 'bot' }))).statusCode).toBe(204);
    expect(
      (
        await postSignup(
          signupBody({ formToken: issueFormToken(context.app.env.FORM_TOKEN_SECRET).token }),
        )
      ).statusCode,
    ).toBe(400);
    expect((await postSignup(signupBody({ phone: 'gel' }))).statusCode).toBe(400);
  });
});
