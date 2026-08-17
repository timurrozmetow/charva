import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { SITES, type Site } from '@charva/contracts';
import { type FastifyPluginCallback } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { ApiProblem } from '../../plugins/error-handler';

import { injectHead, renderHead } from './html';
import { renderShellHead } from './service';
import { collectEntries, renderRobots, renderSitemap } from './sitemap';

/**
 * The SPA shell, with a head that means something.
 *
 * nginx sends HTML requests here and serves everything else — the hashed bundles, the fonts,
 * the images — straight from disk. So this runs once per page view by a person, and once per
 * crawl by a robot, and never for an asset.
 *
 * The body is the SPA's own `index.html`, untouched: the script and stylesheet names carry
 * Vite's content hashes, and nothing here knows them. That is what lets the front end be
 * redeployed without redeploying this.
 */

const querystring = z.object({
  site: z.enum(SITES),
  /** The path as the visitor typed it, language prefix included. */
  path: z.string().max(2048).default('/'),
  /** The public origin of that site, so canonical and OG URLs are absolute and correct. */
  origin: z.string().url().optional(),
});

/** The two files a crawler asks for by name, and neither of them is a page. */
const crawlerQuery = z.object({
  site: z.enum([...SITES, 'admin', 'api']),
  origin: z.string().url().optional(),
});

export const shellRoutes: FastifyPluginCallback = (instance, _options, done) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();
  const templates = new Map<Site, string>();

  app.get(
    '/shell',
    {
      schema: {
        tags: ['shell'],
        summary: 'The SPA shell for one route, with its head rendered',
        description:
          'Decision D-4. A crawler and a Telegram card read HTML and run no JavaScript; for ' +
          'this audience links travel through Telegram, so a preview that unfurls as a bare ' +
          'URL is a link nobody taps. Returns HTML, which is why it declares no response ' +
          'schema — there is no JSON here for the serialiser to constrain.',
        querystring,
      },
    },
    async (request, reply) => {
      const { site, path } = request.query;
      const origin = request.query.origin ?? `${request.protocol}://${request.hostname}`;

      const result = await renderShellHead({
        db: app.db,
        site,
        path,
        origin,
        mediaBaseUrl: app.env.PUBLIC_MEDIA_BASE_URL,
      });

      const template = await loadTemplate(app.env.SHELL_DIST_DIR, site, templates);
      const html = injectHead(template, renderHead(result.tags));

      return (
        reply
          .code(result.found ? 200 : 404)
          .header('content-type', 'text/html; charset=utf-8')
          /*
           * A short cache with a long grace period.
           *
           * The head changes when an editor publishes, which is rare; a stale minute is
           * invisible. `stale-while-revalidate` is what keeps a crawl from queueing behind a
           * database round trip on every page of a sitemap.
           */
          .header('cache-control', 'public, max-age=60, stale-while-revalidate=300')
          .send(html)
      );
    },
  );

  app.get(
    '/sitemap.xml',
    {
      schema: {
        tags: ['shell'],
        summary: 'Every published URL of one site, in every language it speaks',
        description:
          'Each URL carries the full `xhtml:link` alternate set, including a self-reference: ' +
          'a set where one page names another without being named back is treated as ' +
          'unconfirmed and ignored. Published rows only — a sitemap listing URLs that answer ' +
          '404 is one a crawler stops trusting.',
        querystring: crawlerQuery,
      },
    },
    async (request, reply) => {
      const site = request.query.site;
      if (site === 'admin' || site === 'api') {
        throw new ApiProblem('not_found', `${site} has no sitemap: it has no public pages`);
      }

      const origin = request.query.origin ?? `${request.protocol}://${request.hostname}`;
      const entries = await collectEntries(app.db, site);

      return reply
        .header('content-type', 'application/xml; charset=utf-8')
        .header('cache-control', 'public, max-age=3600')
        .send(renderSitemap(site, origin, entries));
    },
  );

  app.get(
    '/robots.txt',
    {
      schema: {
        tags: ['shell'],
        summary: 'robots.txt for one host',
        description:
          'The admin and the API disallow everything — not because a crawler could get past ' +
          'the login, but because an indexed login form serves nobody and an indexed ' +
          '/api/v1 response is a JSON document in somebody search results.',
        querystring: crawlerQuery,
      },
    },
    (request, reply) => {
      const origin = request.query.origin ?? `${request.protocol}://${request.hostname}`;
      return reply
        .header('content-type', 'text/plain; charset=utf-8')
        .header('cache-control', 'public, max-age=86400')
        .send(renderRobots(request.query.site, origin));
    },
  );

  done();
};

/**
 * The built `index.html` of one site, read once.
 *
 * Cached in memory because a deploy restarts the process — the file cannot change under a
 * running server without one. In development nothing asks for this at all: Vite serves the
 * SPAs, and the message below is for the case where a deploy forgot to build one.
 */
async function loadTemplate(
  distDir: string,
  site: Site,
  cache: Map<Site, string>,
): Promise<string> {
  const cached = cache.get(site);
  if (cached !== undefined) return cached;

  const app = site === 'choice' ? 'web-choice' : site === 'global' ? 'web-global' : 'web-umrah';
  const base = distDir === '' ? resolve(process.cwd(), '..', app, 'dist') : resolve(distDir, app);
  const file = resolve(base, 'index.html');

  try {
    const template = await readFile(file, 'utf8');
    cache.set(site, template);
    return template;
  } catch {
    throw new ApiProblem(
      'not_found',
      `No built shell for ${site}. Expected ${file} — run pnpm build, or set SHELL_DIST_DIR.`,
    );
  }
}
