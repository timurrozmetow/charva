#!/usr/bin/env bash
#
# The database AND the uploads, in one archive.
#
# Both, always, and this is the whole reason the script exists rather than a cron line calling
# mysqldump. `media.storage_key` holds a path on disk, not the bytes — decision D-8 — so a
# dump alone restores a site where every row points at a file that is not there. Every page is
# built on photographs; the result is a site-shaped 404. Risk R-7.
#
# The two halves must also come from the same moment. Dumping the database first and copying
# the files second means a photograph uploaded in between is on disk with no row, which is
# harmless, while the other order gives a row with no file, which is a broken page. So: rows
# first, files second, deliberately.
#
# Runs ON the server (cron), or from a laptop over ssh with --remote.
#
# Usage:
#   ./scripts/backup.sh                      make an archive
#   ./scripts/backup.sh --restore <archive>  put one back, database and files together
#   ./scripts/backup.sh --verify <archive>   check it without restoring anything

set -euo pipefail

ROOT="/opt/charva"
DEST="${BACKUP_DIR:-$ROOT/backups}"
KEEP="${BACKUP_KEEP:-14}"

env_value() {
  # Read one variable out of the shared .env without sourcing it: that file contains secrets
  # with characters a shell would happily interpret.
  sed -n "s/^$1=//p" "$ROOT/shared/.env" | head -1
}

