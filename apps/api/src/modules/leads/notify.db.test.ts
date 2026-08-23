import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { agedFormToken, buildTestApp, recordingMailer, type TestApp } from '../../test/app';

/**
 * What the notification carries, and what it must never carry.
 *
 * Question Q-11 stayed open for six phases and decision D-50 held this back the whole time,
 * because a notification wired to the wrong address is worse than none. Now that it exists, the
 * three things worth holding it to are here: it fires once per genuine submission, it does not
 * fire for the duplicate that the fifteen-minute window collapses, and the message about a
 * pilgrimage says a passport was given without saying what it says.
 *
 * The last one is the one with teeth. The passport column is sealed with AES-256-GCM and read
 * only through an action that writes a row in `audit_log` (D-18, D-81); an inbox is the exact
 * opposite of that, and a helpful future edit to the message template is how the number would
 * end up there.
 */

let context: TestApp;
const mailer = recordingMailer();
let addressCounter = 0;

const freshAddress = (): string => {
  addressCounter += 1;
  return `203.0.114.${String(addressCounter % 250)}`;
};

beforeAll(async () => {
  context = await buildTestApp({ mailer });
}, 60_000);

afterEach(async () => {
  await context.pool.query('DELETE FROM leads');
  await context.pool.query('DELETE FROM umrah_signups');
  mailer.leads.length = 0;
  mailer.signups.length = 0;
});

afterAll(async () => {
  await context.close();
});

const post = async (url: string, payload: Record<string, unknown>) =>
  context.app.inject({
    method: 'POST',
    url: `${context.prefix}${url}`,
    headers: { 'x-forwarded-for': freshAddress() },
    payload,
  });

describe('the notification for a Global enquiry', () => {
  it('goes out once, with the phone as it was stored', async () => {
    const response = await post('/global/leads', {
      kind: 'question',
      name: '  Мерет Аннаев  ',
      // Deliberately messy: the notification has to show what the database holds, not what was
      // typed, or the number in the inbox and the number in the panel disagree.
      phone: '65 12 34 56',
      message: 'Расскажите про тур в Дарвазу',
      consent: true,
      formToken: agedFormToken(context.app),
    });

    expect(response.statusCode).toBe(201);
    expect(mailer.leads).toHaveLength(1);
    expect(mailer.leads[0]?.phone).toBe('+99365123456');
    expect(mailer.leads[0]?.name).toBe('Мерет Аннаев');
  });

  it('stays silent on the duplicate the window collapses', async () => {
    const body = {
      kind: 'question',
      name: 'Мерет Аннаев',
      phone: '+993 65 123456',
      message: 'Второй раз',
      consent: true,
      formToken: agedFormToken(context.app),
    };

    await post('/global/leads', body);
    await post('/global/leads', { ...body, formToken: agedFormToken(context.app) });

    // Two presses of one button are one enquiry. Two identical e-mails teach the reader to
    // stop opening them.
    expect(mailer.leads).toHaveLength(1);
  });

  it('says nothing at all when the honeypot was filled', async () => {
    const response = await post('/global/leads', {
      kind: 'question',
      name: 'bot',
      phone: '+993 65 123456',
      consent: true,
      website: 'https://example.com',
      formToken: agedFormToken(context.app),
    });

    expect(response.statusCode).toBe(204);
    expect(mailer.leads).toHaveLength(0);
  });
});

describe('the notification for a pilgrimage signup', () => {
  it('reports that a passport was given, and never the number', async () => {
    const passport = 'A1234567';

    const response = await post('/umrah/signups', {
      fullName: 'Meret Aýdogdyýew',
      phone: '+993 65 123456',
      peopleCount: 2,
      passportNumber: passport,
      consent: true,
      formToken: agedFormToken(context.app),
    });

    expect(response.statusCode).toBe(201);
    expect(mailer.signups).toHaveLength(1);

    const sent = mailer.signups[0];
    expect(sent?.hasPassport).toBe(true);
    // The whole object, flattened: a future field added to the notification cannot smuggle it
    // in either.
    expect(JSON.stringify(sent)).not.toContain(passport);
  });

  it('says so when no passport was given', async () => {
    await post('/umrah/signups', {
      fullName: 'Meret Aýdogdyýew',
      phone: '+993 65 123457',
      peopleCount: 1,
      consent: true,
      formToken: agedFormToken(context.app),
    });

    expect(mailer.signups[0]?.hasPassport).toBe(false);
  });
});
