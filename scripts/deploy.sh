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
RSYNC_SSH="ssh -p $PORT -i $KEY -o StrictHostKeyChecking=accept-new"

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
# 2. Refuse to ship placeholder photographs — decision D-25
# --------------------------------------------------------------------------------------
# Every image on the site is currently a Wikimedia stand-in with `is_placeholder = 1`, and
# several are CC BY, which requires a credit this site does not print. Shipping them is a
# licensing decision, so it is made deliberately with an environment variable rather than
# silently by whoever runs this script.
if [[ "${ALLOW_PLACEHOLDER_MEDIA:-}" != "yes" ]]; then
  PLACEHOLDERS=$("${SSH[@]}" "cd $ROOT/current/apps/api 2>/dev/null && \
    node -e \"import('mysql2/promise').then(async m => {
      const u = process.env.DATABASE_URL || require('fs').readFileSync('$ROOT/shared/.env','utf8').match(/^DATABASE_URL=(.*)\$/m)[1];
      const c = await m.default.createConnection(u.trim());
      const [r] = await c.query('SELECT COUNT(*) n FROM media WHERE is_placeholder = 1');
      console.log(r[0].n); await c.end();
    }).catch(() => console.log(0))\"" 2>/dev/null || echo 0)

  if [[ "${PLACEHOLDERS:-0}" != "0" ]]; then
    cat >&2 <<EOF

  $PLACEHOLDERS placeholder photographs are in the database (decision D-25).

  They are stand-ins from Wikimedia Commons. Some are CC BY and require a credit this site
  does not print, and none of them are the operator's own. Question Q-1.

  This is a licensing call, not a technical one. To deploy anyway — a closed stand, a
  demonstration — say so explicitly:

      ALLOW_PLACEHOLDER_MEDIA=yes ./scripts/deploy.sh

EOF
    exit 1
  fi
fi

# --------------------------------------------------------------------------------------
# 3. Ship
# --------------------------------------------------------------------------------------
say "release $RELEASE"
"${SSH[@]}" "mkdir -p $TARGET/apps/api $ROOT/shared/uploads $ROOT/shared/logs $ROOT/releases"

# Only what runs. No sources, no node_modules, no design package: the artefact is about 6 MB,
# which is the difference between a deploy that takes seconds and one that takes minutes on a
# connection from Ashgabat.
for app in web-choice web-global web-umrah admin; do
  rsync -az --delete -e "$RSYNC_SSH" "apps/$app/dist/" "$USER@$HOST:$TARGET/apps/$app/"
done
rsync -az --delete -e "$RSYNC_SSH" apps/api/dist/ "$USER@$HOST:$TARGET/apps/api/dist/"

# The API's own manifest and the lockfile, so `pnpm install --prod` on the server resolves the
# same versions. sharp and @node-rs/argon2 ship platform binaries and MUST be installed there:
# a linux-x64 build cannot be produced by rsyncing a Windows `node_modules`.
rsync -az -e "$RSYNC_SSH" apps/api/package.json "$USER@$HOST:$TARGET/apps/api/package.json"
rsync -az -e "$RSYNC_SSH" pnpm-lock.yaml "$USER@$HOST:$TARGET/pnpm-lock.yaml"
rsync -az -e "$RSYNC_SSH" deploy/ecosystem.config.cjs "$USER@$HOST:$TARGET/ecosystem.config.cjs"

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
PREVIOUS=$("${SSH[@]}" "readlink -f $ROOT/current 2>/dev/null || true")

say "switch and restart"
"${SSH[@]}" "ln -sfn $TARGET $ROOT/current && \
  (pm2 reload $ROOT/current/ecosystem.config.cjs --update-env || \
   pm2 start $ROOT/current/ecosystem.config.cjs) && pm2 save"

say "health"
# Against the API directly rather than through nginx: this asks whether the process this
# script just started is answering, and a stale nginx cache could answer for a dead one.
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if "${SSH[@]}" "curl -fsS -m 5 http://127.0.0.1:3002/api/v1/health > /dev/null"; then
    echo "healthy after ${attempt}s"
    break
  fi
  if [[ $attempt -eq 10 ]]; then
    echo "the new release did not come up — rolling back" >&2
    if [[ -n "$PREVIOUS" ]]; then
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
