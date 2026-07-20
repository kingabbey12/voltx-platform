"use client";

import { Fragment } from "react";
import clsx from "clsx";
import styles from "./today.module.css";
import type { HeldWorkItem } from "@/hooks/use-held-work";

const VERB_LABEL_BY_STATUS = {
  sending: "Sending…",
  sent: "Sent",
} as const;

/**
 * The held-work ledger: hairline-ruled sentences, each with one verb, per the
 * frozen spec. Selection is the margin line (a document drawn from the
 * stack), not a highlight. The section does not render at all when nothing is
 * held — absence of work is shown by absence.
 */
export function HeldLedger({
  items,
  selectedIndex,
  onSelect,
  onOpen,
  onSign,
  sentenceRefs,
}: {
  items: HeldWorkItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onOpen: (item: HeldWorkItem) => void;
  onSign: (item: HeldWorkItem) => void;
  sentenceRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
}) {
  if (items.length === 0) return null;

  return (
    <div className={styles.held} role="list" aria-label="Held work">
      {items.map((item, index) => {
        const settled = item.status === "sent";
        const sending = item.status === "sending";
        const verbLabel =
          item.status === "sending" || item.status === "sent"
            ? VERB_LABEL_BY_STATUS[item.status]
            : item.verb;

        return (
          <Fragment key={item.approval.id}>
            <div
              role="listitem"
              className={clsx(
                styles.row,
                selectedIndex === index && !settled && styles.sel,
                settled && styles.done,
                sending && styles.sending,
              )}
            >
              <button
                type="button"
                className={styles.s}
                ref={(el) => {
                  sentenceRefs.current[index] = el;
                }}
                onFocus={() => onSelect(index)}
                onClick={() => onOpen(item)}
                disabled={settled}
                aria-label={settled ? item.sentence : `Open for review: ${item.sentence}`}
              >
                {item.sentence}
              </button>
              <button
                type="button"
                className={styles.verb}
                onClick={() => onSign(item)}
                disabled={settled || sending}
                aria-label={settled ? `${item.sentence} — done` : `${item.verb}: ${item.sentence}`}
              >
                {verbLabel}
              </button>
            </div>
            {item.status === "failed" && (
              <div className={styles.note} role="status">
                <b>
                  The work didn&rsquo;t go — the connection to Voltx dropped.
                </b>{" "}
                Nothing was signed; it is still held here exactly as prepared. {item.verb} will try
                again.
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
