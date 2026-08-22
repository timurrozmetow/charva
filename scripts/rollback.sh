#!/usr/bin/env bash
#
# Points `current` back at the previous release and restarts.
#
# A symlink swap, which is why it takes a second and why it is worth having at all: the thing
# a rollback must not do at three in the morning is build. `deploy.sh` keeps five releases, so
# this can step back five times.
#
# What it does NOT undo is the database. Migrations are forward-only (D-2 of the schema notes),
# and an additive migration is harmless to the older code — a column it does not select. A
# migration that removes or renames something is not, and the release before it will not run
# against the schema after it. That case needs a restore from `backup.sh`, and this script
# says so rather than pretending otherwise.
#
# Usage:  ./scripts/rollback.sh [release]     without an argument, the one before current

set -euo pipefail

HOST="${DEPLOY_HOST:?set DEPLOY_HOST}"
USER="${DEPLOY_USER:-charva}"
PORT="${DEPLOY_PORT:-22}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/charva-deploy}"

ROOT="/opt/charva"
SSH=(ssh -p "$PORT" -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST")

CURRENT=$("${SSH[@]}" "basename \$(readlink -f $ROOT/current)")
WANT="${1:-}"

if [[ -z "$WANT" ]]; then
  # Sorted by name, which is a UTC timestamp, which sorts chronologically. The one directly
  # before the current one — not simply the second newest, because rolling back twice would
  # otherwise return to the release just left.
  WANT=$("${SSH[@]}" "cd $ROOT/releases && ls -1 | sort | grep -B1 -x '$CURRENT' | head -1")
fi

if [[ -z "$WANT" || "$WANT" == "$CURRENT" ]]; then
  echo "nothing to roll back to — $CURRENT is the oldest release kept" >&2
  "${SSH[@]}" "ls -1 $ROOT/releases" >&2
  exit 1
fi

"${SSH[@]}" "test -d $ROOT/releases/$WANT" || { echo "no such release: $WANT" >&2; exit 1; }

printf '\n\033[1m→ %s → %s\033[0m\n' "$CURRENT" "$WANT"

"${SSH[@]}" "ln -sfn $ROOT/releases/$WANT $ROOT/current && \
  pm2 reload $ROOT/current/ecosystem.config.cjs --update-env && pm2 save"

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if "${SSH[@]}" "curl -fsS -m 5 http://127.0.0.1:3002/api/v1/health > /dev/null"; then
    echo "healthy — now on $WANT"
    exit 0
  fi
  [[ $attempt -eq 10 ]] && break
  sleep 1
done

cat >&2 <<EOF

  $WANT is linked but not answering.

  If the deploy that is being undone carried a migration that removed or renamed something,
  this release cannot run against the current schema and no symlink will fix it. Restore the
  database from the last backup:

      ./scripts/backup.sh --restore <archive>

EOF
exit 1
