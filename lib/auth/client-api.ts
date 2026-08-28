async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function syncServerAccount(input: {
  email: string;
  password: string;
  profileId: string;
  displayName: string;
  mode: "signup" | "signin";
}): Promise<void> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.ok) return;
  const body = await readJson(res);
  throw new Error(typeof body.message === "string" ? body.message : "Couldn’t save account");
}

export async function loginServerAccount(
  email: string,
  password: string,
): Promise<{ profileId: string; displayName: string; email: string } | null> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) return null;
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(typeof body.message === "string" ? body.message : "Couldn’t sign in");
  }
  return {
    profileId: String(body.profileId),
    displayName: String(body.displayName ?? "Reader"),
    email: String(body.email),
  };
}

export async function requestServerPasswordReset(
  email: string,
  origin: string,
): Promise<{ emailed: boolean; message: string }> {
  const res = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, origin }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(typeof body.message === "string" ? body.message : "Couldn’t send reset");
  }
  return {
    emailed: Boolean(body.emailed),
    message:
      typeof body.message === "string"
        ? body.message
        : "If that email has an account, a reset link is on its way.",
  };
}

export async function completeServerPasswordReset(
  token: string,
  password: string,
): Promise<{ email: string; profileId: string; displayName: string }> {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(typeof body.message === "string" ? body.message : "Reset link is invalid");
  }
  return {
    email: String(body.email),
    profileId: String(body.profileId),
    displayName: String(body.displayName ?? "Reader"),
  };
}
