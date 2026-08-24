import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

import { creditsResponse, IMAGE_WIDTHS } from '@charva/contracts';
import staticFiles from '@fastify/static';
import { eq } from 'drizzle-orm';
import { type FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import sharp from 'sharp';
import { z } from 'zod';

import * as t from '../../db/schema';
import { ApiProblem } from '../../plugins/error-handler';

/**
 * Images: the originals as they were stored, and derivatives made on request.
 *
 * No S3 and no MinIO — decision D-8. `media.storage_key` holds a relative key rather than a
 * URL, so this file is the entire adapter and moving to object storage later replaces it
 * instead of rewriting every row that ever referenced a picture. The price of that choice is
 * explicit and belongs in `DEPLOY.md`: `uploads/` must be in the backup, because a `mysqldump`
 * alone restores a site on which every photograph is a 404.
 *
 * Derivatives are written to disk beside the originals and served from there afterwards, so the
 * cost of a width is paid once per image rather than once per request. The list of permitted
 * widths is the same constant `Img` builds its `srcSet` from: without a whitelist, `?w=100000`
 * asks a server with no GPU to allocate a forty-gigabyte bitmap, which is a denial of service
 * that fits in a URL.
 */

const CACHE_DIRECTORY = '.cache';

/** A year. The key contains a content hash, so a changed picture is a changed URL. */
const IMMUTABLE = 'public, max-age=31536000, immutable';

const resizeQuery = z.object({
  w: z.coerce
    .number()
    .int()
    .refine((width) => (IMAGE_WIDTHS as readonly number[]).includes(width), {
      message: `Width must be one of: ${IMAGE_WIDTHS.join(', ')}`,
    }),
});

/**
 * Keeps a request inside `uploads/`.
 *
 * `/img/*` is a wildcard because a storage key contains slashes — `2026/07/a3f9….webp` — and a
 * wildcard is precisely where `../../etc/passwd` gets attempted. Resolving both paths and
 * comparing prefixes is the check that actually holds, rather than looking for `..` in the
 * string, which decoding defeats.
 */
function safeJoin(root: string, key: string): string {
  const target = resolve(root, key);
  const base = resolve(root);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new ApiProblem('validation_failed', 'That is not a path inside the media directory');
  }
  return target;
}

export const mediaRoutes: FastifyPluginAsync = async (instance) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  const uploadsRoot = isAbsolute(app.env.UPLOADS_DIR)
    ? app.env.UPLOADS_DIR
    : resolve(process.cwd(), app.env.UPLOADS_DIR);

  // The directory need not exist yet: there are no photographs at all (Q-1), and a server that
  // refuses to boot for want of an empty folder is a worse failure than a 404.
  await mkdir(join(uploadsRoot, CACHE_DIRECTORY), { recursive: true }).catch(() => undefined);

  await app.register(staticFiles, {
    root: uploadsRoot,
    prefix: '/uploads/',
    decorateReply: false,
    immutable: true,
    maxAge: '365d',
    // The derivative cache lives under the same root and is served through `/img`, which knows
    // how to make what is missing. Exposing it directly would serve a stale copy nobody can
    // invalidate.
    serveDotFiles: false,
  });

  /**
   * Who took the photographs, and under what licence.
   *
   * Every image on the site came from Wikimedia Commons, and CC BY and CC BY-SA — which is most
   * of them — require the author to be named wherever the work is published. This is that
   * naming, read from what the import recorded rather than from a list somebody keeps by hand:
   * a photograph replaced tomorrow drops off this page by itself.
   *
   * Shared by both public sites and not scoped to either. The pool is one pool, the obligation
   * is the same obligation, and a Turkmen pilgrim and an English tourist are owed the same
   * sentence.
   */
  app.get(
    '/credits',
    {
      schema: {
        tags: ['media'],
        summary: 'Author and licence of every borrowed photograph',
        description:
          'Rows with `source = "stock"`, which is what the Wikimedia import writes and nothing ' +
          'else does. A photograph the operator took needs no credit and does not appear.',
        response: { 200: creditsResponse },
      },
    },
    async () => {
      const rows = await app.db
        .select({
          id: t.media.id,
          attribution: t.media.attribution,
          license: t.media.license,
        })
        .from(t.media)
        .where(eq(t.media.source, 'stock'))
        .orderBy(t.media.id);

      return {
        items: rows.map((row) => {
          // The import stores «Author · https://commons.wikimedia.org/…» in one column, which is
          // the right shape for a database and the wrong one for a page. Split here rather than
          // migrating the column: the separator is this project's own and has one writer.
          const [author = '', sourceUrl] = (row.attribution ?? '').split(' · ');
          return {
            id: row.id,
            author: author.trim() || 'Wikimedia Commons',
            license: row.license ?? '',
            sourceUrl: sourceUrl?.trim() ?? null,
          };
        }),
      };
    },
  );

  app.get(
    '/img/*',
    {
      schema: {
        tags: ['media'],
        summary: 'One stored image, resized to a permitted width',
        description:
          'Widths are limited to the list `Img` builds its srcSet from. The result is written ' +
          'to `uploads/.cache/` and served from disk on every subsequent request.\n\n' +
          'Responds with `image/webp` bytes. This is the one route with no response schema, ' +
          'and deliberately: the rule exists so that JSON is serialised by a declared shape, ' +
          'and there is no JSON here to constrain. `routes.contract.test.ts` names it as the ' +
          'single exemption, so a new route cannot quietly join it.',
        querystring: resizeQuery,
      },
    },
    async (request, reply) => {
      const key = (request.params as { '*': string })['*'];
      const width = request.query.w;

      const source = safeJoin(uploadsRoot, key);

      /*
       * The derivative's name is a hash of what produced it.
       *
       * Key and width both, so re-uploading a different picture under the same name cannot be
       * served from a stale derivative, and so the flat cache directory never has to mirror the
       * year/month tree underneath `uploads/`.
       */
      const digest = createHash('sha256')
        .update(`${key}|${String(width)}`)
        .digest('hex')
        .slice(0, 24);
      const derivative = join(uploadsRoot, CACHE_DIRECTORY, `${digest}.webp`);

      const cached = await readFile(derivative).catch(() => null);
      if (cached !== null) {
        return reply.type('image/webp').header('cache-control', IMMUTABLE).send(cached);
      }

      const original = await readFile(source).catch(() => null);
      if (original === null) {
        throw new ApiProblem('not_found', `No image at «${key}»`);
      }

      let resized: Buffer;
      try {
        resized = await sharp(original)
          // `withoutEnlargement` so a small original is not upscaled into a blurry large file
          // that is bigger than the picture it came from.
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 86 })
          .toBuffer();
      } catch (error) {
        request.log.warn({ err: error, key }, 'could not resize');
        throw new ApiProblem('unsupported_media', 'That file is not an image this can resize');
      }

      await mkdir(dirname(derivative), { recursive: true });
      await writeFile(derivative, resized);

      return reply.type('image/webp').header('cache-control', IMMUTABLE).send(resized);
    },
  );
};