# Everything this script has to delete on the way out, in one list, because a `trap ... EXIT`
# written twice keeps only the second — and the one that would have been lost here is the file
# holding the database password.
CLEANUP=()
cleanup() {
  if [[ ${#CLEANUP[@]} -gt 0 ]]; then rm -rf "${CLEANUP[@]}"; fi
}
trap cleanup EXIT

MYSQL_DEFAULTS=""
MYSQL_DB=""

urldecode() {
  # %40 → @. printf's %b reads \x40, so the percent signs become the escape and printf does the
  # rest. A literal backslash in a password would be read as an escape — DEPLOY.md asks for a
  # base64url password for exactly that reason.
  printf '%b' "${1//%/\\x}"
}

mysql_config() {
  # The MySQL clients do not speak URLs. `mysqldump mysql://user:pass@host/db` reads the whole
  # string as a database NAME and connects as the operating-system user, which fails with
  # «Access denied for user 'charva'@'localhost'» — an error that reads like a wrong password
  # and is not one. Only MySQL Shell parses URIs. So DATABASE_URL is taken apart here.
  #
  # The credentials then go into a defaults-file rather than onto the command line, where `ps`
  # would show the database password to every user on the machine for the length of the dump.
  local url rest creds hostpart user pass host port name
  url="$(env_value DATABASE_URL)"
  [[ -n "$url" ]] || { echo "no DATABASE_URL in $ROOT/shared/.env" >&2; exit 1; }

  rest="${url#mysql://}"
  [[ "$rest" != "$url" ]] || { echo "DATABASE_URL is not a mysql:// url" >&2; exit 1; }

  creds="${rest%%@*}"
  hostpart="${rest#*@}"
  user="${creds%%:*}"
  pass=""
  [[ "$creds" == *:* ]] && pass="${creds#*:}"

  name="${hostpart#*/}"
  name="${name%%\?*}"
  hostpart="${hostpart%%/*}"
  host="${hostpart%%:*}"
  port=3306
  [[ "$hostpart" == *:* ]] && port="${hostpart#*:}"

  [[ -n "$name" ]] || { echo "DATABASE_URL names no database" >&2; exit 1; }

  MYSQL_DB="$(urldecode "$name")"
  MYSQL_DEFAULTS="$(mktemp)"
  CLEANUP+=("$MYSQL_DEFAULTS")
  chmod 600 "$MYSQL_DEFAULTS"
  printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' \
    "$(urldecode "$user")" "$(urldecode "$pass")" "$host" "$port" > "$MYSQL_DEFAULTS"
}

make_backup() {
  local stamp work archive
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  mysql_config

  work="$(mktemp -d)"
  CLEANUP+=("$work")
  mkdir -p "$DEST"

  echo "→ database"
  # `--single-transaction` so the dump is consistent without locking the site for its
  # duration; InnoDB throughout, so it applies to every table.
  # `--no-tablespaces` because the account owns one schema and nothing else (DEPLOY.md step 3.2).
  # Without it mysqldump asks the server for tablespace metadata, which needs the global PROCESS
  # privilege, and prints «Access denied … PROCESS» into the cron log on every single run — an
  # error line above a backup that in fact succeeded, which is how a log stops being read.
  mysqldump --defaults-file="$MYSQL_DEFAULTS" --no-tablespaces \
    --single-transaction --quick --routines --triggers --default-character-set=utf8mb4 \
    --result-file="$work/charva.sql" "$MYSQL_DB"

  echo "→ uploads"
  # Hard links rather than a copy: the archive is written from this tree a moment later, and
  # hundreds of megabytes of video do not need to exist twice on a disk that may be 40 GB.
  cp -al "$(env_value UPLOADS_DIR)" "$work/uploads" 2>/dev/null \
    || cp -a "$(env_value UPLOADS_DIR)" "$work/uploads"

  # What was running when this was taken. A restore six months from now needs to know which
  # code the schema belongs to, and «which commit was live» is not a question anyone can
  # answer from a dump.
  {
    echo "taken_at=$(date -u +%FT%TZ)"
    echo "release=$(basename "$(readlink -f $ROOT/current)")"
    echo "migrations=$(mysql --defaults-file="$MYSQL_DEFAULTS" --default-character-set=utf8mb4 \
      "$MYSQL_DB" -Nse 'SELECT COUNT(*) FROM schema_migrations' 2>/dev/null || echo '?')"
  } > "$work/MANIFEST"

  archive="$DEST/charva-$stamp.tar.gz"
  tar -czf "$archive" -C "$work" charva.sql uploads MANIFEST
  echo "→ $archive ($(du -h "$archive" | cut -f1))"

  # Keep a fortnight. Long enough that a problem noticed on return from a trip is still
  # recoverable, short enough not to fill a small disk with video.
  find "$DEST" -name 'charva-*.tar.gz' -type f -printf '%T@ %p\n' \
    | sort -rn | tail -n "+$((KEEP + 1))" | cut -d' ' -f2- | xargs -r rm -f
}

verify_backup() {
  local archive="$1" work
  work="$(mktemp -d)"
  CLEANUP+=("$work")

  tar -xzf "$archive" -C "$work"
  cat "$work/MANIFEST"

  local rows files media
  rows=$(grep -c '^INSERT INTO' "$work/charva.sql" || true)
  files=$(find "$work/uploads" -type f | wc -l)
  # Rows in `media` specifically, not statements anywhere: those are what point at a file on
  # disk. Counting every INSERT made this check fail on a freshly seeded site, which has a
  # catalogue and no photographs yet — a correct backup called broken, which is how a check
  # stops being read.
  media=$(grep -c '^INSERT INTO `media`' "$work/charva.sql" || true)
  echo "insert statements: $rows"
  echo "media rows:        $media"
  echo "files in uploads:  $files"

  # An archive with media rows and no files is exactly the false backup this script exists to
  # prevent, and it is worth failing on rather than reporting neutrally.
  if [[ "$files" -eq 0 && "$media" -gt 0 ]]; then
    echo "this archive has media rows and no photographs — see risk R-7" >&2
    exit 1
  fi
  echo "ok"
}

restore_backup() {
  local archive="$1" work uploads
  mysql_config
  uploads="$(env_value UPLOADS_DIR)"

  work="$(mktemp -d)"
  CLEANUP+=("$work")
  tar -xzf "$archive" -C "$work"

  echo "restoring $(sed -n 's/^taken_at=//p' "$work/MANIFEST") over the live database and uploads."
  read -r -p "type the word yes to continue: " answer
  [[ "$answer" == "yes" ]] || { echo "stopped"; exit 1; }

  echo "→ database"
  mysql --defaults-file="$MYSQL_DEFAULTS" --default-character-set=utf8mb4 "$MYSQL_DB" \
    < "$work/charva.sql"

  echo "→ uploads"
  # Additive on purpose. A photograph uploaded after the backup was taken has a row that this
  # restore is about to remove, so the file is already orphaned — but deleting it makes the
  # loss permanent, and leaving it costs disk. Disk is cheaper than a photograph.
  mkdir -p "$uploads"
  cp -a "$work/uploads/." "$uploads/"

  echo "restored. restart with: pm2 reload $ROOT/current/ecosystem.config.cjs"
}

case "${1:-}" in
  --restore) restore_backup "${2:?usage: --restore <archive>}" ;;
  --verify)  verify_backup  "${2:?usage: --verify <archive>}" ;;
  "")        make_backup ;;
  *)         echo "usage: $0 [--restore <archive> | --verify <archive>]" >&2; exit 1 ;;
esac
