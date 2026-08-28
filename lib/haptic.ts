"use client";

export type HapticKind = "light" | "success" | "warn" | "selection";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  selection: 12,
  success: [12, 40, 18],
  warn: [28, 24, 28],
};

export function haptic(kind: HapticKind = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some desktop browsers expose vibrate but throw.
  }
}
