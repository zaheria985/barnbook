#!/bin/sh
# Auto-create htpasswd file from env vars on startup
set -e

USER="${RADICALE_USER:-barnbook}"
PASS="${RADICALE_PASSWORD}"

if [ -z "$PASS" ]; then
  echo "WARNING: RADICALE_PASSWORD not set, skipping htpasswd generation"
else
  # Generate bcrypt hash using python (available in the radicale image)
  HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'${PASS}', bcrypt.gensalt()).decode())")
  echo "${USER}:${HASH}" > /data/users
  echo "Created htpasswd for user: ${USER}"
fi

# Hand off to the default radicale entrypoint
exec python3 -m radicale --config /etc/radicale/config
