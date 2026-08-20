import {
  type AdminGalleryRequest,
  adminGalleryRequest,
  adminOkResponse,
  MAX_GALLERY_ITEMS,
} from '@charva/contracts';
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

/**
 * The two galleries, written as sets.
 *
 * A tour and a hotel each show a handful of photographs beside their cover, and the editor's
 * act is «these ones, in this order» — not «create a row, then another». Twelve is the ceiling
 * and it is checked here because a CHECK constraint cannot count rows in another table.
 *
 * Both tables have the same three columns, so one handler serves both; what differs is which
 * column names the parent.
 */
const GALLERIES = {
  tours: { table: t.tourMedia, parent: t.tourMedia.tourId, entity: 'tour_media' },
  hotels: { table: t.hotelMedia, parent: t.hotelMedia.hotelId, entity: 'hotel_media' },
} as const;

export function registerLinkRoutes(instance: FastifyInstance): void {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  for (const [name, gallery] of Object.entries(GALLERIES)) {
    app.put(
      `/${name}/:id/gallery`,
      {
        preHandler: app.requireAdmin('content.write'),
        schema: {
          tags: ['admin'],
          summary: `Replace the photographs of one ${name === 'tours' ? 'tour' : 'hotel'}`,
          description:
            'The request is the whole gallery, so removing the last photograph means something. ' +
            `At most ${String(MAX_GALLERY_ITEMS)} items.`,
          params,
          body: adminGalleryRequest,
          response: { 200: adminOkResponse },
        },
      },
      async (request) => {
        await replaceGallery(app, request, gallery, request.params.id, request.body.items);
        return { ok: true as const };
      },
    );
  }

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

type Gallery = (typeof GALLERIES)[keyof typeof GALLERIES];

async function replaceGallery(
  app: FastifyInstance,
  request: FastifyRequest,
  gallery: Gallery,
  parentId: number,
  items: AdminGalleryRequest['items'],
): Promise<void> {
  const actor = currentAdmin(request);

  // The same photograph twice in one gallery is a mistake every time, and the unique index
  // would refuse the whole request rather than the duplicate — so it is dropped here, keeping
  // the first position it was given.
  const seen = new Set<number>();
  const unique = items.filter((item) => {
    if (seen.has(item.mediaId)) return false;
    seen.add(item.mediaId);
    return true;
  });

  if (unique.length > 0) {
    const known = await app.db
      .select({ id: t.media.id })
      .from(t.media)
      .where(
        inArray(
          t.media.id,
          unique.map((item) => item.mediaId),
        ),
      );

    if (known.length !== unique.length) {
      throw app.httpErrors.badRequest('One of those files does not exist');
    }
  }

  const before = await app.db
    .select({ mediaId: gallery.table.mediaId, sortOrder: gallery.table.sortOrder })
    .from(gallery.table)
    .where(eq(gallery.parent, parentId));

  await app.db.transaction(async (tx) => {
    await tx.delete(gallery.table).where(eq(gallery.parent, parentId));
    if (unique.length > 0) {
      await tx.insert(gallery.table).values(
        unique.map((item, index) => ({
          // One of two column names, decided by which gallery this is.
          ...(gallery.entity === 'tour_media' ? { tourId: parentId } : { hotelId: parentId }),
          mediaId: item.mediaId,
          caption: item.caption ?? null,
          // Position in the request is the order on the page: the editor arranged the tiles.
          sortOrder: index + 1,
        })),
      );
    }
  });

  await recordAudit(auditContext(app, request), {
    actorId: actor.id,
    action: 'update',
    entity: gallery.entity,
    entityId: parentId,
    before: before.map((row) => row.mediaId),
    after: unique.map((item) => item.mediaId),
    ip: request.ip,
  });

  app.responseCache.invalidate();
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
