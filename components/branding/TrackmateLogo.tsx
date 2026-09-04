import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

type TrackmateLogoProps = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/**
 * Two overlapping open-book leaves that form a soft infinity loop.
 * Indigo (you) + Amber (buddy) share a single spine — two mates, tracking together.
 */
export function TrackmateLogo({
  size = 40,
  className,
  withWordmark = false,
  wordmarkClassName,
}: TrackmateLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={APP_NAME}
        className="shrink-0"
      >
        <defs>
          <linearGradient id="pm-left" x1="8" y1="12" x2="36" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#818CF8" />
            <stop offset="1" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="pm-right" x1="28" y1="8" x2="56" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FCD34D" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="pm-spine" x1="32" y1="14" x2="32" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F5F0E8" stopOpacity="0.95" />
            <stop offset="1" stopColor="#CBD5E1" stopOpacity="0.55" />
          </linearGradient>
          <filter id="pm-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          filter="url(#pm-glow)"
          d="M30.5 18.5
             C22 10.5 8.5 14 8.5 26.5
             C8.5 38 18 41.5 26 44.5
             C30.5 46.2 32.5 48.5 32.5 52.5
             C32.5 47 28.5 43.2 22.5 40.5
             C14.5 37 11 33 11 26.8
             C11 18.5 21 16.2 30.5 22.2
             Z"
          fill="url(#pm-left)"
        />
        <path
          d="M14.5 24.5 C18 22.8 24 23.2 28.5 26.2"
          stroke="#C7D2FE"
          strokeOpacity="0.55"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M15.2 28.8 C19 27.4 24.2 27.6 28.2 30.2"
          stroke="#C7D2FE"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeLinecap="round"
        />

        <path
          filter="url(#pm-glow)"
          d="M33.5 45.5
             C42 53.5 55.5 50 55.5 37.5
             C55.5 26 46 22.5 38 19.5
             C33.5 17.8 31.5 15.5 31.5 11.5
             C31.5 17 35.5 20.8 41.5 23.5
             C49.5 27 53 31 53 37.2
             C53 45.5 43 47.8 33.5 41.8
             Z"
          fill="url(#pm-right)"
        />
        <path
          d="M49.5 39.5 C46 41.2 40 40.8 35.5 37.8"
          stroke="#FEF3C7"
          strokeOpacity="0.55"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M48.8 35.2 C45 36.6 39.8 36.4 35.8 33.8"
          stroke="#FEF3C7"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeLinecap="round"
        />

        <path
          d="M32 14 C33.2 22.5 33.2 33.5 32 50"
          stroke="url(#pm-spine)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="32" cy="32" r="2.15" fill="#F5F0E8" />
        <circle cx="32" cy="32" r="3.4" stroke="#6366F1" strokeOpacity="0.45" strokeWidth="0.8" />
      </svg>
      {withWordmark ? (
        <span
          className={cn(
            "font-display text-[1.15em] font-semibold tracking-tight text-cream",
            wordmarkClassName,
          )}
        >
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}

export default TrackmateLogo;
