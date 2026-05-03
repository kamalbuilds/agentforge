#!/bin/bash
# Generate ed25519 key if missing, then start AXL node

set -e

KEY_PATH="/app/private.pem"

if [ ! -f "$KEY_PATH" ]; then
  echo "Generating new ed25519 private key at $KEY_PATH..."
  openssl genpkey -algorithm ed25519 -out "$KEY_PATH"
  echo "Key generated successfully"
else
  echo "Using existing key at $KEY_PATH"
fi

echo "Starting AXL node..."
exec /usr/local/bin/axl-node -config /app/node-config.json
