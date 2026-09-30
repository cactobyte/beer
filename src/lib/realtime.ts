import "server-only";
import postgres from "postgres";

type Listener = (version: number) => void;

const CHANNEL = "group_changes";
// Drop the database listener this long after the last open page disconnects
const IDLE_CLOSE_MS = 60_000;

/**
 * One LISTEN connection per server instance, fanned out in memory to every
 * open event stream on that instance. LISTEN needs a direct (unpooled)
 * connection; Neon's pooler can't hold it.
 */
class GroupChangeHub {
  private subs = new Map<string, Set<Listener>>();
  private sql: ReturnType<typeof postgres> | null = null;
  private listening: Promise<unknown> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(groupId: string, fn: Listener) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    let set = this.subs.get(groupId);
    if (!set) this.subs.set(groupId, (set = new Set()));
    set.add(fn);
    const ready = this.ensureListening();

    return {
      ready,
      unsubscribe: () => {
        set.delete(fn);
        if (set.size === 0) this.subs.delete(groupId);
        if (this.subs.size === 0 && !this.idleTimer) {
          this.idleTimer = setTimeout(() => this.close(), IDLE_CLOSE_MS);
        }
      },
    };
  }

  private ensureListening() {
    if (this.listening) return this.listening;
    const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    this.sql = postgres(url, { max: 1, onnotice: () => {} });
    // postgres.js re-LISTENs by itself if the connection drops
    this.listening = this.sql.listen(CHANNEL, (payload) => this.dispatch(payload)).catch((e) => {
      this.listening = null;
      throw e;
    });
    return this.listening;
  }

  private dispatch(payload: string) {
    const [groupId, v] = payload.split(":");
    const version = Number(v);
    for (const fn of this.subs.get(groupId) ?? []) fn(version);
  }

  private close() {
    this.idleTimer = null;
    const sql = this.sql;
    this.sql = null;
    this.listening = null;
    void sql?.end({ timeout: 5 });
  }
}

const globalForHub = globalThis as unknown as { groupChangeHub?: GroupChangeHub };
export const groupChanges = (globalForHub.groupChangeHub ??= new GroupChangeHub());
