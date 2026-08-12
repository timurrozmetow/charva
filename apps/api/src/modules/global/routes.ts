import {
  articlesQuery,
  articleDetailSchema,
  articlesResponse,
  countryResponse,
  faqResponse,
  galleryQuery,
  galleryResponse,
  globalHomeResponse,
  globalSettingsResponse,
  hotelDetailSchema,
  hotelsQuery,
  hotelsResponse,
  langQueryFor,
  reviewsQuery,
  reviewsResponse,
  SITE_LANGS,
  slugParams,
  tourDetailSchema,
  toursQuery,
  toursResponse,
  videosQuery,
  videosResponse,
  DEFAULT_LANG,
} from '@charva/contracts';
import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { localePlugin } from '../../plugins/locale';

import * as service from './service';

/**
 * Charva Travel Global.
 *
 * Every route here declares a response schema, and that is load-bearing rather than tidy: the
 * Zod type provider installs it as the serialiser, so a field nobody wrote down cannot reach a
 * browser. On this site that mostly buys a stable contract; on Umrah the same mechanism is what
 * keeps prices off the wire (D-12).
 *
 * Every route also opts into the cache with `config: { cache: true }`. The catalogue changes
 * when an editor saves, which is a handful of times a week, and it is read on every page view.
 */
export const globalRoutes: FastifyPluginAsync = async (instance) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  await app.register(localePlugin, { site: 'global' });

  const lang = langQueryFor('global');
  const cached = { cache: true } as const;

  /** Everything a handler needs, assembled once per request. */
  const context = (request: FastifyRequest) => ({
    db: app.db,
    lang: request.lang,
    baseUrl: app.env.PUBLIC_MEDIA_BASE_URL,
  });

  app.get(
    '/settings',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'Contacts, social links and the licence number',
        querystring: lang,
        response: { 200: globalSettingsResponse },
      },
    },
    (request) =>
      service.getSettings(app.db, 'global', request.lang, SITE_LANGS.global, DEFAULT_LANG.global),
  );

  app.get(
    '/home',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'The whole homepage, assembled server-side',
        description:
          'Composite on purpose: nine separate requests on a poor connection is nine chances ' +
          'to arrive half-rendered, and nine round trips before the hero image can start.',
        querystring: lang,
        response: { 200: globalHomeResponse },
      },
    },
    (request) => service.getHome(context(request)),
  );

  app.get(
    '/tours',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'The tour catalogue, with counted filter chips',
        querystring: toursQuery.merge(lang),
        response: { 200: toursResponse },
      },
    },
    (request) => service.listTours(context(request), request.query),
  );

  app.get(
    '/tours/:slug',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'One tour: programme, gallery and three related',
        params: slugParams,
        querystring: lang,
        response: { 200: tourDetailSchema },
      },
    },
    (request) => service.getTour(context(request), request.params.slug),
  );

  app.get(
    '/hotels',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'Hotels, filtered by the derived key rather than by stars alone',
        querystring: hotelsQuery.merge(lang),
        response: { 200: hotelsResponse },
      },
    },
    (request) => service.listHotels(context(request), request.query),
  );

  app.get(
    '/hotels/:slug',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'One hotel',
        params: slugParams,
        querystring: lang,
        response: { 200: hotelDetailSchema },
      },
    },
    (request) => service.getHotel(context(request), request.params.slug),
  );

  app.get(
    '/articles',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'Editorial articles, newest first',
        querystring: articlesQuery.merge(lang),
        response: { 200: articlesResponse },
      },
    },
    (request) => service.listArticles(context(request), request.query),
  );

  app.get(
    '/articles/:slug',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'One article',
        params: slugParams,
        querystring: lang,
        response: { 200: articleDetailSchema },
      },
    },
    (request) => service.getArticle(context(request), request.params.slug),
  );

  app.get(
    '/gallery',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'Gallery tiles with their mosaic span hints',
        description:
          'The spans are an editorial request, not a layout instruction: the client runs them ' +
          'through a first-fit packer over the visible set, so filtering leaves no holes.',
        querystring: galleryQuery.merge(lang),
        response: { 200: galleryResponse },
      },
    },
    (request) => service.listGallery(context(request), request.query),
  );

  app.get(
    '/videos',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'Videos, with duration in seconds rather than as «14:20»',
        querystring: videosQuery.merge(lang),
        response: { 200: videosResponse },
      },
    },
    (request) => service.listVideos(context(request), request.query),
  );

  app.get(
    '/reviews',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'Reviews, sortable by a real date, with computed aggregates',
        querystring: reviewsQuery.merge(lang),
        response: { 200: reviewsResponse },
      },
    },
    (request) => service.listReviews(context(request), request.query),
  );

  app.get(
    '/faq',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'Frequently asked questions',
        querystring: lang,
        response: { 200: faqResponse },
      },
    },
    async (request) => ({ items: await service.listFaq(app.db, 'global', request.lang) }),
  );

  app.get(
    '/country',
    {
      config: cached,
      schema: {
        tags: ['global'],
        summary: 'The Turkmenistan page: places, facts and the visa steps',
        querystring: lang,
        response: { 200: countryResponse },
      },
    },
    async (request) => {
      const ctx = context(request);
      const [places, facts, visaSteps, slots] = await Promise.all([
        service.listPlaces(ctx),
        service.listBlocks(app.db, 'global', 'country_facts', request.lang),
        service.listBlocks(app.db, 'global', 'visa_steps', request.lang),
        service.listSlots(ctx, 'global', 'country'),
      ]);
      return { places, facts, visaSteps, slots };
    },
  );
};
