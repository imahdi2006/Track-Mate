import Database from "better-sqlite3";
import { readFileSync, renameSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "pagemate.db");
const AUTH_JSON = path.join(DATA_DIR, "auth.json");
const PAIRS_JSON = path.join(DATA_DIR, "pairs.json");

let db: Database.Database | null = null;

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      profile_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE,
      exp_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

    CREATE TABLE IF NOT EXISTS pair_docs (
      buddy_code TEXT PRIMARY KEY COLLATE NOCASE,
      doc_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function migrateFromJson(database: Database.Database): void {
  const userCount = database.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (userCount.n === 0 && existsSync(AUTH_JSON)) {
    try {
      const raw = readFileSync(AUTH_JSON, "utf8");
      const parsed = JSON.parse(raw) as {
        users?: Record<
          string,
          {
            email: string;
            profileId: string;
            displayName: string;
            salt: string;
            passwordHash: string;
            createdAt: string;
          }
        >;
        resets?: { email: string; tokenHash: string; exp: number }[];
      };
      const insertUser = database.prepare(`
        INSERT OR IGNORE INTO users (email, profile_id, display_name, salt, password_hash, created_at)
        VALUES (@email, @profileId, @displayName, @salt, @passwordHash, @createdAt)
      `);
      const insertReset = database.prepare(`
        INSERT OR IGNORE INTO password_resets (token_hash, email, exp_ms)
        VALUES (@tokenHash, @email, @exp)
      `);
      for (const user of Object.values(parsed.users ?? {})) {
        insertUser.run({
          email: user.email,
          profileId: user.profileId,
          displayName: user.displayName,
          salt: user.salt,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
        });
      }
      const now = Date.now();
      for (const reset of parsed.resets ?? []) {
        if (reset.exp > now) {
          insertReset.run(reset);
        }
      }
      renameSync(AUTH_JSON, `${AUTH_JSON}.migrated`);
    } catch {
      /* keep json */
    }
  }

  const pairCount = database.prepare("SELECT COUNT(*) AS n FROM pair_docs").get() as { n: number };
  if (pairCount.n === 0 && existsSync(PAIRS_JSON)) {
    try {
      const raw = readFileSync(PAIRS_JSON, "utf8");
      const parsed = JSON.parse(raw) as { pairs?: Record<string, unknown> };
      const insertPair = database.prepare(`
        INSERT OR IGNORE INTO pair_docs (buddy_code, doc_json, updated_at)
        VALUES (@buddyCode, @docJson, @updatedAt)
      `);
      for (const [code, doc] of Object.entries(parsed.pairs ?? {})) {
        insertPair.run({
          buddyCode: code.trim().toUpperCase(),
          docJson: JSON.stringify(doc),
          updatedAt: new Date().toISOString(),
        });
      }
      renameSync(PAIRS_JSON, `${PAIRS_JSON}.migrated`);
    } catch {
      /* keep json */
    }
  }
}

/** SQLite at .data/pagemate.db — accounts, resets, and pair/library JSON docs. */
export function getDb(): Database.Database {
  if (db) return db;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    initSchema(db);
    migrateFromJson(db);
    return db;
  } catch (err) {
    // This local SQLite demo path only works on a normal writable
    // filesystem (e.g. `npm run dev` on your machine). On Vercel/most
    // serverless hosts the deployed code lives on a read-only filesystem
    // (only `/tmp` is writable), so `mkdir .data` throws ENOENT/EACCES here
    // — every time — unless `isSupabaseConfigured()` was true and this
    // path was never supposed to run at all. In practice, hitting this
    // means the Supabase env vars aren't actually set for this deployment.
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `This deployment isn't configured for production auth (${detail}). ` +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in " +
        "Vercel \u2192 Settings \u2192 Environment Variables, then redeploy " +
        "(env var changes need a fresh deploy to take effect) \u2014 don't rely on " +
        "the local SQLite demo in production.",
    );
  }
}

export function dbPath(): string {
  return DB_PATH;
}
