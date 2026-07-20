"use client";

import { forwardRef } from "react";
import styles from "./today.module.css";

/**
 * The reply line — the one bordered surface on the page, because the one
 * place that accepts typing should be the one thing shaped like it. The ⌘K
 * hint is set in tone alone (no chip border), per the frozen spec.
 */
export const ReplyLine = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled?: boolean;
  }
>(function ReplyLine({ value, onChange, onSubmit, disabled }, ref) {
  return (
    <form
      className={styles.reply}
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim().length > 0) onSubmit();
      }}
    >
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask anything"
        aria-label="Ask anything"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
      />
      <span className={styles.kbd} aria-hidden="true">
        ⌘K
      </span>
    </form>
  );
});
