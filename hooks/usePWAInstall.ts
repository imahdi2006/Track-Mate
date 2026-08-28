"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INSTALL_DISMISS_DAYS,
  INSTALL_DISMISS_KEY,
  IOS_INSTALL_DISMISS_KEY,
} from "@/lib/config";

export type InstallPlatform = "android" | "ios" | "desktop" | "standalone" | "unknown";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function daysSince(ts: number): number {
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

function readDismissed(key: string): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  const ts = Number(raw);
  if (Number.isNaN(ts)) return true;
  return daysSince(ts) < INSTALL_DISMISS_DAYS;
}

export function detectPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "unknown";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  if (standalone) return "standalone";

  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function usePWAInstall() {
  const [platform, setPlatform] = useState<InstallPlatform>("unknown");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    if (p === "standalone") {
      setInstalled(true);
      return;
    }

    const onBip = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      if (!readDismissed(INSTALL_DISMISS_KEY)) setVisible(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    if (p === "ios" && !readDismissed(IOS_INSTALL_DISMISS_KEY)) {
      const t = window.setTimeout(() => setVisible(true), 1400);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBip);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    const key = platform === "ios" ? IOS_INSTALL_DISMISS_KEY : INSTALL_DISMISS_KEY;
    localStorage.setItem(key, String(Date.now()));
  }, [platform]);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setVisible(false);
      return true;
    }
    dismiss();
    return false;
  }, [deferred, dismiss]);

  const showIosGuide = platform === "ios" && visible && !installed;

  const canNativePrompt = useMemo(
    () => Boolean(deferred) && (platform === "android" || platform === "desktop"),
    [deferred, platform],
  );

  return {
    platform,
    visible: visible && !installed,
    installed,
    canNativePrompt,
    showIosGuide,
    promptInstall,
    dismiss,
    open: () => setVisible(true),
  };
}
