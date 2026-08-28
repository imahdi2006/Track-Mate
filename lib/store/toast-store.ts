"use client";

import { create } from "zustand";
import { generateId } from "@/lib/utils";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone?: "info" | "success" | "warn";
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const dup = get().toasts.find(
      (t) => t.title === toast.title && (t.body ?? "") === (toast.body ?? ""),
    );
    if (dup) return;
    const id = generateId();
    set({ toasts: [...get().toasts, { ...toast, id }] });
    setTimeout(() => get().dismiss(id), 5200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
