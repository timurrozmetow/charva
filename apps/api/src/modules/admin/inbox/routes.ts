import {
  adminLeadPatch,
  adminLeadSchema,
  adminLeadsResponse,
  adminPassportResponse,
  adminRevealPassportRequest,
  adminSignupPatch,
  adminSignupSchema,
  adminSignupsResponse,
  LEAD_STATUSES,
  SIGNUP_STATUSES,
} from '@charva/contracts';
import { and, desc, eq, like, or, type SQL, sql } from 'drizzle-orm';
import { type FastifyInstance } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as t from '../../../db/schema';
import { recordAudit } from '../../../lib/audit';
import { hashIp } from '../../../lib/hash';
import { open } from '../../../lib/secret-box';
import { currentAdmin } from '../../../plugins/admin-auth';
import { ApiProblem, notFound } from '../../../plugins/error-handler';
import { auditContext } from '../context';

/**
 * What the forms produced, and the one field that is not simply displayed.
 *
 * Everything a visitor submits already lands in the database — phase 3 finished that — and until
 * now the only way to read it was `SELECT * FROM leads`. This is the screen that replaces that,
 * and it is also why question Q-11 stopped being urgent: a manager who can see the inbox is not
 * blind while the notification channel goes unanswered.
 *
 * Passport numbers are the exception to everything else here. They are encrypted in the column,
 * absent from every list, readable only by an explicit action that states a reason, and every
 * read writes a row naming who did it and when. Decision D-18. Who is allowed to is question
 * Q-14, and until it is answered the answer is: the owner.
 */
