"use client";

import clsx from "clsx";
import Link from "next/link";
import styles from "./today.module.css";

/**
 * The Today sidebar, per the frozen spec: set entirely in type, three weights
 * carrying the whole hierarchy — semibold for the company, medium for where
 * you are, regular for everything else. These are real application doors and
 * therefore remain keyboard-accessible links as the workspace expands.
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
        <Link className={styles.item} href="/company">Company</Link>
        <Link className={styles.item} href="/promises">Promises</Link>
      </div>
      <div className={styles.you}>{personName}</div>
    </nav>
  );
}
