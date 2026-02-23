#!/bin/sh
# Generate htpasswd file for Radicale authentication
# Usage: ./radicale/setup.sh <username> <password>
# The file is stored in the radicale_data volume

set -e

USER="${1:-barnbook}"
PASS="${2:?Password required}"

# bcrypt hash (requires htpasswd from apache2-utils)
if command -v htpasswd >/dev/null 2>&1; then
  htpasswd -bcB /tmp/radicale_users "$USER" "$PASS"
  echo "Generated htpasswd file at /tmp/radicale_users"
  echo "Copy to Radicale data volume: docker cp /tmp/radicale_users <container>:/data/users"
else
  echo "htpasswd not found. Install apache2-utils or create users file manually."
  echo "Format: username:bcrypt_hash"
  exit 1
fi
