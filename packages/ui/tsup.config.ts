import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/tailwind-preset.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  /*
   * Not `clean`, and the reason is `dev`.
   *
   * `theme.css` is generated from the tokens rather than written by hand (D-27), and the three
   * SPAs import it by path. In watch mode tsup's clean wipes `dist/` on every rebuild — which
   * deletes that file a moment after Turborepo restored it, and the site fails to start with
   * «Failed to resolve import "@charva/ui/theme.css"». Nothing about the failure points at the
   * cleaner, so it reads as a broken install.
   *
   * A stale chunk left behind costs nothing: entry points are fixed and chunk names are
   * content-hashed, so nothing references yesterday's. `pnpm --filter @charva/ui clean` still
   * empties the directory when a genuinely fresh build is wanted.
   */
  clean: false,
  /*
   * The CSS is emitted after *every* successful build, watch included.
   *
   * It used to be a second command in the `build` script, which meant `dev` — a different
   * script — never ran it at all.
   */
  onSuccess: 'node scripts/emit-css.mjs',
  external: ['react', 'react-dom'],
});
