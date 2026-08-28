"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "md" | "lg" | "sm" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  onClick,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
      "bg-brand text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] hover:bg-brand-glow",
    accent:
      "bg-accent text-canvas shadow-[0_8px_24px_rgba(245,158,11,0.28)] hover:bg-accent-glow",
    secondary: "glass text-cream hover:bg-panel-hover",
    ghost: "bg-transparent text-cream/80 hover:bg-white/5",
  };
  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "h-9 px-3 text-sm rounded-xl",
    md: "h-11 px-4 text-sm rounded-2xl",
    lg: "h-12 px-5 text-base rounded-2xl",
    icon: "h-11 w-11 rounded-2xl",
  };

  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-transform transition-colors active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none touch-target",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled}
      onClick={(e) => {
        haptic("light");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
