import { cp, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies the `.sql` files next to the bundled migrator.
 *
 * `migrate.ts` reads its migrations from a `migrations` directory beside its own module, which
 * is a directory listing rather than an import — so a bundler has no way to see the files and
 * cannot carry them along. Without this step `dist/migrate.js` is a migrator with nothing to
 * apply: it connects, finds an empty ledger, applies zero migrations and exits successfully.
 * A silent success against an empty database is the worst of the available failures, and it is
 * the one a deploy would hit first.
 *
 * The count is checked rather than assumed. `cp` is happy to copy an empty directory.
 */

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, '..', 'src', 'db', 'migrations');
const to = resolve(here, '..', 'dist', 'migrations');

await cp(from, to, { recursive: true });

const copied = (await readdir(to)).filter((name) => name.endsWith('.sql'));
if (copied.length === 0) {
  throw new Error(`No .sql files reached ${to}. The deploy artefact cannot migrate a database.`);
}

process.stdout.write(`migrations: ${String(copied.length)} → ${join('dist', 'migrations')}\n`);
