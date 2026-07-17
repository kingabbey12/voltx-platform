"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * Animates a real metric from zero to its loaded value (and between
 * values on refetch). Purely presentational: the number passed in is
 * always the true one, and under prefers-reduced-motion it renders
 * immediately with no tween. Pair with `tabular-nums` so the changing
 * digits never shift layout.
 */
export function CountUpValue({
  value,
  format,
}: {
  value: number;
  format: (current: number) => string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  // Where the tween starts: 0 on first data arrival, the on-screen value
  // on subsequent refetches (so updates glide rather than restart).
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const controls = animate(fromRef.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (current) => {
        fromRef.current = current;
        setDisplay(current);
      },
    });
    return () => controls.stop();
  }, [value, prefersReducedMotion]);

  return <>{format(display)}</>;
}
