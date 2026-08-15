import {
  adminAttachSlotRequest,
  adminMediaListResponse,
  adminMediaPatch,
  adminMediaSchema,
  adminOkResponse,
  adminSlotsResponse,
  adminUploadResponse,
} from '@charva/contracts';
import multipart from '@fastify/multipart';
import { and, asc, desc, eq, isNotNull, isNull, like, or, sql, type SQL } from 'drizzle-orm';
import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as t from '../../../db/schema';
import { recordAudit } from '../../../lib/audit';
import { mediaUrl } from '../../../lib/serialize';
import { currentAdmin } from '../../../plugins/admin-auth';
import { ApiProblem, notFound } from '../../../plugins/error-handler';
import { auditContext } from '../context';

import { type MediaContext, type MediaRow, storeUpload } from './service';

/**
 * The library, and the checklist it exists to fill.
 *
 * Media is not in the CRUD registry because none of it looks like a form: a file arrives as
 * multipart, is identified by its bytes, is converted, and produces a row nobody typed. The
 * slots screen is the other half — 174 briefs with a status, which is what makes «there are no
 * photographs» a list somebody can work through rather than a sentence in a risk table.
 */

export async function registerMediaRoutes(instance: FastifyInstance): Promise<void> {
  const app = instance.withTypeProvider<ZodTypeProvider>();
  const { env } = app;

  await app.register(multipart, {
    limits: {
      // The video ceiling, because one parser serves both; the image limit is checked below,
      // against the part that actually arrived.
      fileSize: env.MAX_VIDEO_UPLOAD_MB * 1024 * 1024,
      files: 1,
    },
  });

  const present = (row: MediaRow) => ({
    id: row.id,
    storageKey: row.storageKey,
    url: mediaUrl(row.storageKey, env.PUBLIC_MEDIA_BASE_URL),
    mime: row.mime,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    durationSec: row.durationSec,
    lqip: row.lqip,
    focalX: row.focalX,
    focalY: row.focalY,
    alt: row.alt ?? null,
    source: row.source,
    attribution: row.attribution,
    license: row.license,
    isPlaceholder: row.isPlaceholder,
    createdAt: row.createdAt.toISOString(),
  });

  const mediaContext = (request: FastifyRequest): MediaContext => ({
    db: app.db,
    audit: auditContext(app, request),
    actor: currentAdmin(request),
    ip: request.ip,
    uploadsDir: env.UPLOADS_DIR,
    ffmpegPath: env.FFMPEG_PATH,
    ffprobePath: env.FFPROBE_PATH,
  });

  app.post(
    '/media',
    {
      preHandler: app.requireAdmin('media.write'),
      schema: {
        tags: ['admin'],
        summary: 'Upload a photograph or a video',
        description:
          "The type is read from the first bytes, never from the browser's Content-Type. EXIF " +
          'is dropped — these are photographs of pilgrims and EXIF carries GPS. The same file ' +
          'twice is one row. Video is transcoded once to 720p with a poster frame beside it.',
        consumes: ['multipart/form-data'],
        response: { 201: adminUploadResponse },
      },
    },
    async (request, reply) => {
      const part = await request.file();
      if (part === undefined) throw new ApiProblem('validation_failed', 'No file in the request');

      const buffer = await part.toBuffer();

      if (part.file.truncated) {
        throw new ApiProblem(
          'unsupported_media',
          `That file is larger than ${String(env.MAX_VIDEO_UPLOAD_MB)} MB`,
        );
      }

      const result = await storeUpload(mediaContext(request), {
        filename: part.filename,
        buffer,
      });

      // The image ceiling is separate and smaller: a photograph over twenty megabytes is a
      // mistake, while a video of that size is a short clip.
      if (
        result.media.mime.startsWith('image/') &&
        buffer.byteLength > env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024
      ) {
        throw new ApiProblem(
          'unsupported_media',
          `Images are limited to ${String(env.MAX_IMAGE_UPLOAD_MB)} MB`,
        );
      }

      return reply.code(201).send({
        media: present(result.media),
        poster: result.poster === null ? null : present(result.poster),
        isDuplicate: result.isDuplicate,
      });
    },
  );

  app.get(
    '/media',
    {
      preHandler: app.requireAdmin('content.read'),
      schema: {
        tags: ['admin'],
        summary: 'The library',
        querystring: z
          .object({
            page: z.coerce.number().int().min(1).default(1),
            perPage: z.coerce.number().int().min(1).max(200).default(48),
            kind: z.enum(['image', 'video']).optional(),
            /** Only the ones that must not reach production — decision D-25. */
            placeholders: z.enum(['true', 'false']).optional(),
            q: z.string().max(120).optional(),
          })
          .strict(),
        response: { 200: adminMediaListResponse },
      },
    },
    async (request) => {
      const { page, perPage, kind, placeholders, q } = request.query;
      const conditions: SQL[] = [];

      if (kind !== undefined) conditions.push(like(t.media.mime, `${kind}/%`));
      if (placeholders !== undefined)
        conditions.push(eq(t.media.isPlaceholder, placeholders === 'true'));
      if (q !== undefined && q.trim() !== '') {
        const pattern = `%${q.trim()}%`;
        const search = or(
          like(t.media.storageKey, pattern),
          sql`JSON_UNQUOTE(JSON_EXTRACT(${t.media.alt}, '$."ru"')) LIKE ${pattern}`,
        );
        if (search !== undefined) conditions.push(search);
      }

      const where = conditions.length === 0 ? undefined : and(...conditions);

      const rows = await app.db
        .select()
        .from(t.media)
        .where(where)
        .orderBy(desc(t.media.id))
        .limit(perPage)
        .offset((page - 1) * perPage);

      const [counted] = await app.db
        .select({ total: sql<number>`COUNT(*)` })
        .from(t.media)
        .where(where);

      const total = counted?.total ?? 0;

      return {
        items: rows.map(present),
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
          hasMore: (page - 1) * perPage + rows.length < total,
        },
      };
    },
  );

  app.patch(
    '/media/:id',
    {
      preHandler: app.requireAdmin('media.write'),
      schema: {
        tags: ['admin'],
        summary: 'Alternative text, focal point, credit',
        description:
          'Alternative text is per language and is what a screen reader reads. It is edited ' +
          'here rather than on the slot, because one photograph can appear in several places ' +
          'and describing it twice is how the descriptions come to disagree.',
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: adminMediaPatch,
        response: { 200: adminMediaSchema },
      },
    },
    async (request) => {
      const before = await loadMedia(app, request.params.id);
      await app.db.update(t.media).set(request.body).where(eq(t.media.id, before.id));
      const after = await loadMedia(app, before.id);

      await recordAudit(auditContext(app, request), {
        actorId: currentAdmin(request).id,
        action: 'update',
        entity: 'media',
        entityId: before.id,
        before: { alt: before.alt, focalX: before.focalX, isPlaceholder: before.isPlaceholder },
        after: { alt: after.alt, focalX: after.focalX, isPlaceholder: after.isPlaceholder },
        ip: request.ip,
      });
      app.responseCache.invalidate();

      return present(after);
    },
  );

  app.delete(
    '/media/:id',
    {
      preHandler: app.requireAdmin('media.write'),
      schema: {
        tags: ['admin'],
        summary: 'Remove a file from the library',
        description:
          'Refused while anything still points at it. A dangling `media_id` renders as a hole ' +
          'on a public page, and the editor deleting it is the only person who knows whether ' +
          'that page still needs a picture.',
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: { 200: adminOkResponse },
      },
    },
    async (request) => {
      const row = await loadMedia(app, request.params.id);
      const uses = await countReferences(app, row.id);

      if (uses > 0) {
        throw new ApiProblem('conflict', `Still used in ${String(uses)} place(s)`, [
          { path: 'references', message: String(uses) },
        ]);
      }

      await app.db.delete(t.media).where(eq(t.media.id, row.id));
      await recordAudit(auditContext(app, request), {
        actorId: currentAdmin(request).id,
        action: 'delete',
        entity: 'media',
        entityId: row.id,
        before: { storageKey: row.storageKey, mime: row.mime },
        ip: request.ip,
      });
      app.responseCache.invalidate();

      /*
       * The file on disk is left where it is.
       *
       * `uploads/` is content-addressed — the name is the checksum — so an orphan costs disk and
       * nothing else, while an unlink that runs before a mistake is noticed costs the original.
       * Sweeping them is a maintenance script, not a side effect of a click.
       */
      return { ok: true as const };
    },
  );

  // ---- The checklist ----------------------------------------------------------------------

  app.get(
    '/content_slots',
    {
      preHandler: app.requireAdmin('content.read'),
      schema: {
        tags: ['admin'],
        summary: 'The 174 photographs the design asks for, with what is in each',
        querystring: z
          .object({
            page: z.coerce.number().int().min(1).default(1),
            perPage: z.coerce.number().int().min(1).max(200).default(50),
            site: z.enum(['choice', 'global', 'umrah']).optional(),
            page_name: z.string().max(60).optional(),
            status: z.enum(['filled', 'empty']).optional(),
          })
          .strict(),
        response: { 200: adminSlotsResponse },
      },
    },
    async (request) => {
      const { page, perPage, site, page_name: pageName, status } = request.query;
      const actor = currentAdmin(request);
      const conditions: SQL[] = [];

      if (site !== undefined) conditions.push(eq(t.contentSlots.site, site));
      // A scoped editor sees their own site's briefs, the same way they see their own rows.
      else if (actor.siteScope !== null) conditions.push(eq(t.contentSlots.site, actor.siteScope));

      if (pageName !== undefined) conditions.push(eq(t.contentSlots.page, pageName));
      if (status === 'filled') conditions.push(isNotNull(t.contentSlots.mediaId));
      if (status === 'empty') conditions.push(isNull(t.contentSlots.mediaId));

      const where = conditions.length === 0 ? undefined : and(...conditions);

      const rows = await app.db
        .select({ slot: t.contentSlots, media: t.media })
        .from(t.contentSlots)
        .leftJoin(t.media, eq(t.media.id, t.contentSlots.mediaId))
        .where(where)
        .orderBy(asc(t.contentSlots.site), asc(t.contentSlots.page), asc(t.contentSlots.sortOrder))
        .limit(perPage)
        .offset((page - 1) * perPage);

      const [counted] = await app.db
        .select({
          total: sql<number>`COUNT(*)`,
          filled: sql<number>`SUM(${t.contentSlots.mediaId} IS NOT NULL)`,
        })
        .from(t.contentSlots)
        .where(where);

      const total = counted?.total ?? 0;

      return {
        items: rows.map(({ slot, media }) => ({
          id: slot.id,
          site: slot.site,
          page: slot.page,
          slotKey: slot.slotKey,
          brief: slot.brief,
          recommendedWidth: slot.recommendedWidth,
          recommendedHeight: slot.recommendedHeight,
          sortOrder: slot.sortOrder,
          media: media === null ? null : present(media),
        })),
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
          hasMore: (page - 1) * perPage + rows.length < total,
        },
        // Counted over the same filter, so «12 of 63 on Umrah» is about what is on screen.
        /*
         * `Number()` on a value already typed as a number, on purpose.
         *
         * `SUM()` in MySQL returns DECIMAL, and mysql2 hands a DECIMAL over as a *string* to
         * keep its precision — so the `sql<number>` annotation above is a claim about intent
         * rather than about the runtime. Without this the response fails its own schema, which
         * is exactly what it did before the test below was run.
         */
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
        progress: { filled: Number(counted?.filled ?? 0), total },
      };
    },
  );

  app.put(
    '/content_slots/:id/media',
    {
      preHandler: app.requireAdmin('media.write'),
      schema: {
        tags: ['admin'],
        summary: 'Put a photograph in a slot, or take it out',
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: adminAttachSlotRequest,
        response: { 200: adminOkResponse },
      },
    },
    async (request) => {
      const [slot] = await app.db
        .select()
        .from(t.contentSlots)
        .where(eq(t.contentSlots.id, request.params.id))
        .limit(1);

      if (slot === undefined) throw notFound(`slot #${String(request.params.id)}`);

      const { mediaId } = request.body;
      if (mediaId !== null) await loadMedia(app, mediaId);

      await app.db.update(t.contentSlots).set({ mediaId }).where(eq(t.contentSlots.id, slot.id));

      await recordAudit(auditContext(app, request), {
        actorId: currentAdmin(request).id,
        action: 'attach_slot',
        entity: 'content_slots',
        entityId: slot.id,
        before: { mediaId: slot.mediaId },
        after: { mediaId, slotKey: slot.slotKey },
        ip: request.ip,
      });
      app.responseCache.invalidate();

      return { ok: true as const };
    },
  );
}

