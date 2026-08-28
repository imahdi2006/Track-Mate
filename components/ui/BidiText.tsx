import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BidiText({
  as: Tag = "p",
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag dir="auto" className={cn("pm-bidi", className)}>
      {children}
    </Tag>
  );
}
