import { builderConfigResponse, langQueryFor } from '@charva/contracts';
import { type FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { localePlugin } from '../../plugins/locale';

import * as service from './service';

/**
 * The tour builder: the nine steps and their options.
 *
 * There used to be a second route here, `POST /quote`, which priced a selection and was the
 * authority the panel's live figure was checked against. Both are gone: the owner decided on
 * 2026-09-11 that the site does not quote — an operator works the selection out and sends a
 * price — and the rates it quoted from were the designer's invention that Q-10 never confirmed.
 *
 * Removed rather than left unused. An endpoint that answers «1 296 $» to anyone who asks is a
 * price channel whether or not a screen renders it, and the response schema is the serialiser
 * (D-12), so the way to make a price unreachable is for there to be no field and no route.
 *
 * The arithmetic itself survives where it is still wanted: `quote()` runs once, server-side,
 * when a lead arrives, so the operator opens an enquiry with the system's own figure beside the
 * selection.
 */
export const builderRoutes: FastifyPluginAsync = async (instance) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  await app.register(localePlugin, { site: 'global' });

  app.get(
    '/config',
    {
      config: { cache: true },
      schema: {
        tags: ['builder'],
        summary: 'The nine steps and their options',
        description:
          'Carries no money: the options, and the two counts an unanswered step falls back to ' +
          'so the panel can say «Ночей 6» before the visitor reaches that step. Rates are not ' +
          'public — the site does not quote.',
        querystring: langQueryFor('global'),
        response: { 200: builderConfigResponse },
      },
    },
    (request) => service.getConfigForDisplay(app.db, request.lang),
  );
};
