#!/usr/bin/env bash
# Run ON the VPS after: npm run deploy:vps
# Usage: bash /opt/pagemate/scripts/vps-bootstrap.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_PORT="${PAGEMATE_PORT:-8585}"
PUBLIC_URL="${NEXT_PUBLIC_APP_URL:-http://185.10.75.89:${APP_PORT}}"
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  command -v npm >/dev/null 2>&1 || return 1
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  [ "$NODE_MAJOR" -ge 18 ]
}

if ! node_ok; then
  if [ -f /tmp/node-linux-x64.tar.xz ]; then
    echo "Installing Node from /tmp/node-linux-x64.tar.xz …"
    tar -xJf /tmp/node-linux-x64.tar.xz -C /usr/local --strip-components=1
    hash -r
    export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
  fi
fi

if ! node_ok; then
  echo "This VPS cannot download Node (SSL blocked)."
  echo "On your Windows PC, in C:\\work\\PageMate, run:"
  echo "  npm run deploy:node"
  echo "Then run this script again."
  exit 1
fi

echo "Using Node $(node -v) / npm $(npm -v)"

mkdir -p "${ROOT}/.data"
chmod 700 "${ROOT}/.data"

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${PUBLIC_URL}|" .env.local
  echo "Wrote .env.local with NEXT_PUBLIC_APP_URL=${PUBLIC_URL}"
fi

echo "Installing npm packages …"
if [ ! -x "${ROOT}/node_modules/.bin/next" ]; then
  echo "No next binary. If npm hangs, Ctrl+C and on your PC run: npm run deploy:modules"
  npm ci --loglevel=http --fetch-retries=2 --fetch-timeout=20000 || {
    echo "npm ci failed or hung. On your PC: npm run deploy:modules"
    exit 1
  }
fi
export PATH="${ROOT}/node_modules/.bin:${PATH}"

if ! grep -q '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.\+' .env.local; then
  echo "" >> .env.local
  node scripts/generate-vapid-keys.mjs >> .env.local
  echo "Appended VAPID keys to .env.local"
fi

echo "Building Next.js …"
npx next build

echo ""
echo "Build OK. Open ${PUBLIC_URL}"

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^pagemate.service'; then
  cp -f "${ROOT}/scripts/pagemate.service" /etc/systemd/system/pagemate.service
  systemctl daemon-reload
  systemctl enable --now pagemate
  systemctl restart pagemate
  systemctl --no-pager --full status pagemate || true
else
  echo "Starting BookMate on port ${APP_PORT} …"
  exec npx next start -p "$APP_PORT"
fi
