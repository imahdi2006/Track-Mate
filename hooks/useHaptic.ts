"use client";

import { useCallback } from "react";
import { haptic, type HapticKind } from "@/lib/haptic";

export function useHaptic() {
  return useCallback((kind: HapticKind = "light") => haptic(kind), []);
}
