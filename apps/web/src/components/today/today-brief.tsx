"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import styles from "./today.module.css";
import type { TodayBrief } from "@/hooks/use-today-brief";

/**
 * The morning brief. Loading per spec: below 600 ms nothing is shown at all;
 * past 600 ms, one line in the hint tone — "Gathering the morning." —
 * replaced in place when the letter arrives. Errors use the three-clause
 * grammar: what happened, what remains safe, what happens next.
 */
export function TodayBriefSection({ brief }: { brief: TodayBrief }) {
  const [showDoing, setShowDoing] = useState(false);

  useEffect(() => {
    if (!brief.loading) {
      setShowDoing(false);
      return;
    }
    const timer = window.setTimeout(() => setShowDoing(true), 600);
    return () => window.clearTimeout(timer);
  }, [brief.loading]);

  if (brief.loading) {
    return showDoing ? (
      <div className={styles.doing} role="status">
        Gathering the morning.
      </div>
    ) : null;
  }

  if (brief.error) {
    return (
      <div className={styles.arrive}>
        <div className={styles.brief}>
          <p>
            This morning&rsquo;s brief couldn&rsquo;t be gathered — {brief.error}. Your records are
            safe and the held work below is unaffected. I&rsquo;ll try again when you ask.
          </p>
        </div>
        <div className={styles.answers}>
          <button type="button" className={clsx(styles.ans, styles.rec)} onClick={brief.retry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!brief.paragraphs || brief.paragraphs.length === 0) {
    return null;
  }

  return (
    <div className={clsx(styles.brief, styles.arrive)}>
      {brief.paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}
