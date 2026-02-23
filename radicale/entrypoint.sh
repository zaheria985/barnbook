#!/bin/sh
# Auto-create htpasswd file from env vars on startup
set -e

USER="${RADICALE_USER:-barnbook}"
PASS="${RADICALE_PASSWORD}"

if [ -z "$PASS" ]; then
  echo "WARNING: RADICALE_PASSWORD not set, skipping htpasswd generation"
else
  # Generate htpasswd with plain text (Radicale supports it)
  echo "${USER}:${PASS}" > /data/users
  echo "${USER}:${HASH}" > /data/users
  echo "Created htpasswd for user: ${USER}"
fi

# Hand off to the default radicale entrypoint
exec python3 -m radicale --config /etc/radicale/config
