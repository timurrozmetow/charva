import { fileURLToPath } from 'node:url';

/**
 * Resolves the bare `@charva/ui` specifier to the package's source rather than to its build.
 *
 * `packages/ui` is published by tsup as one bundled module. That is the right shape for the two
 * things which load it through Node — the Tailwind preset and the script that generates
 * `theme.css` from the tokens (D-27) — and the wrong shape for a bundler: Rollup treats a module
 * as atomic, so importing `Container` dragged in the carousel, the mosaic packer, the modal, the
 * countdown and every form control with it. Measured on Global that was 51 KB of a 372 KB entry
 * chunk, most of it belonging to pages that are lazy and some of it to components the site never
 * renders at all.
 *
 * It is the problem D-149 solved for contracts, where the answer was to change the published
 * output to one module per file. Here it does not have to be. The apps live in the same
 * repository and are built by Vite, which reads the TypeScript directly, sees the real module
 * graph, and leaves each lazy route to pull the components it actually uses. The published build
 * is untouched and still serves Node, and `dist/index.d.ts` still supplies the types — this is a
 * bundling alias, and TypeScript resolves through `exports`.
 *
 * Applied in all four apps from one place, because four copies of a resolver rule is four
 * chances for one of them to be forgotten — and the symptom of forgetting is not an error but a
 * site that is quietly twenty kilobytes heavier than its neighbours.
 *
 * Exact match, deliberately: `@charva/ui/theme.css` and `@charva/ui/tailwind-preset` are
 * separate entry points and must keep resolving to `dist`.
 *
 * The path is resolved against this file rather than against the caller, so an app moving a
 * directory deeper does not silently stop aliasing.
 *
 * @returns {{ find: RegExp, replacement: string }[]}
 */
export function uiSourceAlias() {
  return [
    {
      find: /^@charva\/ui$/,
      replacement: fileURLToPath(new URL('../../ui/src/index.ts', import.meta.url)),
    },
  ];
}
