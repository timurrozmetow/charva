import {
  builderConfigResponse,
  builderQuoteRequest,
  builderQuoteResponse,
  langQueryFor,
} from '@charva/contracts';
import { type FastifyPluginAsync } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { localePlugin } from '../../plugins/locale';

import * as service from './service';

/**
 * The tour builder: rates out, quote back.
 *
 * `POST` rather than `GET` for the quote, despite it being a pure read, because a selection is
 * nine fields — three of which are arrays — and putting that in a query string means URL length
 * limits, encoding of Cyrillic option labels that should not be there anyway, and a cache key
 * nobody can read in a log.
 *
 * Deliberately not cached. It is cheap, it is a POST, and the whole point is that the panel
 * responds to the click that just happened.
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
        summary: 'The nine steps, their options and the rates',
        description:
          'The client applies the same `quote()` from @charva/contracts to this, on every ' +
          'click, so the estimate moves at once. Decision D-11: there is no second ' +
          'implementation for the two sides to disagree with.',
        querystring: langQueryFor('global'),
        response: { 200: builderConfigResponse },
      },
    },
    (request) => service.getConfigForDisplay(app.db, request.lang),
  );

  app.post(
    '/quote',
    {
      schema: {
        tags: ['builder'],
        summary: 'Price a selection. The authoritative answer.',
        description:
          'Accepts option codes and nothing else — never a price. An empty selection is a ' +
          'valid request and returns 1 296 $, which is what a visitor sees before their first ' +
          'click: six nights at the four-star rate, for two people, plus the base fee.',
        body: builderQuoteRequest,
        response: { 200: builderQuoteResponse },
      },
    },
    (request) => service.priceSelection(app.db, request.body.selection),
  );
};
