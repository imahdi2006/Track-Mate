"use client";

import confetti from "canvas-confetti";

export function fireCompletionConfetti(): void {
  if (typeof window === "undefined") return;
  const colors = ["#6366F1", "#F59E0B", "#F5F0E8", "#818CF8"];
  const end = Date.now() + 900;

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };

  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.7 },
    colors,
  });
  frame();
}
