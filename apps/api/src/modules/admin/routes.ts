import { type FastifyPluginAsync } from 'fastify';

import { adminAuthRoutes } from './auth/routes';
import { registerLinkRoutes } from './crud/links';
import { registerCrudRoutes } from './crud/routes';

/**
 * Everything behind the login.
 *
 * Mounted under `/api/v1/admin`, which is what nginx will proxy from
 * `admin.charva-travel.com/api` — same origin as the admin SPA, so the refresh cookie can be
 * `SameSite=Strict` and never travels to a public site (decision D-20).
 */
export const adminRoutes: FastifyPluginAsync = async (instance) => {
  await instance.register(adminAuthRoutes, { prefix: '/auth' });
  registerCrudRoutes(instance);
  registerLinkRoutes(instance);
};
