import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const STORE_PATH = path.join(process.cwd(), ".data", "auth.json");
const RESET_TTL_MS = 60 * 60 * 1000;

export interface ServerUser {
  email: string;
  profileId: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface ResetRecord {
  email: string;
  tokenHash: string;
  exp: number;
}

interface AuthStore {
  users: Record<string, ServerUser>;
  resets: ResetRecord[];
}

function emptyStore(): AuthStore {
  return { users: {}, resets: [] };
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
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

async function readStore(): Promise<AuthStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AuthStore;
    return {
      users: parsed.users ?? {},
      resets: Array.isArray(parsed.resets) ? parsed.resets : [],
    };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: AuthStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

let queue: Promise<unknown> = Promise.resolve();

function withStore<T>(fn: (store: AuthStore) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    await writeStore(store);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
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
  return withStore((store) => {
    const existing = store.users[email];
    if (existing) {
      if (input.mode === "signup") {
        throw new Error("An account with that email already exists. Sign in instead.");
      }
      const ok = safeEqualHex(
        existing.passwordHash,
        hashPassword(input.password, existing.salt),
      );
      if (!ok) {
        throw new Error("An account with that email already exists. Sign in instead.");
      }
      if (input.displayName) existing.displayName = input.displayName;
      store.users[email] = existing;
      return existing;
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
    store.users[email] = user;
    return user;
  });
}

export async function verifyUser(email: string, password: string): Promise<ServerUser | null> {
  const store = await readStore();
  const user = store.users[normalizeEmail(email)];
  if (!user) return null;
  const ok = safeEqualHex(user.passwordHash, hashPassword(password, user.salt));
  return ok ? user : null;
}

export async function findUser(email: string): Promise<ServerUser | null> {
  const store = await readStore();
  return store.users[normalizeEmail(email)] ?? null;
}

export async function issueResetToken(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  return withStore((store) => {
    if (!store.users[normalized]) return null;
    const token = randomToken();
    const now = Date.now();
    store.resets = store.resets.filter((r) => r.exp > now && r.email !== normalized);
    store.resets.push({
      email: normalized,
      tokenHash: hashToken(token),
      exp: now + RESET_TTL_MS,
    });
    return token;
  });
}

export async function consumeResetToken(token: string): Promise<ServerUser | null> {
  const tokenHash = hashToken(token);
  return withStore((store) => {
    const now = Date.now();
    const idx = store.resets.findIndex(
      (r) => r.exp > now && safeEqualHex(r.tokenHash, tokenHash),
    );
    if (idx === -1) return null;
    const record = store.resets[idx];
    store.resets.splice(idx, 1);
    return store.users[record.email] ?? null;
  });
}

export async function updatePassword(email: string, password: string): Promise<ServerUser | null> {
  const normalized = normalizeEmail(email);
  return withStore((store) => {
    const user = store.users[normalized];
    if (!user) return null;
    const salt = randomSalt();
    user.salt = salt;
    user.passwordHash = hashPassword(password, salt);
    store.users[normalized] = user;
    return user;
  });
}
