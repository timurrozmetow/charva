#!/usr/bin/env bash
#
# Builds locally, ships the result, migrates, and switches the symlink.
#
# Run from the repository root on a machine that can build — a laptop, or a CI runner. The VPS
# never builds: four Vite builds and a tsup bundle need more memory than a small server has to
# spare while also running MySQL and answering requests, and an out-of-memory kill halfway
# through a build is a deploy that leaves the site half-replaced.
#
# The release layout is the ordinary one, and every part of it earns its place:
#
#   /opt/charva/releases/<utc-timestamp>/   one deploy, immutable once linked
#   /opt/charva/current -> releases/<...>   the symlink nginx and PM2 resolve
#   /opt/charva/shared/.env                 secrets, outliving every release
#   /opt/charva/shared/uploads/             the only copy of every photograph (D-8)
#   /opt/charva/shared/logs/                PM2's output
#
# Two properties follow from it. A rollback is a symlink swap rather than a rebuild, and
# `uploads/` cannot be deleted by a deploy that goes wrong — which it could if it lived inside
# a release, and which risk R-7 is about.
#
# Usage:  ./scripts/deploy.sh [--skip-verify]
# Reads:  DEPLOY_HOST, DEPLOY_USER, DEPLOY_PORT, DEPLOY_KEY   (or ssh config)

set -euo pipefail

HOST="${DEPLOY_HOST:?set DEPLOY_HOST, e.g. 109.238.94.210}"
USER="${DEPLOY_USER:-charva}"
PORT="${DEPLOY_PORT:-22}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/charva-deploy}"

ROOT="/opt/charva"
RELEASE="$(date -u +%Y%m%d-%H%M%S)"
TARGET="$ROOT/releases/$RELEASE"

