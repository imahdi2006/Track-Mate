import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-white/5 px-4 text-base text-cream placeholder:text-muted/70 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/30 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
