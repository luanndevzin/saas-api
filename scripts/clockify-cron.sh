#!/usr/bin/env bash
set -euo pipefail

# Daily sync Clockify -> SaaS time_entries
# Env required:
#   CLOCKIFY_WORKSPACE
#   CLOCKIFY_API_KEY
#   API_URL (ex: https://diplomatic-simplicity-production-70e0.up.railway.app/v1)
#   API_TOKEN (JWT owner/hr)
#   CLOCKIFY_MAP (userId=EMP-001,...) OR CLOCKIFY_MAP_FILE (JSON mapping)
# Optional:
#   SYNC_DAYS_AGO (default 1) range back from today (UTC)
#   PAGE_SIZE (default 200)

DAYS=${SYNC_DAYS_AGO:-1}
PAGE_SIZE=${PAGE_SIZE:-200}

if [[ -z "${CLOCKIFY_WORKSPACE:-}" || -z "${CLOCKIFY_API_KEY:-}" || -z "${API_URL:-}" || -z "${API_TOKEN:-}" ]]; then
  echo "Missing env: CLOCKIFY_WORKSPACE, CLOCKIFY_API_KEY, API_URL, API_TOKEN" >&2
  exit 1
fi

FROM=$(date -u -d "-${DAYS} day" +"%Y-%m-%dT00:00:00Z")
TO=$(date -u +"%Y-%m-%dT00:00:00Z")

CMD=("go" "run" "./cmd/clockify-importer" \
  -workspace "$CLOCKIFY_WORKSPACE" \
  -api-key "$CLOCKIFY_API_KEY" \
  -base-url "$API_URL" \
  -token "$API_TOKEN" \
  -from "$FROM" \
  -to "$TO" \
  -page-size "$PAGE_SIZE")

if [[ -n "${CLOCKIFY_MAP:-}" ]]; then
  CMD+=( -map "$CLOCKIFY_MAP" )
fi
if [[ -n "${CLOCKIFY_MAP_FILE:-}" ]]; then
  CMD+=( -map-file "$CLOCKIFY_MAP_FILE" )
fi

echo "[clockify-cron] Sync $FROM -> $TO (UTC)"
exec "${CMD[@]}"
