/**
 * Writes dist/theme.css from src/theme.ts.
 *
 * The palette exists once, in tokens.ts. Hand-maintaining the same thirty values in a
 * stylesheet is exactly the "two copies of one number" this repository keeps warning about,
 * so the stylesheet is generated after tsup has built the module.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// pathToFileURL, not the bare path: on Windows a dynamic import of "C:\..." is rejected with
// ERR_UNSUPPORTED_ESM_URL_SCHEME because the drive letter reads as a URL scheme.
const { buildThemeCss } = await import(pathToFileURL(join(root, 'dist', 'index.js')).href);

const css = buildThemeCss();
const target = join(root, 'dist', 'theme.css');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, css, 'utf8');

console.log(`theme.css written (${css.split('\n').length} lines)`);