async function loadMedia(app: FastifyInstance, id: number): Promise<MediaRow> {
  const [row] = await app.db.select().from(t.media).where(eq(t.media.id, id)).limit(1);
  if (row === undefined) throw notFound(`media #${String(id)}`);
  return row;
}

/**
 * Everything that could be pointing at a file.
 *
 * Written out rather than derived, because MySQL has no foreign keys here to ask: the schema
 * carries `media_id` columns without constraints, so this list is the only thing that knows.
 */
async function countReferences(app: FastifyInstance, mediaId: number): Promise<number> {
  const columns = [
    t.contentSlots.mediaId,
    t.contentBlocks.mediaId,
    t.tours.coverMediaId,
    t.tourDays.mediaId,
    t.tourMedia.mediaId,
    t.hotels.coverMediaId,
    t.articles.coverMediaId,
    t.galleryItems.mediaId,
    t.videos.mediaId,
    t.videos.posterMediaId,
    t.reviews.avatarMediaId,
    t.placesToSee.coverMediaId,
    t.ziyaratPlaces.coverMediaId,
    t.umrahProgramDays.mediaId,
    t.umrahGroups.coverMediaId,
    t.umrahGroupMedia.mediaId,
    t.umrahGroupMedia.posterMediaId,
  ];

  let total = 0;
  for (const column of columns) {
    const [row] = await app.db
      .select({ used: sql<number>`COUNT(*)` })
      .from(column.table)
      .where(eq(column, mediaId));
    total += row?.used ?? 0;
  }

  return total;
}
