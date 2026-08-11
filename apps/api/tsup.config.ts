import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  sourcemap: true,
  clean: true,
  // Bundling keeps the deploy artefact small; node_modules is not rsynced to the VPS.
  noExternal: [/^@charva\//],
});
