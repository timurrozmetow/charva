import { choiceResponse, DEFAULT_LANG, langQueryFor, SITE_LANGS } from '@charva/contracts';
import { type FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { localePlugin } from '../../plugins/locale';
import { getSettings } from '../global/service';
import { currentTrip } from '../umrah/service';

import { choiceStats } from './service';

/**
 * The brand chooser at `charva-travel.com`.
 *
 * One route, and almost everything the page shows is not in it: the two halves, their headings,
 * the section chips and the four language names are interface copy, which lives in the
 * repository as translation files rather than in the database (decision D-23).
 *
 * What *is* here is the Umrah departure behind the pulsing badge. It has to come from the same
 * row the Umrah homepage reads, because the prototypes compute the same countdown twice — with
 * `Math.ceil` on this page and `Math.floor` on the Umrah homepage — so the chooser and the site
 * it links to can disagree about how many days are left. One row, one endpoint, one
 * `CountdownTimer`.
 */
export const choiceRoutes: FastifyPluginAsync = async (instance) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  await app.register(localePlugin, { site: 'choice' });

  app.get(
    '/choice',
    {
      config: { cache: true },
      schema: {
        tags: ['global'],
        summary: 'What the chooser needs from the database, which is almost nothing',
        querystring: langQueryFor('choice'),
        response: { 200: choiceResponse },
      },
    },
    async (request) => {
      /*
       * The chooser offers four languages and Umrah offers two, so `request.lang` can be `en`
       * or `tr` here — languages the Umrah content has no translation for. `pickLocale` walks
       * the fallback chain and answers in Turkmen or Russian rather than leaving a hotel name
       * blank, which is exactly the case that chain exists for.
       */
      const [trip, global, umrah, stats] = await Promise.all([
        currentTrip(app.db, request.lang),
        getSettings(app.db, 'global', request.lang, SITE_LANGS.global, DEFAULT_LANG.global),
        getSettings(app.db, 'umrah', request.lang, SITE_LANGS.umrah, DEFAULT_LANG.umrah),
        choiceStats(app.db),
      ]);

      return {
        umrah: { trip: trip.trip },
        stats: {
          global: stats.global,
          umrah: { ...stats.umrah, seatsTotal: trip.trip?.seatsTotal ?? null },
        },
        contacts: { global: global.contacts, umrah: umrah.contacts },
        legal: global.legal,
      };
    },
  );
};
