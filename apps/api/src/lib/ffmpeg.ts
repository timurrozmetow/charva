import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * The two binaries the video pipeline needs, and where to find them.
 *
 * `ffprobe` answers how long a file is; `ffmpeg` makes the poster frame and the one 720p
 * transcode. Neither is a library: they are processes, invoked with an argument array and never
 * a shell string, so a filename can never be read as a command.
 *
 * Resolution order is env, then the portable copy `scripts/dev-setup.ps1` unpacks under
 * `.services/` — this machine has no Docker and no admin rights, so that is where it lives —
 * then the bare name, which is what a VPS with `apt install ffmpeg` provides.
 */

/** A ceiling on any single invocation. A malformed file must not pin a core indefinitely. */
const TIMEOUT_MS = 120_000;

const cache = new Map<string, string>();

function portableCandidate(name: string): string | null {
  // Walk up from this file looking for the repository root, which is the directory holding
  // `.services`. `import.meta.url` rather than `cwd`, so it works whichever directory the API
  // was started from.
  let directory = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(directory, '.services', 'ffmpeg', 'bin', `${name}.exe`);
    if (existsSync(candidate)) return candidate;

    const parent = resolve(directory, '..');
    if (parent === directory) break;
    directory = parent;
  }

  return null;
}

export function resolveBinary(name: 'ffmpeg' | 'ffprobe', configured: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const found =
    (configured !== name && existsSync(configured) ? configured : null) ??
    portableCandidate(name) ??
    configured;

  cache.set(name, found);
  return found;
}

export interface VideoProbe {
  durationSec: number;
  width: number | null;
  height: number | null;
}

/**
 * How long the video is, and how big.
 *
 * Read rather than trusted: `videos.duration_sec` is what the site prints, and the prototype's
 * hand-typed «6:12» had already drifted from the file it described.
 */
export async function probeVideo(path: string, ffprobePath: string): Promise<VideoProbe> {
  const { stdout } = await run(
    resolveBinary('ffprobe', ffprobePath),
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'format=duration:stream=width,height',
      '-of',
      'json',
      path,
    ],
    { timeout: TIMEOUT_MS },
  );

  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { width?: number; height?: number }[];
  };

  const stream = parsed.streams?.[0];

  return {
    durationSec: Math.round(Number(parsed.format?.duration ?? 0)),
    width: stream?.width ?? null,
    height: stream?.height ?? null,
  };
}

/** A single frame, one second in — far enough past a fade-in to be a picture of something. */
export async function extractPoster(
  input: string,
  output: string,
  ffmpegPath: string,
): Promise<void> {
  await run(
    resolveBinary('ffmpeg', ffmpegPath),
    ['-y', '-ss', '1', '-i', input, '-frames:v', '1', '-q:v', '3', output],
    { timeout: TIMEOUT_MS },
  );
}

/**
 * One transcode, to 720p H.264.
 *
 * One rather than a ladder: this is a regional tour operator's site served from a single VPS
 * (decision D-7), and every extra rendition is disk, minutes of CPU per upload and another file
 * in the backup. `faststart` moves the index to the front of the file, which is what lets a
 * browser start playing before it has the whole thing — without it, seeking a self-hosted video
 * means downloading it first.
 */
export async function transcode720p(
  input: string,
  output: string,
  ffmpegPath: string,
): Promise<void> {
  await run(
    resolveBinary('ffmpeg', ffmpegPath),
    [
      '-y',
      '-i',
      input,
      '-vf',
      // Never upscale, and keep the width even, which H.264 requires.
      "scale='min(1280,iw)':-2",
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      output,
    ],
    { timeout: TIMEOUT_MS * 5 },
  );
}

/** Whether the binaries are actually there, so an upload can fail with a sentence not a stack. */
export async function ffmpegAvailable(ffmpegPath: string, ffprobePath: string): Promise<boolean> {
  try {
    await Promise.all([
      run(resolveBinary('ffmpeg', ffmpegPath), ['-version'], { timeout: 10_000 }),
      run(resolveBinary('ffprobe', ffprobePath), ['-version'], { timeout: 10_000 }),
    ]);
    return true;
  } catch {
    return false;
  }
}