export function registerInboxRoutes(instance: FastifyInstance): void {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  const listQuery = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      perPage: z.coerce.number().int().min(1).max(200).default(25),
      status: z.string().max(20).optional(),
      /** Name, phone or email. What somebody has in front of them when the phone rings. */
      q: z.string().max(120).optional(),
    })
    .strict();

  app.get(
    '/leads',
    {
      preHandler: app.requireAdmin('leads.read'),
      schema: {
        tags: ['admin'],
        summary: 'Enquiries from both Global forms and the builder',
        querystring: listQuery,
        response: { 200: adminLeadsResponse },
      },
    },
    async (request) => {
      const { page, perPage, status, q } = request.query;
      const conditions: SQL[] = [];

      if (status !== undefined && (LEAD_STATUSES as readonly string[]).includes(status)) {
        conditions.push(eq(t.leads.status, status as (typeof LEAD_STATUSES)[number]));
      }
      if (q !== undefined && q.trim() !== '') {
        const pattern = `%${q.trim()}%`;
        const search = or(
          like(t.leads.name, pattern),
          like(t.leads.phone, pattern),
          like(t.leads.email, pattern),
        );
        if (search !== undefined) conditions.push(search);
      }

      const where = conditions.length === 0 ? undefined : and(...conditions);

      const rows = await app.db
        .select()
        .from(t.leads)
        .where(where)
        // Newest first, always. An inbox ordered any other way is a list somebody has to search
        // to find what arrived this morning.
        .orderBy(desc(t.leads.createdAt), desc(t.leads.id))
        .limit(perPage)
        .offset((page - 1) * perPage);

      const [counted] = await app.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(t.leads)
        .where(where);

      return {
        items: rows.map(presentLead),
        meta: pageMeta(page, perPage, counted?.total ?? 0, rows.length),
      };
    },
  );

  app.patch(
    '/leads/:id',
    {
      preHandler: app.requireAdmin('leads.write'),
      schema: {
        tags: ['admin'],
        summary: 'Move an enquiry along, or write a note on it',
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: adminLeadPatch,
        response: { 200: adminLeadSchema },
      },
    },
    async (request) => {
      const [before] = await app.db
        .select()
        .from(t.leads)
        .where(eq(t.leads.id, request.params.id))
        .limit(1);

      if (before === undefined) throw notFound(`lead #${String(request.params.id)}`);

      await app.db.update(t.leads).set(request.body).where(eq(t.leads.id, before.id));

      await recordAudit(auditContext(app, request), {
        actorId: currentAdmin(request).id,
        action: 'update',
        entity: 'leads',
        entityId: before.id,
        before: { status: before.status },
        after: { status: request.body.status ?? before.status },
        ip: request.ip,
      });

      const [after] = await app.db.select().from(t.leads).where(eq(t.leads.id, before.id)).limit(1);
      if (after === undefined) throw notFound(`lead #${String(before.id)}`);

      return presentLead(after);
    },
  );

  app.get(
    '/umrah_signups',
    {
      preHandler: app.requireAdmin('leads.read'),
      schema: {
        tags: ['admin'],
        summary: 'Places taken on the pilgrimage',
        description:
          'The passport number is not in this response and cannot be — it is not in the ' +
          'schema, and the schema is the serialiser. `hasPassport` says whether there is one ' +
          'to ask for.',
        querystring: listQuery.extend({ tripId: z.coerce.number().int().positive().optional() }),
        response: { 200: adminSignupsResponse },
      },
    },
    async (request) => {
      const { page, perPage, status, q, tripId } = request.query;
      const conditions: SQL[] = [];

      if (tripId !== undefined) conditions.push(eq(t.umrahSignups.tripId, tripId));
      if (status !== undefined && (SIGNUP_STATUSES as readonly string[]).includes(status)) {
        conditions.push(eq(t.umrahSignups.status, status as (typeof SIGNUP_STATUSES)[number]));
      }
      if (q !== undefined && q.trim() !== '') {
        const pattern = `%${q.trim()}%`;
        const search = or(
          like(t.umrahSignups.fullName, pattern),
          like(t.umrahSignups.phone, pattern),
        );
        if (search !== undefined) conditions.push(search);
      }

      const where = conditions.length === 0 ? undefined : and(...conditions);

      const rows = await app.db
        .select()
        .from(t.umrahSignups)
        .where(where)
        .orderBy(desc(t.umrahSignups.createdAt), desc(t.umrahSignups.id))
        .limit(perPage)
        .offset((page - 1) * perPage);

      const [counted] = await app.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(t.umrahSignups)
        .where(where);

      return {
        items: rows.map(presentSignup),
        meta: pageMeta(page, perPage, counted?.total ?? 0, rows.length),
      };
    },
  );

  app.patch(
    '/umrah_signups/:id',
    {
      preHandler: app.requireAdmin('leads.write'),
      schema: {
        tags: ['admin'],
        summary: 'Move a signup along, or write a note on it',
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: adminSignupPatch,
        response: { 200: adminSignupSchema },
      },
    },
    async (request) => {
      const [before] = await app.db
        .select()
        .from(t.umrahSignups)
        .where(eq(t.umrahSignups.id, request.params.id))
        .limit(1);

      if (before === undefined) throw notFound(`signup #${String(request.params.id)}`);

      await app.db.update(t.umrahSignups).set(request.body).where(eq(t.umrahSignups.id, before.id));

      await recordAudit(auditContext(app, request), {
        actorId: currentAdmin(request).id,
        action: 'update',
        entity: 'umrah_signups',
        entityId: before.id,
        before: { status: before.status },
        after: { status: request.body.status ?? before.status },
        ip: request.ip,
      });

      const [after] = await app.db
        .select()
        .from(t.umrahSignups)
        .where(eq(t.umrahSignups.id, before.id))
        .limit(1);
      if (after === undefined) throw notFound(`signup #${String(before.id)}`);

      return presentSignup(after);
    },
  );

  app.post(
    '/umrah_signups/:id/passport',
    {
      // The one capability no role but `owner` has. Q-14 can move it; one line in contracts.
      preHandler: app.requireAdmin('passport.reveal'),
      schema: {
        tags: ['admin'],
        summary: 'Decrypt one passport number, and write down that it happened',
        description:
          'Decision D-18. The number is the most sensitive thing this system holds, and «who ' +
          'looked at it» is a question asked after an incident, not before — so it cannot be ' +
          'answered unless the row was written at the time. A reason is required and stored ' +
          'beside the reader.',
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: adminRevealPassportRequest,
        response: { 200: adminPassportResponse },
      },
    },
    async (request) => {
      const [row] = await app.db
        .select()
        .from(t.umrahSignups)
        .where(eq(t.umrahSignups.id, request.params.id))
        .limit(1);

      if (row === undefined) throw notFound(`signup #${String(request.params.id)}`);
      if (row.passportNumber === null || row.passportNumber === '') {
        throw notFound('a passport number on that signup');
      }

      let passportNumber: string;
      try {
        passportNumber = open(row.passportNumber, app.env.PASSPORT_ENCRYPTION_KEY);
      } catch {
        // A key that no longer matches the ciphertext. Said plainly, because the alternative
        // reading — «this person gave no passport» — is false and would be acted on.
        throw new ApiProblem(
          'conflict',
          'That number cannot be decrypted with the current key. It was sealed with another one.',
        );
      }

      const recordedAt = new Date();

      /*
       * Logged before it is returned, and awaited.
       *
       * Every other audit row in this codebase is best-effort — a failed log must not turn a
       * completed edit into an error. This one is the opposite: if the record cannot be written,
       * the number is not handed over, because an unrecorded read is the exact thing D-18 exists
       * to prevent.
       */
      await app.db.insert(t.auditLog).values({
        actorId: currentAdmin(request).id,
        action: 'reveal_passport',
        entity: 'umrah_signups',
        entityId: String(row.id),
        after: { reason: request.body.reason, signup: row.fullName },
        ipHash: hashIp(request.ip, app.env.IP_HASH_SECRET),
        createdAt: recordedAt,
      });

      return { passportNumber, recordedAt: recordedAt.toISOString() };
    },
  );
}

/** One shape for a lead, so the list and the patch response cannot drift apart. */
function presentLead(row: typeof t.leads.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    phone: row.phone,
    email: row.email,
    guests: row.guests,
    topics: row.topics,
    message: row.message,
    locale: row.locale,
    consentAt: row.consentAt?.toISOString() ?? null,
    selection: row.selection ?? null,
    quoteSnapshot: row.quoteSnapshot ?? null,
    status: row.status,
    adminNotes: row.adminNotes,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * And one for a signup.
 *
 * Note what is not in it. The passport number is absent here *and* absent from the response
 * schema, so adding it back would take two deliberate edits in two files — which is the point.
 */
function presentSignup(row: typeof t.umrahSignups.$inferSelect) {
  return {
    id: row.id,
    tripId: row.tripId,
    fullName: row.fullName,
    phone: row.phone,
    hasPassport: row.passportNumber !== null && row.passportNumber !== '',
    peopleCount: row.peopleCount,
    roomType: row.roomType,
    comment: row.comment,
    locale: row.locale,
    consentAt: row.consentAt?.toISOString() ?? null,
    status: row.status,
    adminNotes: row.adminNotes,
    createdAt: row.createdAt.toISOString(),
  };
}

function pageMeta(page: number, perPage: number, total: number, returned: number) {
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    hasMore: (page - 1) * perPage + returned < total,
  };
}
