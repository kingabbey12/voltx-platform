"use client";

import clsx from "clsx";
import styles from "./today.module.css";

/**
 * The Today sidebar, per the frozen spec: set entirely in type, three weights
 * carrying the whole hierarchy — semibold for the company, medium for where
 * you are, regular for everything else. Company and Promises are places the
 * platform has not built yet; they render as the spec draws them and do not
 * navigate.
 */
export function TodaySidebar({
  workspaceName,
  personName,
}: {
  workspaceName: string;
  personName: string;
}) {
  return (
    <nav className={styles.side} aria-label="Places">
      <div className={styles.ws}>{workspaceName}</div>
      <div className={styles.nav}>
        <span className={clsx(styles.item, styles.active)} aria-current="page">
          Today
        </span>
        <span className={styles.item} aria-disabled="true">
          Company
        </span>
        <span className={styles.item} aria-disabled="true">
          Promises
        </span>
      </div>
      <div className={styles.you}>{personName}</div>
    </nav>
  );
}
