import {
  DEFAULT_LANG,
  langQueryFor,
  SITE_LANGS,
  slugParams,
  umrahCurrentTripResponse,
  umrahGroupDetailResponse,
  umrahGroupsQuery,
  umrahGroupsResponse,
  umrahHomeResponse,
  umrahPackageResponse,
  umrahProgramResponse,
  umrahSettingsResponse,
  ziyaratDetailResponse,
  ziyaratQuery,
  ziyaratResponse,
} from '@charva/contracts';
import { type FastifyPluginAsync, type FastifyRequest } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { localePlugin } from '../../plugins/locale';
import { getSettings } from '../global/service';

import * as service from './service';

/**
 * Charva Umrah.
 *
 * Not one response schema below has a price field, and that absence is the enforcement rather
 * than a note in a review checklist: the type provider uses these schemas as the serialiser, so
 * a careless `select *` in a service is trimmed on the wire. Decision D-12. A test walks the
 * JSON of every route under this prefix and fails on any key that looks like money.
 *
 * The language set is `tm` then `ru` and Turkish is not offered — the locale plugin refuses
 * `?lang=tr` here with a 400 rather than quietly answering in Turkmen, so a broken link is
 * reported instead of silently working.
 */
export const umrahRoutes: FastifyPluginAsync = async (instance) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  await app.register(localePlugin, { site: 'umrah' });

  const lang = langQueryFor('umrah');
  const cached = { cache: true } as const;

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
        tags: ['umrah'],
        summary: 'Contacts and social links',
        querystring: lang,
        response: { 200: umrahSettingsResponse },
      },
    },
    (request) => getSettings(app.db, 'umrah', request.lang, SITE_LANGS.umrah, DEFAULT_LANG.umrah),
  );

  app.get(
    '/trip/current',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'The current departure, derived rather than flagged',
        description:
          'The soonest future departure, or the one an editor has deliberately pinned. `null` ' +
          'is a real answer — it is what the site shows between groups, which happens within ' +
          'weeks of launch (question Q-4). Cached for a minute like everything else, which is ' +
          'safe: the client computes the countdown locally from `departAt`, so a stale copy ' +
          'means a slightly old seat count, never a wrong clock.',
        querystring: lang,
        response: { 200: umrahCurrentTripResponse },
      },
    },
    (request) => service.currentTrip(app.db, request.lang),
  );

  app.get(
    '/home',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'The whole homepage, assembled server-side',
        querystring: lang,
        response: { 200: umrahHomeResponse },
      },
    },
    (request) => service.getHome(context(request)),
  );

  app.get(
    '/package',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'One package: what it contains, its conditions and how to sign up',
        description: 'No amount appears anywhere in this response. That is decision D-12.',
        querystring: lang,
        response: { 200: umrahPackageResponse },
      },
    },
    (request) => service.getPackage(context(request)),
  );

  app.get(
    '/program',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'The ten days, and the daily routine',
        querystring: lang,
        response: { 200: umrahProgramResponse },
      },
    },
    (request) => service.getProgram(context(request)),
  );

  app.get(
    '/ziyarat',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'Places visited, with city chips built from the data',
        description:
          'The chips come from `SELECT DISTINCT` over published rows — decision D-15. The ' +
          'prototype hardcodes three and the data has four cities, so everything in Jidda is ' +
          'currently unreachable by any filter.',
        querystring: ziyaratQuery.merge(lang),
        response: { 200: ziyaratResponse },
      },
    },
    (request) => service.listZiyarat(context(request), request.query),
  );

  app.get(
    '/ziyarat/:slug',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'One place, and up to three others in the same city',
        params: slugParams,
        querystring: lang,
        response: { 200: ziyaratDetailResponse },
      },
    },
    (request) => service.getZiyaratPlace(context(request), request.params.slug),
  );

  app.get(
    '/groups',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'Groups that have already travelled',
        description: 'Photo and video counts are `COUNT(*)`, never stored columns.',
        querystring: umrahGroupsQuery.merge(lang),
        response: { 200: umrahGroupsResponse },
      },
    },
    (request) => service.listGroups(context(request), request.query),
  );

  app.get(
    '/groups/:slug',
    {
      config: cached,
      schema: {
        tags: ['umrah'],
        summary: 'One group: every photograph and every clip',
        description:
          'Every one, not the first eight — the prototype builds its lightbox from a hardcoded ' +
          'array of captions and cannot open the other thirty.',
        params: slugParams,
        querystring: lang,
        response: { 200: umrahGroupDetailResponse },
      },
    },
    (request) => service.getGroup(context(request), request.params.slug),
  );
};
