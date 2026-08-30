/**
 * The VPS cannot download Node (SSL to nodejs.org is blocked).
 * This PC downloads Node 20 and copies it over SSH.
 *
 *   npm run deploy:node
 */
import { createWriteStream } from "node:fs";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

const host = process.env.BookMate_SSH ?? "root@185.10.75.89";
const ver = process.env.NODE_VER ?? "v20.20.2";
const file = `node-${ver}-linux-x64.tar.xz`;
const urls = [
  `https://nodejs.org/dist/${ver}/${file}`,
  `https://cdn.npmmirror.com/binaries/node/${ver}/${file}`,
];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function download(dest) {
  for (const url of urls) {
    console.log(`Downloading ${url}`);
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok || !res.body) {
        console.warn(`  skip (${res.status})`);
        continue;
      }
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      const mb = (statSync(dest).size / 1024 / 1024).toFixed(1);
      if (statSync(dest).size < 5_000_000) {
        console.warn(`  file too small (${mb} MB), trying next mirror`);
        continue;
      }
      console.log(`  saved ${mb} MB`);
      return;
    } catch (err) {
      console.warn(`  ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error("Could not download Node from this PC either.");
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "BookMate-node-"));
const local = path.join(tmp, file);

try {
  await download(local);
  console.log(`Uploading to ${host}:/tmp/node-linux-x64.tar.xz …`);
  run("scp", [local, `${host}:/tmp/node-linux-x64.tar.xz`]);
  console.log("Installing into /usr/local on the VPS …");
  run("ssh", [
    host,
    [
      "set -eu",
      "apt-get install -y xz-utils >/dev/null",
      "apt-get remove -y nodejs libnode72 nodejs-doc 2>/dev/null || true",
      "tar -xJf /tmp/node-linux-x64.tar.xz -C /usr/local --strip-components=1",
      "hash -r",
      "echo NODE=$(/usr/local/bin/node -v)",
      "echo NPM=$(/usr/local/bin/npm -v)",
    ].join(" && "),
  ]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`
Node 20 is on the VPS. Next, in the SSH session:

  export PATH=/usr/local/bin:$PATH
  cd /opt/BookMate
  bash scripts/vps-bootstrap.sh
`);
