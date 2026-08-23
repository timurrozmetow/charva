import {
  formTokenResponse,
  leadRequest,
  leadResponse,
  umrahSignupRequest,
  umrahSignupResponse,
} from '@charva/contracts';
import { type FastifyPluginAsync, type FastifyReply, type FastifyRequest } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { issueFormToken } from '../../lib/form-token';
import { localePlugin } from '../../plugins/locale';

import { type LeadOutcome, submitLead, submitSignup } from './service';

/**
 * The two forms.
 *
 * Layer one of the five lives here as route configuration: five submissions per address per ten
 * minutes, against the generous ceiling every read route gets. It is keyed on the address rather
 * than on a session, which is why `trustProxy` is on — behind nginx, without it, every visitor
 * would be 127.0.0.1 and the per-address limit would be one global limit.
 *
 * The other four layers are in the service, in the order that keeps them cheap: honeypot,
 * signed timestamp, duplicate window, phone.
 */
export const leadRoutes: FastifyPluginAsync = async (instance) => {
  const root = instance.withTypeProvider<ZodTypeProvider>();
  const { env } = root;

  const formLimit = {
    rateLimit: {
      max: env.LEAD_RATE_LIMIT_MAX,
      timeWindow: `${String(env.LEAD_RATE_LIMIT_WINDOW_MINUTES)} minutes`,
    },
  } as const;

  root.get(
    '/forms/token',
    {
      schema: {
        tags: ['forms'],
        summary: 'A signed timestamp, to be sent back with the form',
        description:
          'Anti-spam layer three. The server stores nothing: it re-computes the HMAC on ' +
          'submission, so the timestamp is either one it signed or it is not. A form returned ' +
          'in under three seconds was not typed by a person; one returned after two hours was ' +
          'filled against a page that has been open too long.',
        response: { 200: formTokenResponse },
      },
    },
    () => issueFormToken(env.FORM_TOKEN_SECRET),
  );

  /**
   * A filled honeypot answers 204 and writes nothing.
   *
   * Never an error, and never a message: an error message is a lesson, and a bot told which
   * field betrayed it will get that field right next time.
   */
  const answer = (reply: FastifyReply, outcome: LeadOutcome, idKey: 'leadId' | 'signupId') => {
    if (outcome.kind === 'honeypot') return reply.code(204).send();
    return reply.code(201).send({ [idKey]: outcome.id, isDuplicate: outcome.isDuplicate });
  };

  const meta = (request: FastifyRequest) => ({
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    locale: request.lang,
    formTokenSecret: env.FORM_TOKEN_SECRET,
    ipHashSecret: env.IP_HASH_SECRET,
  });

  await instance.register(async (scope) => {
    const app = scope.withTypeProvider<ZodTypeProvider>();
    await app.register(localePlugin, { site: 'global' });

    app.post(
      '/global/leads',
      {
        config: formLimit,
        schema: {
          tags: ['forms'],
          summary: 'A tour enquiry or a question',
          description:
            'Never accepts a price. When a builder selection is attached the server prices it ' +
            'from the database and stores that in `quote_snapshot` — a total that arrived from ' +
            'a browser is a total the sender chose. A second submission from the same phone ' +
            'inside fifteen minutes returns the first lead id and writes no second row.',
          body: leadRequest,
          response: {
            201: leadResponse,
            /** Honeypot. No body, and deliberately indistinguishable from having worked. */
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const outcome = await submitLead(app.db, request.body, meta(request));

        // After the row, never before it, and never awaited into the response: a lead that
        // reached the database is a lead the business has, whether or not the relay answered.
        // A duplicate inside the fifteen-minute window announces nothing — it is the same
        // person pressing the button twice, and two identical e-mails teach the reader to
        // ignore the first (D-50).
        if (outcome.kind === 'stored' && !outcome.isDuplicate) {
          void app.mailer.lead({
            id: outcome.id,
            kind: request.body.kind,
            name: request.body.name.trim(),
            phone: outcome.phone ?? request.body.phone,
            email: request.body.email ?? null,
            guests: request.body.guests ?? null,
            topics: request.body.topics ?? null,
            message: request.body.message ?? null,
            locale: request.lang,
            quote: outcome.quote ?? null,
          });
        }

        return answer(reply, outcome, 'leadId');
      },
    );
  });

  await instance.register(async (scope) => {
    const app = scope.withTypeProvider<ZodTypeProvider>();
    await app.register(localePlugin, { site: 'umrah' });

    app.post(
      '/umrah/signups',
      {
        config: formLimit,
        schema: {
          tags: ['forms'],
          summary: 'A place on the pilgrimage',
          description:
            'The passport number is encrypted with AES-256-GCM before it reaches the column ' +
            '(D-18) and is returned by nothing. Refused with 409 unless a departure is ' +
            'genuinely open: a disabled button in the browser is a courtesy, and a closed list ' +
            'that still accepts submissions produces people who believe they are going.',
          body: umrahSignupRequest,
          response: { 201: umrahSignupResponse, 204: z.null() },
        },
      },
      async (request, reply) => {
        const outcome = await submitSignup(app.db, request.body, {
          ...meta(request),
          passportKey: env.PASSPORT_ENCRYPTION_KEY,
        });

        if (outcome.kind === 'stored' && !outcome.isDuplicate) {
          void app.mailer.signup({
            id: outcome.id,
            fullName: request.body.fullName.trim(),
            phone: outcome.phone ?? request.body.phone,
            peopleCount: request.body.peopleCount,
            roomType: request.body.roomType ?? null,
            comment: request.body.comment ?? null,
            locale: request.lang,
            // Whether, not what. The number is sealed in the column and read only through an
            // audited action (D-18); an inbox is the one place it must never end up.
            hasPassport: request.body.passportNumber !== undefined,
            departsAt: outcome.departsAt ?? null,
          });
        }

        return answer(reply, outcome, 'signupId');
      },
    );
  });
};
