"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { deleteMessage, sendMessage, type SendResult } from "@/app/actions";
import type { ChatMessage } from "@/lib/queries";
import { Avatar } from "./Avatar";

const POLL_MS = 3000;
const PAGE_SIZE = 50;
// Consecutive messages from one person within this window are grouped under one name
const GROUP_MS = 5 * 60_000;

type Pending = ChatMessage & { pending?: boolean; failed?: boolean };

function mergeById(list: Pending[], incoming: ChatMessage[]) {
  const seen = new Set(list.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  if (added.length === 0) return list;
  return [...list, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function Chat({ groupId, meId, initial }: { groupId: string; meId: string; initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<Pending[]>(initial);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [, startDelete] = useTransition();

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  // Height before prepending older messages, so the view doesn't jump
  const prependFrom = useRef<number | null>(null);

  const confirmed = messages.filter((m) => !m.pending);
  const newest = confirmed.at(-1)?.createdAt;
  const newestRef = useRef(newest);
  useEffect(() => {
    newestRef.current = newest;
  }, [newest]);
  // Own message tapped to reveal "delete" (hover does it on desktop)
  const [selected, setSelected] = useState<string>();

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const qs = newestRef.current ? `?after=${encodeURIComponent(newestRef.current)}` : "";
    try {
      const res = await fetch(`/api/groups/${groupId}/messages${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const { messages: fresh } = (await res.json()) as { messages: ChatMessage[] };
      setMessages((list) => mergeById(list, fresh));
    } catch {
      // offline or flaky signal in a pub; next tick will catch up
    }
  }, [groupId]);

  useEffect(() => {
    const id = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [poll]);

  // Keep pinned to the bottom when new messages arrive, unless the user scrolled up to read
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prependFrom.current !== null) {
      el.scrollTop = el.scrollHeight - prependFrom.current;
      prependFrom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function loadOlder() {
    const oldest = confirmed[0]?.createdAt;
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/messages?before=${encodeURIComponent(oldest)}`, { cache: "no-store" });
      if (!res.ok) return;
      const { messages: older } = (await res.json()) as { messages: ChatMessage[] };
      prependFrom.current = scroller.current?.scrollHeight ?? null;
      setMessages((list) => mergeById(list, older));
      setHasMore(older.length >= PAGE_SIZE);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(body: string) {
    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: Pending = {
      id: tempId,
      body,
      createdAt: new Date().toISOString(),
      userId: meId,
      username: "",
      displayName: "",
      emoji: "",
      pending: true,
    };
    stickToBottom.current = true;
    setError(undefined);
    setMessages((list) => [...list.filter((m) => !m.failed), optimistic]);

    const result: SendResult = await sendMessage(groupId, body).catch(() => ({ error: "Couldn’t send, check your signal" }));
    if (result.message) {
      const sent = result.message;
      setMessages((list) => mergeById(list.filter((m) => m.id !== tempId), [sent]));
    } else {
      setError(result.error);
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
      setDraft((d) => d || body);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    void send(body);
  }

  function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    setMessages((list) => list.filter((m) => m.id !== id));
    startDelete(() => deleteMessage(id));
  }

  return (
    <div className="card flex h-[calc(100dvh-10.5rem)] min-h-80 flex-col overflow-hidden">
      <div ref={scroller} onScroll={onScroll} className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {hasMore && (
          <div className="pb-2 text-center">
            <button type="button" onClick={loadOlder} disabled={loadingOlder} className="text-xs text-muted hover:text-ink">
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-dim">No messages yet. Who’s out tonight?</p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.userId === meId;
          const newDay = !prev || formatDay(prev.createdAt) !== formatDay(m.createdAt);
          const startsRun =
            newDay || !prev || prev.userId !== m.userId || Date.parse(m.createdAt) - Date.parse(prev.createdAt) > GROUP_MS;

          return (
            <div key={m.id}>
              {newDay && (
                <p className="py-2 text-center text-xs font-medium text-dim" suppressHydrationWarning>
                  {formatDay(m.createdAt)}
                </p>
              )}
              <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${startsRun ? "mt-2" : ""}`}>
                {!mine &&
                  (startsRun ? (
                    <Link href={`/u/${m.username}`} className="self-start">
                      <Avatar emoji={m.emoji} size="sm" />
                    </Link>
                  ) : (
                    <span className="w-7 shrink-0" />
                  ))}
                <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  {startsRun && !mine && <span className="mb-0.5 ml-1 text-xs font-semibold text-muted">{m.displayName}</span>}
                  <div
                    onClick={mine ? () => setSelected((s) => (s === m.id ? undefined : m.id)) : undefined}
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[15px] leading-snug ${
                      mine ? "rounded-br-md bg-foam text-bg" : "rounded-bl-md bg-card-hi"
                    } ${m.pending ? "opacity-60" : ""} ${m.failed ? "opacity-50 ring-1 ring-danger" : ""}`}
                  >
                    {m.body}
                  </div>
                </div>
                <span className="mb-1 shrink-0 text-[10px] text-dim tabular-nums" suppressHydrationWarning>
                  {m.failed ? "failed" : m.pending ? "…" : formatTime(m.createdAt)}
                </span>
                {mine && !m.pending && !m.failed && (
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className={`mb-1 text-[10px] text-dim hover:text-danger ${selected === m.id ? "inline" : "hidden group-hover:inline"}`}
                  >
                    delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on desktop; phones keep Enter for new lines via the on-screen send button
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={500}
          placeholder="Message"
          aria-label="Message"
          className="input max-h-32 min-h-[2.75rem] flex-1 resize-none"
        />
        <button type="submit" disabled={!draft.trim()} className="btn btn-primary h-11 px-4" aria-label="Send">
          Send
        </button>
      </form>
      {error && (
        <p role="alert" className="px-3 pb-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
