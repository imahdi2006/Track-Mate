"use client";

import { getGoogleClientId } from "@/lib/config";

type CredentialResponse = { credential?: string };

type PromptNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            ux_mode?: "popup" | "redirect";
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (momentListener?: (notification: PromptNotification) => void) => void;
        };
      };
    };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in only runs in the browser."));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Couldn’t load Google.")), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn’t load Google."));
    document.head.appendChild(script);
  });
}

export type GoogleIdResult = { kind: "credential"; token: string } | { kind: "redirect" } | { kind: "cancelled" };

/**
 * In-app Google Identity Services (same family as @react-oauth/google), then
 * Supabase `signInWithIdToken`. No NextAuth. Falls back to a full-page
 * Supabase OAuth redirect when the public Client ID isn’t set or GIS is blocked.
 */
export async function requestGoogleSignIn(): Promise<GoogleIdResult> {
  const clientId = getGoogleClientId();
  if (!clientId) return { kind: "redirect" };

  await loadGsi();
  const api = window.google?.accounts?.id;
  if (!api) return { kind: "redirect" };

  return new Promise((resolve) => {
    let settled = false;
    const done = (result: GoogleIdResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    api.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) done({ kind: "credential", token: response.credential });
        else done({ kind: "cancelled" });
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: "popup",
    });

    api.prompt((notification) => {
      if (notification.isDismissedMoment()) {
        done({ kind: "cancelled" });
        return;
      }
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        done({ kind: "redirect" });
      }
    });
  });
}
