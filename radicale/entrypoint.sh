#!/bin/sh
# Auto-create htpasswd file from env vars on startup
set -e

# Ensure data directory exists with correct permissions
mkdir -p /data

# Use Python to write htpasswd — avoids all shell escaping issues
# (Python is guaranteed available since Radicale is a Python app)
python3 <<'PYEOF'
import os, sys

user = os.environ.get("RADICALE_USER", "barnbook")
pwd = os.environ.get("RADICALE_PASSWORD", "")

if not pwd:
    print("WARNING: RADICALE_PASSWORD not set, skipping htpasswd generation")
    sys.exit(0)

# Write plain-text htpasswd with explicit Unix line endings
path = "/data/users"
line = f"{user}:{pwd}\n"
with open(path, "w", newline="\n") as f:
    f.write(line)

# Verify the file is valid before Radicale tries to read it
with open(path, "r") as f:
    content = f.read().strip()

parts = content.split(":", 1)
if len(parts) == 2 and parts[0] and parts[1]:
    print(f"htpasswd OK: user={parts[0]}, password_len={len(parts[1])}")
else:
    print(f"ERROR: htpasswd malformed — got {len(parts)} parts from: {repr(content)}", file=sys.stderr)
    sys.exit(1)
PYEOF

# Hand off to radicale
exec /venv/bin/radicale --config /config/config
