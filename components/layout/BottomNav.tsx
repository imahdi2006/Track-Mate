"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Radio, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/activity", label: "Activity", icon: Radio },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      aria-label="Primary"
    >
      <ul className="pointer-events-auto flex h-[3.35rem] w-full max-w-[22rem] items-stretch gap-0.5 rounded-[1.75rem] border border-white/12 bg-canvas/55 px-1.5 shadow-[0_12px_40px_rgba(2,6,23,0.45)] backdrop-blur-2xl glass-strong">
        {ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition-colors",
                  active ? "text-cream" : "text-muted hover:text-cream/80",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-1 rounded-2xl bg-brand/25"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon size={20} className="relative" strokeWidth={active ? 2.4 : 1.8} />
                <span className="relative leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
