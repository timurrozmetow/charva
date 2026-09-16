/*
 * Writes a `.br` and a `.gz` beside every compressible file in the built SPAs.
 *
 * Why beforehand rather than on the fly. nginx was compressing the bundle with gzip at level 6
 * on every request that missed its cache, and the shell — which comes from Fastify — was already
 * arriving brotli-compressed, so the largest file on the page was the one getting the weaker
 * algorithm. Measured on the live Global bundle:
 *
 *     raw                389,833
 *     gzip -6 (nginx)    128,214     what every visitor was downloading
 *     brotli -q5           121,822     what `brotli on` would give, per request, per CPU
 *     brotli -q11          110,441     what this writes, once, at build time
 *
 * The difference between compressing on the fly and compressing ahead is 2.8x here, and it is
 * free: these filenames carry a content hash, so a derivative computed once is correct until the
 * file is replaced, at which point it has a different name anyway. The server then spends no CPU
 * at all — `brotli_static` and `gzip_static` hand out a file — and the deploy tar is smaller for
 * it. Level 11 is slow to produce and exactly as fast to decode as level 5; the cost lands on
 * this machine, once, and never on the connection from Ashgabat.
 *
 * Node's own zlib rather than a `brotli` binary: this runs from Git Bash on Windows, where the
 * deploy script already avoids rsync for the same reason. A build step that depends on a tool
 * the machine may not have is a build step that silently does nothing.
 */
import { constants, brotliCompressSync, gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

/*
 * Only what is worth it. A WebP, a WOFF2 and a PNG are already compressed — running them through
 * brotli spends time to produce a *larger* file, which is why the nginx config has said so about
 * gzip since it was written.
 */
const COMPRESSIBLE = new Set([
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.json',
  '.svg',
  '.xml',
  '.txt',
  '.webmanifest',
]);

/*
 * Source maps are excluded, though they compress well.
 *
 * Nothing fetches one unless a developer has the tools open, so the only thing level 11 on a
 * 1.2 MB map buys is a slower deploy — and there are five of them per site. They are still
 * served, just compressed on the fly by the filters nginx already has, on the rare request that
 * asks.
 */
const SKIP = new Set(['.map']);

/*
 * Below a kilobyte the headers and the framing cost more than the saving, and nginx's own
 * `gzip_min_length` uses the same figure. Above it, anything that fails to shrink is dropped
 * rather than written: a `.br` larger than its source is a file the server would faithfully hand
 * out, having made the page slower.
 */
const MIN_BYTES = 1024;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

let files = 0;
let raw = 0;
let br = 0;
let gz = 0;

for (const root of process.argv.slice(2)) {
  for (const path of walk(root)) {
    if (path.endsWith('.br') || path.endsWith('.gz')) continue;
    if (SKIP.has(extname(path))) continue;
    if (!COMPRESSIBLE.has(extname(path))) continue;
    if (statSync(path).size < MIN_BYTES) continue;

    const source = readFileSync(path);

    const brotli = brotliCompressSync(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    });
    const gzip = gzipSync(source, { level: constants.Z_BEST_COMPRESSION });

    if (brotli.length >= source.length && gzip.length >= source.length) continue;

    files += 1;
    raw += source.length;
    if (brotli.length < source.length) {
      writeFileSync(`${path}.br`, brotli);
      br += brotli.length;
    }
    if (gzip.length < source.length) {
      writeFileSync(`${path}.gz`, gzip);
      gz += gzip.length;
    }
  }
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(
  `precompressed ${String(files)} files: ${kb(raw)} raw, ${kb(gz)} gzip, ${kb(br)} brotli ` +
    `(${(100 - (br / gz) * 100).toFixed(1)}% under gzip)`,
);
