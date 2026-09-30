import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, getTableColumns, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";

const COOKIE = "sesh_session";

// Every user column except the password hash
const { passwordHash: _omit, ...publicUserColumns } = getTableColumns(schema.users);
const SESSION_DAYS = 60;
// Extend the session when it's used with less than this long left
const RENEW_WITHIN_DAYS = 30;
// The DB row is the source of truth for expiry; the cookie just lives as long
// as browsers allow so sliding renewal keeps working.
const COOKIE_MAX_AGE = 400 * 86_400;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  // Opportunistic cleanup so the table doesn't grow forever
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), lt(schema.sessions.expiresAt, new Date())));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  store.delete(COOKIE);
}

/** Current user or null. Deduped per request. */
export const getUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({ user: publicUserColumns, expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;

  if (row.expiresAt.getTime() - Date.now() < RENEW_WITHIN_DAYS * 86_400_000) {
    // Sliding expiry: active users never get logged out
    await db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
      .where(eq(schema.sessions.id, id));
  }

  return row.user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

/** Current user, or bounce to /login (returning here afterwards). */
export async function requireUser(returnTo?: string) {
  const user = await getUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  return user;
}
