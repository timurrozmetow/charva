import { baseConfig } from '@charva/config/eslint/base';
import { nodeBlock } from '@charva/config/eslint/node';
import { reactBlock } from '@charva/config/eslint/react';

/**
 * One config for the whole monorepo.
 *
 * ESLint 9 resolves a single flat config from the working directory, not per file, so
 * per-package config files would only apply when eslint happened to be invoked inside that
 * package — and lint-staged, running from the repo root, would report every staged file as
 * "ignored" and lint nothing. Type-aware rules still resolve correctly because
 * `projectService` maps each file to its nearest tsconfig.json.
 */
export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  ...reactBlock({
    files: [
      'apps/web-choice/**/*.{ts,tsx}',
      'apps/web-global/**/*.{ts,tsx}',
      'apps/web-umrah/**/*.{ts,tsx}',
      'apps/admin/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
    ],
  }),
  ...nodeBlock({ files: ['apps/api/**/*.ts'] }),
];
