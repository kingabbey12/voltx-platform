/**
 * The single definition of what colour and motion *mean* in Voltx.
 *
 * Both were previously decided per component: KpiCard carried its own accent
 * map, QuickActions tinted everything gold on hover, and motion ran at five
 * different durations with two spellings of the same easing curve. Individually
 * each was defensible; together they read as a collection of components rather
 * than one product.
 *
 * Import from here rather than re-deciding locally.
 */

/**
 * Colour is semantic, never decorative. A tile is blue because it concerns
 * organizations, not because blue looked good next to gold.
 *
 *   gold    the brand, and money — pipeline, revenue, billing
 *   blue    organizations and structure — companies, contacts, teams
 *   orange  opportunities and things wanting attention — leads, deals
 *   purple  AI — agents, copilot, automation, insight
 *   green   success and confirmed outcomes — won, completed, healthy
 *   red     risk — overdue, failing, at-risk
 *
 * Gold is deliberately scarce. When everything is the brand colour, nothing
 * reads as important.
 */
export type Accent = "gold" | "blue" | "cyan" | "orange" | "purple" | "green" | "red";

export interface AccentTokens {
  /** Raw HSL channels, for gradient stops and inline SVG that cannot use a class. */
  hsl: string;
  /** Foreground colour for icons and emphasis text. */
  fg: string;
  /** Tinted background for icon wells and chips. */
  bg: string;
  /** Border for outlined treatments. */
  border: string;
  /** Border colour on hover for interactive surfaces. */
  hoverBorder: string;
}

export const ACCENTS: Record<Accent, AccentTokens> = {
  gold: {
    hsl: "46 65% 52%",
    fg: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    hoverBorder: "group-hover:border-primary/40",
  },
  blue: {
    hsl: "217 91% 60%",
    fg: "text-info",
    bg: "bg-info/10",
    border: "border-info/20",
    hoverBorder: "group-hover:border-info/40",
  },
  cyan: {
    hsl: "188 86% 53%",
    fg: "text-[hsl(188_86%_53%)]",
    bg: "bg-[hsl(188_86%_53%/0.12)]",
    border: "border-[hsl(188_86%_53%/0.22)]",
    hoverBorder: "group-hover:border-[hsl(188_86%_53%/0.45)]",
  },
  orange: {
    hsl: "25 95% 58%",
    fg: "text-[hsl(25_95%_58%)]",
    bg: "bg-[hsl(25_95%_58%/0.12)]",
    border: "border-[hsl(25_95%_58%/0.22)]",
    hoverBorder: "group-hover:border-[hsl(25_95%_58%/0.45)]",
  },
  purple: {
    hsl: "268 83% 68%",
    fg: "text-[hsl(268_83%_68%)]",
    bg: "bg-[hsl(268_83%_68%/0.12)]",
    border: "border-[hsl(268_83%_68%/0.22)]",
    hoverBorder: "group-hover:border-[hsl(268_83%_68%/0.45)]",
  },
  green: {
    hsl: "145 100% 39%",
    fg: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    hoverBorder: "group-hover:border-success/40",
  },
  red: {
    hsl: "352 100% 62%",
    fg: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    hoverBorder: "group-hover:border-destructive/40",
  },
};

/**
 * One motion vocabulary, so a card hover, a dialog and a chart all decelerate
 * the same way. The curve matters more than the duration for whether motion
 * feels considered — everything uses the same ease-out, and only the distance
 * travelled changes the timing.
 *
 * Durations are deliberately few. Anything past ~350ms stops reading as
 * responsive and starts reading as slow.
 */
export const MOTION = {
  /** Hovers, colour and border changes — should feel immediate. */
  fast: 0.15,
  /** The default: entrances, card lifts, most transitions. */
  base: 0.25,
  /** Larger travel — dialogs, drawers, a chart drawing itself in. */
  slow: 0.35,
  /**
   * Ease-out with a long tail. Motion arrives quickly and settles gently,
   * which reads as confident; a symmetric ease reads as mechanical.
   */
  ease: [0.22, 1, 0.36, 1] as const,
} as const;

/** Ready-made framer-motion transition, so call sites stop hand-writing curves. */
export const transition = (duration: number = MOTION.base, delay = 0) => ({
  duration,
  delay,
  ease: MOTION.ease,
});

/** Entrance used by every staggered section. */
export const riseIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};
