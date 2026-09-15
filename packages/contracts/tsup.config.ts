import { defineConfig } from 'tsup';

export default defineConfig({
  // Money, i18n and the module schemas arrive in Phase 2 with their own entries.
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  bundle: false,
});
