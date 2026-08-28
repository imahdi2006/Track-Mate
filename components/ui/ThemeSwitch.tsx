"use client";

import { haptic } from "@/lib/haptic";
import { useThemeStore } from "@/lib/store/theme-store";

/**
 * Sun / moon theme switch. Checked = dark (night sky, moon, stars).
 */
export function ThemeSwitch() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = theme === "dark";

  return (
    <label className="theme-switch">
      <input
        type="checkbox"
        checked={dark}
        onChange={() => {
          haptic("selection");
          toggle();
        }}
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      />
      <div className="slider round">
        <div className="sun-moon">
          <svg className="moon-dot moon-dot-1" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="moon-dot moon-dot-2" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="moon-dot moon-dot-3" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="light-ray light-ray-1" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="light-ray light-ray-2" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="light-ray light-ray-3" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="cloud-dark cloud-1" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="cloud-dark cloud-2" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="cloud-dark cloud-3" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="cloud-light cloud-4" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="cloud-light cloud-5" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
          <svg className="cloud-light cloud-6" viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={50} />
          </svg>
        </div>
        <div className="stars">
          <svg className="star star-1" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg className="star star-2" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg className="star star-3" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg className="star star-4" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
        </div>
      </div>
    </label>
  );
}

export default ThemeSwitch;
