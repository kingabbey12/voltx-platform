"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import styles from "./today.module.css";
import { askApi, type AskSegment } from "@/lib/ai/ask-client";
import type { AskExchange } from "@/hooks/use-ask";

/**
 * The ask exchange, rendered entirely in Today's frozen primitives: the
 * owner's line, prose sentences that arrived whole, doors on grounded
 * claims, answers inline (the recommendation in Volt, first), and the
 * doing-line. Registers are carried by words and Volt exactly as the trust
 * model specifies — inference is hedged in its text, never restyled.
 */
export function AskExchangeSection({
  exchange,
  onAsk,
}: {
  exchange: AskExchange;
  onAsk: (objective: string) => void;
}) {
  const router = useRouter();

  const openDoor = useCallback(
    async (recordType: string, recordId: string) => {
      try {
        const record = await askApi.resolveRecord(recordType, recordId);
        router.push(record.route);
      } catch {
        // A door that cannot resolve does nothing — never a broken page.
      }
    },
    [router],
  );

  if (exchange.status === "idle") return null;

  const structured = exchange.response;
  const showStreamedSentences = !structured || structured.segments.length === 0;

  return (
    <section className={styles.ask} aria-label="Your question">
      <div className={styles.brief}>
        <p className={styles.q}>{exchange.prompt}</p>

        {showStreamedSentences
          ? exchange.sentences.map((sentence, index) => (
              <p key={index} className={styles.arrive}>
                {sentence}
              </p>
            ))
          : structured.segments.map((segment, index) => (
              <p key={index} className={styles.arrive}>
                <SegmentText segment={segment} onOpenDoor={openDoor} />
              </p>
            ))}

        {exchange.status === "stopped" && <p className={styles.arrive}>— stopped here.</p>}
        {exchange.status === "error" && (
          <p className={styles.arrive}>
            The answer didn&rsquo;t arrive — {exchange.error ?? "the connection to Voltx failed"}.
            Nothing was changed by asking. Ask again and I&rsquo;ll pick it up.
          </p>
        )}
      </div>

      {exchange.doing && (
        <div className={styles.doing} role="status" aria-live="polite">
          {exchange.doing}
        </div>
      )}

      {structured && (structured.answers.length > 0 || structured.suggestions.length > 0) && (
        <div className={styles.answers}>
          {structured.answers.map((answer) => (
            <button
              key={answer.label}
              type="button"
              className={clsx(styles.ans, answer.recommended ? styles.rec : styles.alt)}
              onClick={() => onAsk(answer.objective)}
            >
              {answer.label}
            </button>
          ))}
          {structured.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={clsx(styles.ans, styles.alt)}
              onClick={() => onAsk(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Renders a segment's text with its grounded doors as inline openers. */
function SegmentText({
  segment,
  onOpenDoor,
}: {
  segment: AskSegment;
  onOpenDoor: (recordType: string, recordId: string) => void;
}) {
  if (segment.doors.length === 0) return <>{segment.text}</>;

  const nodes: React.ReactNode[] = [];
  let remaining = segment.text;
  let key = 0;

  for (const door of segment.doors) {
    const at = remaining.indexOf(door.text);
    if (at < 0) continue;
    if (at > 0) nodes.push(<span key={key++}>{remaining.slice(0, at)}</span>);
    nodes.push(
      <button
        key={key++}
        type="button"
        className={styles.door}
        onClick={() => onOpenDoor(door.recordType, door.recordId)}
      >
        {door.text}
      </button>,
    );
    remaining = remaining.slice(at + door.text.length);
  }
  nodes.push(<span key={key++}>{remaining}</span>);

  return <>{nodes}</>;
}
