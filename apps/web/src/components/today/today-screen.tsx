"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import styles from "./today.module.css";
import { TodaySidebar } from "./today-sidebar";
import { TodayBriefSection } from "./today-brief";
import { HeldLedger } from "./held-ledger";
import { ReplyLine } from "./reply-line";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useMyOrganizations } from "@/hooks/use-organizations";
import { useTodayBrief } from "@/hooks/use-today-brief";
import { toParagraphs } from "@/lib/today/prose";
import { useHeldWork, type HeldWorkItem } from "@/hooks/use-held-work";
import { useRunCommand } from "@/hooks/use-operator";
import { useOperatorStore } from "@/lib/stores/operator-store";

/** Name the work being done for the doing-line — words, never a spinner. */
function describeToolWork(toolName: string | undefined): string {
  if (!toolName) return "Gathering the answer…";
  const words = toolName.replace(/[_-]+/g, " ").toLowerCase();
  const [first, ...rest] = words.split(" ");
  const gerunds: Record<string, string> = {
    search: "Searching",
    get: "Reading",
    list: "Reading",
    read: "Reading",
    find: "Finding",
    create: "Drafting",
    update: "Updating",
  };
  const verb = gerunds[first ?? ""] ?? "Reading";
  return `${verb} ${rest.join(" ") || "the records"}…`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

/**
 * The Today screen, assembled per the frozen spec: a dated letter — the
 * brief, the held-work ledger, the reply line — with the keyboard grammar
 * (type anywhere, ⌘K, ↑↓ through the ledger, Enter opens, ⌘Enter signs,
 * Esc returns) and the focus, motion, loading, empty and error treatments.
 */
export function TodayScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const organizations = useMyOrganizations();

  const workspaceName = useMemo(() => {
    const membership = organizations.data?.find(
      (candidate) => candidate.organizationId === user?.organizationId,
    );
    return membership?.organizationName ?? "";
  }, [organizations.data, user?.organizationId]);

  const brief = useTodayBrief(user?.organizationId);
  const held = useHeldWork();

  // The one-arrival rule: chrome, date, and reply render in first paint; the
  // brief and the ledger arrive together, never one pushing the other.
  const arriving = brief.loading;

  // ————— Ask: the reply line submits through the existing operator runtime —————
  const { run, cancel } = useRunCommand();
  const turns = useOperatorStore((state) => state.turns);
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState<{ objective: string; at: number } | null>(null);
  const [askTurnId, setAskTurnId] = useState<string | null>(null);
  const replyRef = useRef<HTMLInputElement>(null);

  // Find this screen's turn once (run() does not return an id), then pin it —
  // matching by objective/time on every render would break if the same words
  // are asked twice.
  useEffect(() => {
    if (!asked || askTurnId) return;
    const match = turns.find(
      (turn) => turn.objective === asked.objective && turn.createdAt >= asked.at - 1_000,
    );
    if (match) setAskTurnId(match.id);
  }, [turns, asked, askTurnId]);

  const askTurn = useMemo(
    () => (askTurnId ? (turns.find((turn) => turn.id === askTurnId) ?? null) : null),
    [turns, askTurnId],
  );

  const submitAsk = useCallback(() => {
    const objective = draft.trim();
    if (objective.length === 0) return;
    setAsked({ objective, at: Date.now() });
    setAskTurnId(null);
    setDraft("");
    void run(objective);
  }, [draft, run]);

  // ————— Ledger selection: the margin line, moved with the arrows —————
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const sentenceRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveSelection = useCallback(
    (delta: 1 | -1) => {
      if (held.items.length === 0) return;
      const current = selectedIndex ?? (delta === 1 ? -1 : held.items.length);
      const next = Math.min(Math.max(current + delta, 0), held.items.length - 1);
      setSelectedIndex(next);
      sentenceRefs.current[next]?.focus();
    },
    [held.items.length, selectedIndex],
  );

  const openItem = useCallback(() => {
    // Review happens where approvals live today.
    router.push("/ai/operator");
  }, [router]);

  const signItem = useCallback(
    (item: HeldWorkItem) => {
      if (item.status === "sent" || item.status === "sending") return;
      void held.sign(item.approval.id);
    },
    [held],
  );

  // ————— The keyboard grammar —————
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // ⌘K — go to the reply line deliberately.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        replyRef.current?.focus();
        return;
      }

      // ⌘Enter — sign the selected held document.
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (!arriving && selectedIndex !== null && held.items[selectedIndex]) {
          event.preventDefault();
          signItem(held.items[selectedIndex]);
        }
        return;
      }

      // Esc — return: stop the stream, then set down the reply, then clear
      // the selection. A draft is always kept.
      if (event.key === "Escape") {
        if (askTurn?.status === "running") {
          cancel();
          return;
        }
        if (document.activeElement === replyRef.current) {
          replyRef.current?.blur();
          return;
        }
        setSelectedIndex(null);
        return;
      }

      if (isEditableTarget(event.target)) return;

      // ↓ / ↑ — move between held documents.
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!arriving && held.items.length > 0) {
          event.preventDefault();
          moveSelection(event.key === "ArrowDown" ? 1 : -1);
        }
        return;
      }

      // Any letter — typing anywhere falls into the reply line.
      if (
        event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.isComposing
      ) {
        event.preventDefault();
        setDraft((current) => current + event.key);
        replyRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [arriving, askTurn?.status, cancel, held.items, moveSelection, selectedIndex, signItem]);

  // ————— The ask exchange, rendered as prose beneath the owner's line —————
  const askDoing = askTurn?.status === "running" && !askTurn.finalText;
  const askStopped = askTurn?.status === "error" && /abort/i.test(askTurn.error ?? "");
  const askParagraphs = askTurn?.finalText ? toParagraphs(askTurn.finalText) : null;
  const runningTool = askTurn?.toolCalls.find((call) => call.status === "running")?.toolName;

  return (
    <div className={styles.screen}>
      <TodaySidebar workspaceName={workspaceName} personName={user?.firstName ?? ""} />
      <main className={styles.col}>
        <h1 className={styles.date}>{format(new Date(), "EEEE, MMMM d")}</h1>

        <TodayBriefSection brief={brief} />

        {!arriving && (
          <HeldLedger
            items={held.items}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onOpen={openItem}
            onSign={signItem}
            sentenceRefs={sentenceRefs}
          />
        )}

        {asked && (
          <section className={styles.ask} aria-label="Your question">
            <div className={styles.brief}>
              <p className={styles.q}>{asked.objective}</p>
              {askParagraphs?.map((paragraph, index) => (
                <p key={index} className={styles.arrive}>
                  {paragraph}
                </p>
              ))}
              {askStopped && <p className={styles.arrive}>— stopped here.</p>}
              {askTurn?.status === "error" && !askStopped && (
                <p className={styles.arrive}>
                  The answer didn&rsquo;t arrive — the connection to Voltx dropped. Nothing was
                  changed by asking. Ask again and I&rsquo;ll pick it up.
                </p>
              )}
            </div>
            {askDoing && (
              <div className={styles.doing} role="status" aria-live="polite">
                {describeToolWork(runningTool)}
              </div>
            )}
          </section>
        )}

        <ReplyLine ref={replyRef} value={draft} onChange={setDraft} onSubmit={submitAsk} />
      </main>
    </div>
  );
}
