import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  hue,
  size = 36,
  className,
}: {
  name: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-cream ring-2 ring-canvas",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(145deg, hsl(${hue} 62% 42%), hsl(${(hue + 40) % 360} 55% 28%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
