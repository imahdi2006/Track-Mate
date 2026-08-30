#!/usr/bin/env bash
# Install Node.js 20 binaries into /usr/local (skips Ubuntu's Node 12).
# Run on the VPS: bash /opt/pagemate/scripts/vps-install-node.sh
set -eu

NODE_VER="${NODE_VER:-v20.20.2}"
FILE="node-${NODE_VER}-linux-x64.tar.xz"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl xz-utils
apt-get remove -y nodejs libnode72 nodejs-doc 2>/dev/null || true

TMP="$(mktemp -d)"
cd "$TMP"

ok=0
for url in \
  "https://nodejs.org/dist/${NODE_VER}/${FILE}" \
  "https://cdn.npmmirror.com/binaries/node/${NODE_VER}/${FILE}" \
  "https://npmmirror.com/mirrors/node/${NODE_VER}/${FILE}"
do
  echo "Trying ${url}"
  if curl -fL --retry 3 --retry-delay 2 -o "${FILE}" "${url}"; then
    ok=1
    break
  fi
done

if [ "$ok" -ne 1 ]; then
  echo "Could not download Node ${NODE_VER}. Check outbound HTTPS."
  exit 1
fi

tar -xJf "${FILE}" -C /usr/local --strip-components=1
rm -rf "$TMP"
hash -r

echo "Node $(/usr/local/bin/node -v)"
echo "npm  $(/usr/local/bin/npm -v)"
