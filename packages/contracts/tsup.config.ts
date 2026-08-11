import { defineConfig } from 'tsup';

export default defineConfig({
  // Money, i18n and the module schemas arrive in Phase 2 with their own entries.
  entry: ['src/index.ts', 'src/constants.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
