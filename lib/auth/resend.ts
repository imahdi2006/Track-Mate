import { APP_NAME } from "@/lib/config";

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "Resend is not configured." };
  }

  const from = process.env.RESEND_FROM || "PageMate <beth.t@example.com>";

  const html = `
    <div style="font-family:Georgia,serif;background:#0F172A;color:#F5F0E8;padding:32px;border-radius:16px">
      <p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#818CF8;margin:0 0 12px">
        ${APP_NAME}
      </p>
      <h1 style="font-size:28px;margin:0 0 12px">Reset your password</h1>
      <p style="color:#94A3B8;line-height:1.5">
        Someone asked to reset the PageMate password for this email.
        The link expires in one hour.
      </p>
      <p style="margin:28px 0">
        <a href="${input.resetUrl}"
           style="display:inline-block;background:#6366F1;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-family:sans-serif">
          Choose a new password
        </a>
      </p>
      <p style="color:#64748B;font-size:12px;word-break:break-all">${input.resetUrl}</p>
      <p style="color:#64748B;font-size:12px">If you didn’t ask for this, you can ignore the email.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Reset your ${APP_NAME} password`,
      html,
      text: `Reset your ${APP_NAME} password:\n${input.resetUrl}\n\nThis link expires in one hour.`,
    }),
  });

  if (res.ok) return { ok: true };

  let detail = "";
  try {
    const body = (await res.json()) as { message?: string };
    detail = body.message ?? "";
  } catch {
    detail = await res.text().catch(() => "");
  }

  if (/only send testing emails to your own/i.test(detail) || res.status === 403) {
    return {
      ok: false,
      message:
        "Resend’s test sender can only email the inbox you signed up with. Verify a domain in Resend (and set RESEND_FROM) to send to any Gmail address.",
    };
  }

  return {
    ok: false,
    message: detail || "Resend could not send the email.",
  };
}
