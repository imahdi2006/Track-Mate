/**
 * The VPS cannot reach registry.npmjs.org (same SSL block as Node).
 * This PC downloads Linux x64 packages and copies node_modules over SSH.
 *
 *   npm run deploy:modules
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.BookMate_SSH ?? "root@185.10.75.89";
const remote = process.env.BookMate_REMOTE ?? "/opt/BookMate";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    // Windows cmd splits on && and runs rm locally. ssh/scp/tar must not use a shell.
    shell: opts.shell ?? false,
    ...opts,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const work = mkdtempSync(path.join(os.tmpdir(), "BookMate-mods-"));
const archive = path.join(os.tmpdir(), "BookMate-node-modules.tgz");

try {
  cpSync(path.join(root, "package.json"), path.join(work, "package.json"));
  cpSync(path.join(root, "package-lock.json"), path.join(work, "package-lock.json"));
  mkdirSync(path.join(work, "scripts"), { recursive: true });

  console.log("Downloading Linux packages on this PC (not the VPS) …");
  run(
    npmBin,
    [
      "ci",
      "--os=linux",
      "--cpu=x64",
      "--libc=glibc",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: work, shell: process.platform === "win32" },
  );

  console.log("Installing Linux better-sqlite3 native binding …");
  const sqliteRoot = path.join(work, "node_modules", "better-sqlite3");
  const binding = path.join(sqliteRoot, "build", "Release", "better_sqlite3.node");
  // npm ci --ignore-scripts skips prebuild-install; fetch the Linux .node from GitHub releases.
  run(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prebuild-install"],
    {
      cwd: sqliteRoot,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        npm_config_platform: "linux",
        npm_config_arch: "x64",
      },
    },
  );
  if (!existsSync(binding)) {
    console.error("Missing better_sqlite3.node — database will not work on the VPS.");
    process.exit(1);
  }

  console.log("Packing node_modules …");
  run("tar", ["-czf", archive, "-C", work, "node_modules"]);

  console.log(`Uploading to ${host}:${remote} (this can take a few minutes) …`);
  run("scp", [archive, `${host}:${remote}/BookMate-node-modules.tgz`]);

  console.log("Extracting on the VPS …");
  run("ssh", [
    host,
    `cd ${remote} && rm -rf node_modules && tar -xzf BookMate-node-modules.tgz && rm -f BookMate-node-modules.tgz && chmod +x node_modules/.bin/* 2>/dev/null; chmod +x node_modules/next/dist/bin/next 2>/dev/null; test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node && echo SQLITE_OK || echo SQLITE_MISSING; export PATH=/usr/local/bin:$PATH && node -v`,
  ]);
} finally {
  rmSync(work, { recursive: true, force: true });
  try {
    rmSync(archive, { force: true });
  } catch {
    /* ignore */
  }
}

console.log(`
node_modules is on the VPS. In SSH:

  export PATH=/usr/local/bin:$PATH
  cd /opt/BookMate
  chmod +x node_modules/.bin/* node_modules/next/dist/bin/next
  node node_modules/next/dist/bin/next build
  node node_modules/next/dist/bin/next start -p 8585
`);
