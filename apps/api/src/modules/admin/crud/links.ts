import { adminOkResponse } from '@charva/contracts';
import { eq, inArray } from 'drizzle-orm';
import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as t from '../../../db/schema';
import { recordAudit } from '../../../lib/audit';
import { currentAdmin } from '../../../plugins/admin-auth';
import { auditContext } from '../context';

/**
 * The amenities of a hotel.
 *
 * The only join table in the schema, and the only thing in the admin that is not a row with an
 * identity. Bending the CRUD frame to address a composite key would have cost more than this
 * file, and it would have produced the wrong screen: nobody wants to create and delete link
 * rows one at a time. A hotel form has a list of checkboxes, and a list of checkboxes is a set
 * that gets replaced.
 *
 * Replaced, not merged: the request says what the hotel has, so unticking the last box is a
 * request that ends up meaning something, which a `POST` per addition never could.
 */

const params = z.object({ id: z.coerce.number().int().positive() });

const body = z.object({ amenityIds: z.array(z.number().int().positive()).max(60) }).strict();

export function registerLinkRoutes(instance: FastifyInstance): void {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  app.put(
    '/hotels/:id/amenities',
    {
      preHandler: app.requireAdmin('content.write'),
      schema: {
        tags: ['admin'],
        summary: "Replace a hotel's amenities with exactly this set",
        params,
        body,
        response: { 200: adminOkResponse },
      },
    },
    async (request) => {
      await replaceAmenities(app, request, request.params.id, request.body.amenityIds);
      return { ok: true as const };
    },
  );
}

async function replaceAmenities(
  app: FastifyInstance,
  request: FastifyRequest,
  hotelId: number,
  amenityIds: number[],
): Promise<void> {
  const actor = currentAdmin(request);
  const unique = [...new Set(amenityIds)];

  const before = await app.db
    .select({ amenityId: t.hotelAmenities.amenityId })
    .from(t.hotelAmenities)
    .where(eq(t.hotelAmenities.hotelId, hotelId));

  if (unique.length > 0) {
    // Every id has to name a real amenity, or the row becomes a link to nothing that no screen
    // will ever show and no query will ever join.
    const known = await app.db
      .select({ id: t.amenities.id })
      .from(t.amenities)
      .where(inArray(t.amenities.id, unique));

    if (known.length !== unique.length) {
      throw app.httpErrors.badRequest('One of those amenities does not exist');
    }
  }

  await app.db.transaction(async (tx) => {
    await tx.delete(t.hotelAmenities).where(eq(t.hotelAmenities.hotelId, hotelId));
    if (unique.length > 0) {
      await tx.insert(t.hotelAmenities).values(unique.map((amenityId) => ({ hotelId, amenityId })));
    }
  });

  await recordAudit(auditContext(app, request), {
    actorId: actor.id,
    action: 'update',
    entity: 'hotel_amenities',
    entityId: hotelId,
    before: before.map((row) => row.amenityId),
    after: unique,
    ip: request.ip,
  });

  app.responseCache.invalidate();
}
