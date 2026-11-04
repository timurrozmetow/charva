import { defineConfig } from 'tsup';

export default defineConfig({
  // Money, i18n and the module schemas arrive in Phase 2 with their own entries.
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  /*
   * Not `clean`, for the reason D-96 records about `packages/ui` — this package had the same
   * flaw and it was never noticed, because it only bites on a cold `pnpm dev`.
   *
   * `dev` is `tsup --watch`, and Turborepo's `dev` task already depends on `^build`, so the
   * order is: contracts builds, the API starts, and then contracts' own watcher starts and
   * wipes `dist/` — deleting the file the API is in the middle of importing. It dies with
   * «ENOENT: packages/contracts/dist/index.js» and the whole `pnpm dev` comes up with no API
   * and no sites. Nothing in that message points at a cleaner, so it reads as a broken install.
   *
   * A stale module left behind costs nothing here: `bundle: false` emits one file per source
   * file at a path derived from that source, so nothing can reference a module whose source is
   * gone unless its importer is also gone. `pnpm --filter @charva/contracts clean` still empties
   * the directory when a genuinely fresh build is wanted.
   */
  clean: false,
  treeshake: true,
  splitting: true,
  bundle: false,
});
