const CRED_KEY = "pagemate-credentials";
const DEVICE_SECRET_KEY = "pagemate-device-secret";
const ACCESS_TOKEN_KEY = "pagemate-access-token";
const REMEMBER_USER_KEY = "pagemate-remember-user-id";

export interface StoredCredential {
  email: string;
  salt: string;
  passwordHash: string;
  profileId: string;
}

export interface SessionClaims {
  sub: string;
  email: string;
  name: string;
  exp: number;
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(digest);
}

export function readCredentials(): Record<string, StoredCredential> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CRED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredCredential>) : {};
  } catch {
    return {};
  }
}

export function writeCredentials(all: Record<string, StoredCredential>): void {
  localStorage.setItem(CRED_KEY, JSON.stringify(all));
}

function deviceSecret(): string {
  let secret = localStorage.getItem(DEVICE_SECRET_KEY);
  if (!secret) {
    secret = randomHex(32);
    localStorage.setItem(DEVICE_SECRET_KEY, secret);
  }
  return secret;
}

async function signBytes(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(sig);
}

export async function issueAccessToken(claims: Omit<SessionClaims, "exp">, ttlMs = 1000 * 60 * 60 * 24 * 30): Promise<string> {
  const body: SessionClaims = { ...claims, exp: Date.now() + ttlMs };
  const payload = toBase64Url(JSON.stringify(body));
  const sig = await signBytes(deviceSecret(), payload);
  const token = `${payload}.${sig}`;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(REMEMBER_USER_KEY, claims.sub);
  return token;
}

export async function readAccessToken(): Promise<SessionClaims | null> {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await signBytes(deviceSecret(), payload);
  if (expected !== sig) return null;
  try {
    const claims = JSON.parse(fromBase64Url(payload)) as SessionClaims;
    if (claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_USER_KEY);
}

export function rememberedUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REMEMBER_USER_KEY);
}

export async function registerLocalPassword(email: string, password: string, profileId: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password, salt);
  const all = readCredentials();
  all[normalized] = { email: normalized, salt, passwordHash, profileId };
  writeCredentials(all);
}

export async function verifyLocalPassword(email: string, password: string): Promise<StoredCredential> {
  const normalized = normalizeEmail(email);
  const cred = readCredentials()[normalized];
  if (!cred) throw new Error("No account for that email. Create one first.");
  const hash = await hashPassword(password, cred.salt);
  if (hash !== cred.passwordHash) throw new Error("Wrong password.");
  return cred;
}