SSH=(ssh -p "$PORT" -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST")

say() { printf '\n\033[1m→ %s\033[0m\n' "$*"; }

# --------------------------------------------------------------------------------------
# 1. Prove it works before shipping it
# --------------------------------------------------------------------------------------
if [[ "${1:-}" != "--skip-verify" ]]; then
  say "verify"
  # The full gate: format, design extract, lint, types, 815 tests, build, bundle budget.
  # `--skip-verify` exists for a second attempt after a failed deploy, never for the first.
  pnpm verify
else
  say "verify skipped — building only"
  pnpm build
fi

# The artefact is checked here rather than after the upload. A missing `dist` discovered on the
# server is a half-uploaded release; discovered here it is a message and no change at all.
for app in api web-choice web-global web-umrah admin; do
  [[ -d "apps/$app/dist" ]] || { echo "apps/$app/dist is missing — build failed?" >&2; exit 1; }
done
[[ -f apps/api/dist/server.js ]] || { echo "apps/api/dist/server.js is missing" >&2; exit 1; }
[[ -d apps/api/dist/migrations ]] || { echo "apps/api/dist/migrations is missing" >&2; exit 1; }

# --------------------------------------------------------------------------------------
# 2. Refuse to ship a borrowed photograph with nobody's name on it — decision D-25
# --------------------------------------------------------------------------------------
# This check used to count `is_placeholder = 1`, and that was the right question while the
# Wikimedia photographs were stand-ins waiting for a shoot. The owner decided otherwise: they
# are the site's photographs now, the flag is `0`, and a check that can no longer fire is not
# a check.
#
# What is still true is that they are somebody else's work, and that CC BY and CC BY-SA both
# require a visible credit. So the gate moved to the thing that would actually go wrong: a
# `source = 'stock'` row with no author or no licence recorded is one the credits page cannot
# name, which means publishing it is a licence breach nobody can even see.
if [[ "${ALLOW_UNCREDITED_MEDIA:-}" != "yes" ]]; then
  UNCREDITED=$("${SSH[@]}" "cd $ROOT/current/apps/api 2>/dev/null && \
    node -e \"import('mysql2/promise').then(async m => {
      const u = process.env.DATABASE_URL || require('fs').readFileSync('$ROOT/shared/.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
      const c = await m.default.createConnection(u.trim());
      const [r] = await c.query(\\\"SELECT COUNT(*) n FROM media WHERE source = 'stock' AND (attribution IS NULL OR attribution = '' OR license IS NULL OR license = '')\\\");
      console.log(r[0].n); await c.end();
    }).catch(() => console.log(0))\"" 2>/dev/null || echo 0)

  if [[ "${UNCREDITED:-0}" != "0" ]]; then
    cat >&2 <<EOF

  $UNCREDITED borrowed photographs have no author or no licence recorded (decision D-25).

  Every row with source='stock' came from Wikimedia Commons, and CC BY and CC BY-SA require
  the author to be named where the photograph is published. /credits prints what the database
  holds; a row with an empty attribution is one it cannot name.

  Fix the rows, or say explicitly that this deploy ships them anyway:

      ALLOW_UNCREDITED_MEDIA=yes ./scripts/deploy.sh

EOF
    exit 1
  fi
fi

# --------------------------------------------------------------------------------------
# 3. Ship
# --------------------------------------------------------------------------------------
say "release $RELEASE"
"${SSH[@]}" "mkdir -p $TARGET/apps/api $ROOT/shared/uploads $ROOT/shared/logs $ROOT/releases"

# `current` must be a symlink or absent, never a real directory. `ln -sfn release current`
# against a directory does not replace it — it creates the link *inside* it — and the deploy
# then reports success while nginx and PM2 read a path that holds nothing. Cheap to check,
# and invisible if it ever happens.
"${SSH[@]}" "! test -d $ROOT/current || test -L $ROOT/current" || {
  echo "$ROOT/current is a real directory; it has to be a symlink. Remove it and deploy again." >&2
  exit 1
}

# One tar streamed over one ssh connection, rather than rsync.
#
# rsync is not a choice here: this script runs from a laptop, and Git Bash on Windows ships ssh
# and tar and no rsync at all. Nothing is lost by the swap — every release is a fresh empty
# directory, so there is no delta for rsync to compute and it would send the whole tree anyway.
ship_dir() {
  "${SSH[@]}" "mkdir -p '$2'"
  tar -czf - -C "$1" . | "${SSH[@]}" "tar -xzf - -C '$2'"
}

ship_stdin() {
  "${SSH[@]}" "cat > '$1'"
}

# Only what runs. No sources, no node_modules, no design package: the artefact is about 6 MB,
# which is the difference between a deploy that takes seconds and one that takes minutes on a
# connection from Ashgabat.
for app in web-choice web-global web-umrah admin; do
  ship_dir "apps/$app/dist" "$TARGET/apps/$app"
done
ship_dir apps/api/dist "$TARGET/apps/api/dist"

# The manifest is rewritten rather than copied — see scripts/production-manifest.mjs, which
# explains each of the three reasons. The short version: `apps/api/package.json` depends on
# "@charva/contracts": "workspace:*", and pnpm outside a workspace refuses that specifier
# outright, so shipping the file as it stands fails the install step below on every deploy,
# starting with the first. The generated manifest drops the workspace packages — tsup already
# bundled them into dist/ — pins every remaining version to the exact one this build was
# verified against, and carries the `onlyBuiltDependencies` allowance that otherwise lives in
# pnpm-workspace.yaml, without which sharp and @node-rs/argon2 install with no platform binary
# and fail at the first request rather than at install time.
#
# The lockfile is not shipped for the same reason it never worked: with --ignore-workspace pnpm
# reads a lockfile beside the manifest, not one a directory above, so the root lockfile that
# used to be copied here was never consulted. Exact versions in the manifest do the job it was
# meant to do for every direct dependency; transitive ones resolve within their own ranges.
node scripts/production-manifest.mjs | ship_stdin "$TARGET/apps/api/package.json"
ship_stdin "$TARGET/ecosystem.config.cjs" < deploy/ecosystem.config.cjs

say "install production dependencies"
"${SSH[@]}" "cd $TARGET/apps/api && pnpm install --prod --ignore-workspace --no-frozen-lockfile"

# The shared files are linked, never copied. A copy would drift, and the one that drifts is
# always `.env`.
"${SSH[@]}" "ln -sfn $ROOT/shared/.env $TARGET/.env"

# --------------------------------------------------------------------------------------
# 4. Migrate before switching, roll back if it fails
# --------------------------------------------------------------------------------------
# Forward-only and additive so far, so the running old release survives a migration that has
# already been applied. If this ever stops being true, the schema change and the code change
# have to be split across two deploys — which is a note in DEPLOY.md, not a thing to discover.
say "migrate"
if ! "${SSH[@]}" "cd $TARGET/apps/api && node dist/migrate.js"; then
  echo "migration failed — the release was NOT switched, the site is untouched" >&2
  "${SSH[@]}" "rm -rf $TARGET"
  exit 1
fi

# --------------------------------------------------------------------------------------
# 5. Switch, restart, check
# --------------------------------------------------------------------------------------
# `test -L` first, and that guard is the whole point. `readlink -f` prints a canonical path even
# when the last component does not exist, so on a first deploy it answered `/opt/charva/current`
# — and the rollback below then ran `ln -sfn /opt/charva/current /opt/charva/current`, pointing
# the symlink at itself. Every path through it becomes ELOOP: nginx serves 404 for the whole
# site, the shell cannot read an index.html, and the running process keeps answering because it
# resolved its directory at start. That is a deploy that reports failure and leaves the site
# worse than the failure did.
PREVIOUS=$("${SSH[@]}" "test -L $ROOT/current && readlink -f $ROOT/current || true")

say "switch and restart"
"${SSH[@]}" "ln -sfn $TARGET $ROOT/current && \
  (pm2 reload $ROOT/current/ecosystem.config.cjs --update-env || \
   pm2 start $ROOT/current/ecosystem.config.cjs) && pm2 save"

say "health"
# Against the API directly rather than through nginx: this asks whether the process this
# script just started is answering, and a stale nginx cache could answer for a dead one.
#
# `/ready` and `/health` both sit at the root, NOT under /api/v1 — they are not part of the
# versioned surface, and asking for /api/v1/health gets a well-formed 404 from the API's own
# error envelope. This loop asked for exactly that and rolled back ten seconds after a deploy
# that had in fact worked. `/ready` rather than `/health` because it round-trips the database:
# a release that cannot reach MySQL is not one to switch to.
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if "${SSH[@]}" "curl -fsS -m 5 http://127.0.0.1:3002/ready > /dev/null"; then
    echo "healthy after ${attempt}s"
    break
  fi
  if [[ $attempt -eq 10 ]]; then
    echo "the new release did not come up — rolling back" >&2
    if [[ -n "$PREVIOUS" && "$PREVIOUS" != "$ROOT/current" && "$PREVIOUS" != "$TARGET" ]]; then
      "${SSH[@]}" "ln -sfn $PREVIOUS $ROOT/current && pm2 reload $ROOT/current/ecosystem.config.cjs --update-env"
      echo "rolled back to $PREVIOUS" >&2
    fi
    exit 1
  fi
  sleep 1
done

# --------------------------------------------------------------------------------------
# 6. Keep five releases
# --------------------------------------------------------------------------------------
# Enough to step back through a bad week, few enough that a 40 GB disk shared with the video
# uploads does not fill up with copies of a 6 MB bundle nobody will ever roll back to.
"${SSH[@]}" "cd $ROOT/releases && ls -1dt */ | tail -n +6 | xargs -r rm -rf"

say "deployed $RELEASE"
