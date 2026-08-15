import { and, desc, eq } from 'drizzle-orm';
import { type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as t from '../../../db/schema';
import { seal } from '../../../lib/secret-box';
import { agedFormToken, buildTestApp, problem, type TestApp } from '../../../test/app';

/**
 * The inbox, and the one field in this system that is worth an audit trail of its own.
 *
 * Passport numbers are encrypted in the column, absent from every list response, and readable
 * only by an action that states a reason and writes down who took it. Decision D-18. The tests
 * below are the ones that would fail if any of that quietly stopped being true — which is the
 * failure nobody notices, because everything still works.
 */

let context: TestApp;
let managerToken: string;

const PASSPORT = 'AB1234567';

beforeAll(async () => {
  context = await buildTestApp();
  managerToken = context.app.signAccessToken({ id: 9201, role: 'manager', siteScope: null }).token;
}, 60_000);

afterAll(async () => {
  await context.close();
});

function call(
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  options: { payload?: Record<string, unknown>; token?: string } = {},
): Promise<LightMyRequestResponse> {
  return context.app.inject({
    method,
    url: `${context.prefix}/admin${url}`,
    headers: { authorization: `Bearer ${options.token ?? context.admin.accessToken}` },
    ...(options.payload === undefined ? {} : { payload: options.payload }),
  });
}

/** A signup with a sealed passport, written the way the public form writes one. */
async function makeSignup(): Promise<number> {
  const [trip] = await context.app.db.select().from(t.umrahTrips).limit(1);
  const [result] = await context.app.db.insert(t.umrahSignups).values({
    tripId: trip!.id,
    fullName: 'Inbox Test',
    phone: '+99365123456',
    passportNumber: seal(PASSPORT, context.app.env.PASSPORT_ENCRYPTION_KEY),
    peopleCount: 2,
    locale: 'tm',
    consentAt: new Date(),
  });
  return result.insertId;
}

describe('enquiries', () => {
  it('shows what the public form wrote, newest first', async () => {
    const posted = await context.app.inject({
      method: 'POST',
      url: `${context.prefix}/global/leads`,
      payload: {
        kind: 'question',
        name: 'Инбокс Тест',
        phone: '+99312345678',
        message: 'Здравствуйте',
        consent: true,
        formToken: agedFormToken(context.app),
      },
    });
    expect(posted.statusCode, posted.body).toBe(201);

    const response = await call('GET', '/leads?perPage=5');
    expect(response.statusCode, response.body).toBe(200);

    const body = response.json<{ items: { name: string; status: string }[] }>();
    expect(body.items[0]?.name).toBe('Инбокс Тест');
    expect(body.items[0]?.status).toBe('new');
  });

  it('lets a manager move one along and write a note', async () => {
    const { items } = (await call('GET', '/leads?perPage=1')).json<{ items: { id: number }[] }>();

    const response = await call('PATCH', `/leads/${String(items[0]?.id)}`, {
      payload: { status: 'in_progress', adminNotes: 'Перезвонить после обеда' },
      token: managerToken,
    });

    // The manager is the role that exists for this. Content they may read and not write; the
    // inbox is the other way round.
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ status: string }>().status).toBe('in_progress');
  });
});

describe('signups', () => {
  it('never puts the passport number in a list', async () => {
    await makeSignup();

    const response = await call('GET', '/umrah_signups?perPage=10');
    expect(response.statusCode).toBe(200);

    // Not «is absent from this row» but «is absent from the bytes»: the schema is the
    // serialiser, so there is no field for it to travel in at any privilege level.
    expect(response.body).not.toContain(PASSPORT);
    expect(response.body).not.toContain('passportNumber');

    const body = response.json<{ items: { hasPassport: boolean }[] }>();
    expect(body.items.some((item) => item.hasPassport)).toBe(true);
  });
});

describe('revealing a passport', () => {
  it('hands it over, and writes down who asked and why', async () => {
    const id = await makeSignup();

    const response = await call('POST', `/umrah_signups/${String(id)}/passport`, {
      payload: { reason: 'Оформление визы, заявка подтверждена' },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ passportNumber: string }>().passportNumber).toBe(PASSPORT);

    const [logged] = await context.app.db
      .select()
      .from(t.auditLog)
      .where(and(eq(t.auditLog.action, 'reveal_passport'), eq(t.auditLog.entityId, String(id))))
      .orderBy(desc(t.auditLog.id))
      .limit(1);

    expect(logged?.actorId).toBe(context.admin.id);
    expect((logged?.after as { reason: string }).reason).toContain('визы');
    // «Who looked at it» is asked after an incident, so the row has to exist before one.
    expect(logged?.ipHash).not.toBeNull();
  });

  it('refuses a manager, and says so as forbidden rather than as not found', async () => {
    const id = await makeSignup();

    const response = await call('POST', `/umrah_signups/${String(id)}/passport`, {
      payload: { reason: 'Просто посмотреть' },
      token: managerToken,
    });

    // The default answer to Q-14. Moving it is one line in the grant table in contracts.
    expect(response.statusCode).toBe(403);
    expect(problem(response).error.code).toBe('forbidden');
  });

  it('will not be asked without a reason', async () => {
    const id = await makeSignup();

    const response = await call('POST', `/umrah_signups/${String(id)}/passport`, {
      payload: { reason: '' },
    });

    // A log of «somebody read this» with no «because» is a log that answers nothing when it is
    // finally read.
    expect(response.statusCode).toBe(400);
  });

  it('says plainly when a number was sealed with a different key', async () => {
    const [trip] = await context.app.db.select().from(t.umrahTrips).limit(1);
    const [inserted] = await context.app.db.insert(t.umrahSignups).values({
      tripId: trip!.id,
      fullName: 'Wrong Key',
      phone: '+99365000001',
      passportNumber: seal(PASSPORT, 'ff'.repeat(32)),
      peopleCount: 1,
      locale: 'tm',
    });

    const response = await call('POST', `/umrah_signups/${String(inserted.insertId)}/passport`, {
      payload: { reason: 'Проверка' },
    });

    // The alternative reading — «this person gave no passport» — is false, and somebody would
    // act on it by ringing to ask for a number that was given months ago.
    expect(response.statusCode).toBe(409);
    expect(problem(response).error.message).toContain('another one');
  });
});
