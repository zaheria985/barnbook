#!/bin/sh
# Auto-create htpasswd file from env vars on startup
set -e

USER="${RADICALE_USER:-barnbook}"
PASS="${RADICALE_PASSWORD}"

if [ -z "$PASS" ]; then
  echo "WARNING: RADICALE_PASSWORD not set, skipping htpasswd generation"
else
  # Generate bcrypt hash using passlib (bundled with radicale)
  HASH=$(python3 -c "from passlib.hash import bcrypt; print(bcrypt.using(rounds=12).hash('${PASS}'))")
  echo "${USER}:${HASH}" > /data/users
  echo "Created htpasswd for user: ${USER}"
fi

# Hand off to the default radicale entrypoint
exec python3 -m radicale --config /etc/radicale/config
