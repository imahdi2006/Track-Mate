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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/90 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-2xl"
      aria-label="Primary"
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-4">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-cream" : "text-muted",
                )}
              >
                <span className="relative grid h-8 w-8 place-items-center">
                  {active ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-brand/30"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ) : null}
                  <Icon size={20} className="relative" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className="relative leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
