#!/usr/bin/env bash
# Single command to bring gateway + ngrok up reproducibly for demos.
# Reads NGROK_AUTHTOKEN from .env if present.
#
# Usage: ./infra/start-tunnel.sh
# After running, copy the printed NEXT_PUBLIC_GATEWAY_URL to Vercel (or .env.local for local dev).
# The frontend uses /api/gateway proxy in production, so Vercel env just needs the real gateway URL.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO_ROOT/.env" ] && set -a && . "$REPO_ROOT/.env" && set +a

pkill -f "tsx watch" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true

echo "[start-tunnel] Starting gateway on :8787..."
cd "$REPO_ROOT/packages/gateway" && /Users/kamal/.nvm/versions/node/v23.10.0/bin/pnpm dev > /tmp/gateway.log 2>&1 &
GATEWAY_PID=$!
echo "[start-tunnel] Gateway PID: $GATEWAY_PID"
sleep 4

# Verify gateway is up
if ! curl -sf http://localhost:8787/health > /dev/null; then
  echo "[start-tunnel] ERROR: gateway did not start. Logs:"
  cat /tmp/gateway.log
  exit 1
fi
echo "[start-tunnel] Gateway is healthy."

echo "[start-tunnel] Starting ngrok tunnel for port 8787..."
ngrok http 8787 > /dev/null 2>&1 &
sleep 5

URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data=json.load(sys.stdin); tunnels=data.get('tunnels',[]); print(tunnels[0]['public_url'] if tunnels else '')" 2>/dev/null)
if [ -z "$URL" ]; then
  echo "[start-tunnel] ERROR: could not get ngrok public URL. Is ngrok installed and authenticated?"
  exit 1
fi

echo ""
echo "=========================================="
echo "  Gateway live at: $URL"
echo "=========================================="
echo ""
echo "  Sync to Vercel production:"
echo "    vercel env rm NEXT_PUBLIC_GATEWAY_URL production --yes"
echo "    echo \"$URL\" | vercel env add NEXT_PUBLIC_GATEWAY_URL production"
echo "    vercel --prod"
echo ""
echo "  Local dev (.env.local):"
echo "    NEXT_PUBLIC_GATEWAY_URL=$URL"
echo ""
echo "  Health check: curl -H 'ngrok-skip-browser-warning: true' $URL/health"
echo ""
echo "  Note: The frontend uses /api/gateway proxy in production,"
echo "        so browsers never call ngrok directly (no CORS issues)."
