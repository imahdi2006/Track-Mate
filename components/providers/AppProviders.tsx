"use client";

import { useEffect } from "react";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { PushPrompt } from "@/components/pwa/PushPrompt";
import { Toaster } from "@/components/ui/Toaster";
import { UpdateToast } from "@/components/pwa/UpdateToast";
import { registerServiceWorker } from "@/lib/pwa/register-sw";
import { useSessionStore } from "@/lib/store/session-store";
import { useThemeStore } from "@/lib/store/theme-store";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrateTheme();
    void registerServiceWorker();
    void hydrate();
  }, [hydrate, hydrateTheme]);

  return (
    <>
      {children}
      <InstallPrompt />
      <UpdateToast />
      <PushPrompt />
      <Toaster />
    </>
  );
}
