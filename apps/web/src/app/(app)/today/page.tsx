import type { Metadata } from "next";
import { TodayScreen } from "@/components/today/today-screen";

export const metadata: Metadata = {
  title: "Today — Voltx",
};

/**
 * Today — the morning briefing, per the frozen Today specification. Lives
 * under (app) for the auth gate but outside (shell): the screen carries its
 * own chrome, by design.
 */
export default function TodayPage() {
  return <TodayScreen />;
}
