import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db/sqlite";

const RESET_TTL_MS = 60 * 60 * 1000;

export interface ServerUser {
  email: string;
  profileId: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function randomSalt(): string {
  return randomBytes(16).toString("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a.trim().toLowerCase(), "hex");
    const right = Buffer.from(b.trim().toLowerCase(), "hex");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

type UserRow = {
  email: string;
  profile_id: string;
  display_name: string;
  salt: string;
  password_hash: string;
  created_at: string;
};

function rowToUser(row: UserRow): ServerUser {
  return {
    email: row.email,
    profileId: row.profile_id,
    displayName: row.display_name,
    salt: row.salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function upsertUser(input: {
  email: string;
  password: string;
  profileId: string;
  displayName: string;
  mode: "signup" | "signin";
}): Promise<ServerUser> {
  const email = normalizeEmail(input.email);
  const database = getDb();

  const existing = database
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;

  if (existing) {
    const ok = safeEqualHex(existing.password_hash, hashPassword(input.password, existing.salt));
    if (!ok) {
      throw new Error(
        input.mode === "signup"
          ? "Wrong password. This email is already registered — use Sign in or Forgot password."
          : "Wrong password.",
      );
    }
    if (input.displayName) {
      database
        .prepare("UPDATE users SET display_name = ? WHERE email = ?")
        .run(input.displayName, email);
      existing.display_name = input.displayName;
    }
    return rowToUser(existing);
  }

  const salt = randomSalt();
  const user: ServerUser = {
    email,
    profileId: input.profileId,
    displayName: input.displayName || email.split("@")[0] || "Reader",
    salt,
    passwordHash: hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
  };

  database
    .prepare(
      `INSERT INTO users (email, profile_id, display_name, salt, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(user.email, user.profileId, user.displayName, user.salt, user.passwordHash, user.createdAt);

  return user;
}

export async function verifyUser(email: string, password: string): Promise<ServerUser | null> {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  if (!row) return null;
  const ok = safeEqualHex(row.password_hash, hashPassword(password, row.salt));
  return ok ? rowToUser(row) : null;
}

export async function findUser(email: string): Promise<ServerUser | null> {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export async function issueResetToken(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  const database = getDb();
  const user = database.prepare("SELECT email FROM users WHERE email = ?").get(normalized);
  if (!user) return null;

  const token = randomToken();
  const now = Date.now();
  database.prepare("DELETE FROM password_resets WHERE email = ? OR exp_ms <= ?").run(normalized, now);
  database
    .prepare("INSERT INTO password_resets (token_hash, email, exp_ms) VALUES (?, ?, ?)")
    .run(hashToken(token), normalized, now + RESET_TTL_MS);
  return token;
}

export async function consumeResetToken(token: string): Promise<ServerUser | null> {
  const tokenHash = hashToken(token);
  const database = getDb();
  const now = Date.now();
  const reset = database
    .prepare("SELECT email FROM password_resets WHERE token_hash = ? AND exp_ms > ?")
    .get(tokenHash, now) as { email: string } | undefined;
  if (!reset) return null;

  database.prepare("DELETE FROM password_resets WHERE token_hash = ?").run(tokenHash);
  const row = database.prepare("SELECT * FROM users WHERE email = ?").get(reset.email) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export async function updatePassword(email: string, password: string): Promise<ServerUser | null> {
  const normalized = normalizeEmail(email);
  const database = getDb();
  const row = database.prepare("SELECT * FROM users WHERE email = ?").get(normalized) as UserRow | undefined;
  if (!row) return null;

  const salt = randomSalt();
  const passwordHash = hashPassword(password, salt);
  database.prepare("UPDATE users SET salt = ?, password_hash = ? WHERE email = ?").run(salt, passwordHash, normalized);
  return rowToUser({ ...row, salt, password_hash: passwordHash });
}
