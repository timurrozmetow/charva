import { defineConfig } from 'tsup';

/**
 * The deploy artefact: the server, and the four commands an operator needs beside it.
 *
 * `db:migrate` and `admin:create` run through `tsx` from `src/` during development, which is
 * fine on a machine that has the sources. The VPS gets `dist/` and production `node_modules`
 * and nothing else, so a deploy that ships only `server.js` can start an API against a database
 * it cannot migrate, and can never create the first account. Both are needed on the very first
 * boot, which is exactly when nobody wants to discover this.
 *
 * The entry map is written out rather than passed as an array on purpose: an array preserves the
 * source tree, so `src/db/migrate.ts` would land in `dist/db/`. Two things break one level down.
 * `loadEnv` resolves `.env` as three levels above its own module — true for `apps/api/src/` and
 * for `apps/api/dist/`, false for `apps/api/dist/db/`. And `migrate.ts` reads its SQL from a
 * `migrations` directory beside itself. Flattening keeps every entry at the same depth as the
 * source it came from, so both rules keep holding.
 */
export default defineConfig({
  entry: {
    server: 'src/server.ts',
    migrate: 'src/db/migrate.ts',
    'create-admin': 'src/db/create-admin.ts',
    seed: 'src/db/seed/index.ts',
    'backfill-hero-slides': 'src/db/backfill-hero-slides.ts',
    'backfill-translations': 'src/db/backfill-translations.ts',
    // Ships because the photographs have to land on the server rather than be uploaded to it:
    // a hundred and sixteen files is a hundred megabytes over a connection from Ashgabat, and
    // the VPS can fetch them from Wikimedia directly in a fraction of the time.
    'import-stock': 'src/db/import-stock.ts',
  },
  format: ['esm'],
  target: 'node20',
  sourcemap: true,
  clean: true,
  // Bundling keeps the deploy artefact small; node_modules is not rsynced to the VPS.
  noExternal: [/^@charva\//],
});
