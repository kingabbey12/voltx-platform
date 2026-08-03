"use client";

import * as React from "react";
import { ACCENTS, type Accent } from "@/lib/design-language";

interface SparklineChartProps {
  points: number[];
  accent: Accent;
  label: string;
}

export function SparklineChart({ points, accent, label }: SparklineChartProps) {
  const id = React.useId();

  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 320;
  const height = 68;
  const coords = points.map((point, index) => ({
    x: (index / (points.length - 1)) * width,
    y: 5 + (height - 10) - ((point - min) / range) * (height - 10),
  }));
  const line = coords.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const previous = coords[index - 1] ?? point;
    const previousPrevious = coords[index - 2] ?? previous;
    const next = coords[index + 1] ?? point;
    const controlOneX = previous.x + (point.x - previousPrevious.x) / 6;
    const controlOneY = previous.y + (point.y - previousPrevious.y) / 6;
    const controlTwoX = point.x - (next.x - previous.x) / 6;
    const controlTwoY = point.y - (next.y - previous.y) / 6;
    return `${path} C ${controlOneX.toFixed(1)} ${controlOneY.toFixed(1)}, ${controlTwoX.toFixed(1)} ${controlTwoY.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const token = ACCENTS[accent];
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const direction = last === first ? "flat" : last > first ? "upward" : "downward";

  return (
    <div className="relative -mx-5 mt-auto overflow-hidden" aria-label={`${label} trend is ${direction}`}>
      <span className="sr-only">{label} trend is {direction} over the available history.</span>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-[68px] w-full"
        aria-hidden
        focusable="false"
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`hsl(${token.hsl} / 0.30)`} />
            <stop offset="100%" stopColor={`hsl(${token.hsl} / 0)`} />
          </linearGradient>
          <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={`hsl(${token.hsl} / 0.45)`} />
            <stop offset="100%" stopColor={`hsl(${token.hsl})`} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id}-fill)`} />
        <path
          d={line}
          fill="none"
          stroke={`url(#${id}-stroke)`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="[stroke-dasharray:600] [stroke-dashoffset:0] motion-safe:animate-[voltx-draw_900ms_cubic-bezier(0.22,1,0.36,1)_both]"
        />
      </svg>
    </div>
  );
}