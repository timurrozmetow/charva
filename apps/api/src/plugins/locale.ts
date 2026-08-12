import { DEFAULT_LANG, type Lang, type Site, SITE_LANGS } from '@charva/contracts';
import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { ApiProblem } from './error-handler';

/**
 * Which language a request is answered in.
 *
 * Validated against the set the *specific site* offers, not against the four that exist. Umrah
 * is never Turkish and Global is never Turkmen — that asymmetry is the whole reason `SITE_LANGS`
 * is a per-site tuple in contracts rather than one list, and this is where it becomes an
 * enforced rule instead of a type.
 *
 * A language the site does not offer is a 400 rather than a quiet fall back to the default. A
 * fallback would answer `?lang=tm` on Global with Russian and look like it had worked, and the
 * caller — a router, a link, a sitemap generator — would keep producing the broken URL.
 *
 * The API reads only `?lang=`. It deliberately does not sniff `Accept-Language`: the language a
 * page is served in belongs in its URL, because that is what gets shared, cached and indexed,
 * and choosing from a header would give two visitors different content at one address.
 */
declare module 'fastify' {
  interface FastifyRequest {
    /** The resolved language. Always one this site offers. */
    lang: Lang;
    /** Which of the three sites this route belongs to. */
    site: Site;
  }
}

export interface LocaleOptions {
  site: Site;
}

/**
 * Registered inside each module's scope, so the site is bound once and no handler has to be
 * told which one it is running under.
 *
 * Wrapped in `fastify-plugin`, and that is not decoration. Without it, `register` gives this
 * plugin its own encapsulation context and the hook below applies only to routes declared
 * *inside* it — which is none of them, because the routes are siblings. The plugin would load,
 * report no error, and validate nothing. `locale.db.test.ts` caught exactly that: `?lang=tr` on
 * Umrah was still refused, but by the querystring schema, with «Invalid enum value» instead of
 * by the rule that knows the site only offers two languages.
 *
 * Breaking encapsulation here is contained: each module is itself registered with `register`,
 * so the hook attaches to that module's context and no further.
 */
export const localePlugin = fp<LocaleOptions>(function localePlugin(app, options, done) {
  const { site } = options;
  const offered = SITE_LANGS[site] as readonly Lang[];

  app.addHook('onRequest', (request, _reply, next) => {
    request.site = site;

    /*
     * Read out of the raw URL rather than out of `request.query`.
     *
     * At `onRequest` Fastify has not populated `request.query` yet — with a Zod querystring
     * schema it is assigned during validation, which runs later. Reading it here silently
     * yields undefined, so every request would take the site default and this hook would
     * validate nothing at all. That is not hypothetical: it is what the first run of
     * `locale.db.test.ts` found, and the reason `?lang=tr` on Umrah was rejected by the schema
     * with «Invalid enum value» instead of by the rule that knows why.
     */
    const separator = request.url.indexOf('?');
    const requested =
      separator < 0 ? null : new URLSearchParams(request.url.slice(separator + 1)).get('lang');

    if (requested === null) {
      request.lang = DEFAULT_LANG[site];
      next();
      return;
    }

    // An empty `?lang=` is a router that interpolated nothing, and it is refused for the same
    // reason an unknown language is: silently answering in the default hides the broken link.
    if (!offered.includes(requested as Lang)) {
      next(
        new ApiProblem('validation_failed', `Unsupported language for the ${site} site`, [
          { path: 'lang', message: `Expected one of: ${offered.join(', ')}` },
        ]),
      );
      return;
    }

    request.lang = requested as Lang;
    next();
  });

  done();
});

/** Called once on the root instance: decorators live on a shared prototype. */
export function decorateLocale(app: FastifyInstance): void {
  app.decorateRequest('lang', 'ru');
  app.decorateRequest('site', 'global');
}
