"use client";

import { useEffect, useRef, useState } from "react";

type UseCountUpOptions = {
  duration?: number;
  decimals?: number;
  start?: number;
};

export function useCountUp(
  targetValue: number,
  { duration = 1000, decimals = 0, start = 0 }: UseCountUpOptions = {}
) {
  const [value, setValue] = useState(start);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || duration <= 0) {
      setValue(Number(targetValue.toFixed(decimals)));
      return;
    }

    const initial = value;
    const delta = targetValue - initial;
    const startedAt = performance.now();

    const step = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = initial + delta * eased;
      setValue(Number(next.toFixed(decimals)));

      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      }
    };

    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetValue, duration, decimals, value]);

  return value;
}
