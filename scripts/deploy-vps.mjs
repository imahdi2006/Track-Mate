/**
 * Upload BookMate to the VPS over SSH.
 *
 * Default: root@185.10.75.89 → /opt/BookMate
 *
 *   npm run deploy:vps
 *
 * Override:
 *   BookMate_SSH=root@1.2.3.4 BookMate_REMOTE=/opt/BookMate npm run deploy:vps
 *
 * Does not upload node_modules, .next, .git, .data, or .env*.local.
 * After the first upload, SSH in and run:  bash /opt/BookMate/scripts/vps-bootstrap.sh
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.BookMate_SSH ?? "root@185.10.75.89";
const remote = process.env.BookMate_REMOTE ?? "/opt/BookMate";

const excludes = [
  "node_modules",
  ".next",
  ".git",
  ".data",
  ".env",
  ".env.local",
  ".env.production.local",
  "coverage",
  ".cache",
  ".vercel",
  "*.tsbuildinfo",
];

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    cwd: root,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    cwd: root,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `${command} failed\n`);
    process.exit(result.status ?? 1);
  }
  return result;
}

console.log(`Creating ${remote} on ${host} …`);
run("ssh", [host, `mkdir -p ${remote}`]);

const tmp = mkdtempSync(path.join(os.tmpdir(), "BookMate-deploy-"));
const archive = path.join(tmp, "BookMate.tgz");

try {
  const tarArgs = ["-czf", archive, "-C", root];
  for (const name of excludes) {
    tarArgs.push("--exclude", name);
  }
  tarArgs.push(".");
  console.log("Packing project (skipping node_modules, .next, secrets) …");
  runCapture("tar", tarArgs);

  console.log(`Uploading to ${host}:${remote} …`);
  run("scp", [archive, `${host}:${remote}/BookMate-upload.tgz`]);

  console.log("Extracting on the VPS …");
  run("ssh", [
    host,
    `cd ${remote} && tar -xzf BookMate-upload.tgz && rm -f BookMate-upload.tgz && mkdir -p .data && find ${remote} -type f \\( -name '*.sh' -o -name '*.service' \\) -exec sed -i 's/\\r$//' {} +`,
  ]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`
Uploaded to ${remote}

First time on the VPS:
  ssh ${host}
  cd ${remote}
  bash scripts/vps-bootstrap.sh

The app listens on port 8585.
Do not copy .env.local from this PC unless you intend to. Create it on the server.
`);
