import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import type { Period } from "./drinks";

const { users, groups, groupMembers, drinks } = schema;

/**
 * A person's name as shown inside a group: the owner-set nickname if there is
 * one, else their own display name. Needs group_members joined for that group.
 */
const shownName = sql<string>`coalesce(${groupMembers.nickname}, ${users.displayName})`;

/**
 * Start of a leaderboard period in the group's timezone. Days roll over at
 * 6am rather than midnight so a night out counts as one "tonight".
 */
function periodStart(period: Period, tz: string): SQL | null {
  if (period === "all") return null;
  const field = { tonight: "day", week: "week", month: "month", year: "year" }[period];
  return sql`((date_trunc(${field}, (now() at time zone ${tz}) - interval '6 hours') + interval '6 hours') at time zone ${tz})`;
}

export async function getMyGroups(userId: string) {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      role: groupMembers.role,
      memberCount: sql<number>`(select count(*)::int from ${groupMembers} gm where gm.group_id = ${groups.id})`,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(groupMembers.joinedAt);
}

/** The group, if the user is a member of it; 404s otherwise. */
export async function requireGroup(groupId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) notFound();
  const [row] = await db
    .select({ group: groups, role: groupMembers.role })
    .from(groups)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId)))
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!row) notFound();
  return row;
}

export async function getLeaderboard(groupId: string, tz: string, period: Period) {
  const start = periodStart(period, tz);
  const inPeriod = start ? sql`${drinks.drunkAt} >= ${start}` : sql`true`;

  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: shownName,
      emoji: users.emoji,
      drinks: sql<number>`coalesce(sum(${drinks.quantity}), 0)::int`,
      units: sql<number>`coalesce(sum(${drinks.units}), 0)::float`,
      lastDrinkAt: sql<Date | null>`max(${drinks.drunkAt})`.mapWith((v) => (v ? new Date(v) : null)),
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(drinks, and(eq(drinks.userId, users.id), inPeriod))
    .where(eq(groupMembers.groupId, groupId))
    .groupBy(users.id, groupMembers.nickname)
    .orderBy(
      desc(sql`coalesce(sum(${drinks.quantity}), 0)`),
      desc(sql`coalesce(sum(${drinks.units}), 0)`),
      shownName,
    );
}

export type LeaderboardRow = Awaited<ReturnType<typeof getLeaderboard>>[number];

/** Latest drinks logged by anyone in the group. */
export async function getGroupFeed(groupId: string, limit = 25) {
  return db
    .select({
      id: drinks.id,
      type: drinks.type,
      quantity: drinks.quantity,
      units: drinks.units,
      note: drinks.note,
      drunkAt: drinks.drunkAt,
      userId: users.id,
      username: users.username,
      displayName: shownName,
      emoji: users.emoji,
      seshId: schema.seshDrinks.seshId,
      seshName: schema.seshes.name,
    })
    .from(drinks)
    .innerJoin(users, eq(users.id, drinks.userId))
    // Current members only
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, drinks.userId)))
    .leftJoin(
      schema.seshDrinks,
      and(eq(schema.seshDrinks.drinkId, drinks.id), eq(schema.seshDrinks.groupId, groupId)),
    )
    .leftJoin(schema.seshes, eq(schema.seshes.id, schema.seshDrinks.seshId))
    .orderBy(desc(drinks.drunkAt))
    .limit(limit);
}

export type FeedItem = Awaited<ReturnType<typeof getGroupFeed>>[number];

export async function getGroupMembers(groupId: string) {
  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: shownName,
      realName: users.displayName,
      nickname: groupMembers.nickname,
      emoji: users.emoji,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt);
}

export async function getUserByUsername(username: string) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      emoji: users.emoji,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return user ?? null;
}

/** Whether two users share at least one group (profiles are only visible to groupmates). */
export async function sharesGroup(a: string, b: string) {
  if (a === b) return true;
  const gm2 = db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, b));
  const [row] = await db
    .select({ one: sql`1` })
    .from(groupMembers)
    .where(and(eq(groupMembers.userId, a), inArray(groupMembers.groupId, gm2)))
    .limit(1);
  return Boolean(row);
}

export async function getUserStats(userId: string) {
  const [totals] = await db
    .select({
      drinks: sql<number>`coalesce(sum(${drinks.quantity}), 0)::int`,
      units: sql<number>`coalesce(sum(${drinks.units}), 0)::float`,
      // Distinct 6am-to-6am "nights" with at least one drink, in UTC. Good enough for a stat.
      nights: sql<number>`count(distinct date_trunc('day', ${drinks.drunkAt} - interval '6 hours'))::int`,
    })
    .from(drinks)
    .where(eq(drinks.userId, userId));

  const byType = await db
    .select({
      type: drinks.type,
      drinks: sql<number>`sum(${drinks.quantity})::int`,
      units: sql<number>`sum(${drinks.units})::float`,
    })
    .from(drinks)
    .where(eq(drinks.userId, userId))
    .groupBy(drinks.type)
    .orderBy(desc(sql`sum(${drinks.quantity})`));

  const [best] = await db
    .select({
      night: sql<string>`to_char(date_trunc('day', ${drinks.drunkAt} - interval '6 hours'), 'YYYY-MM-DD')`,
      drinks: sql<number>`sum(${drinks.quantity})::int`,
    })
    .from(drinks)
    .where(eq(drinks.userId, userId))
    .groupBy(sql`1`)
    .orderBy(desc(sql`2`))
    .limit(1);

  return { ...totals, byType, bestNight: best ?? null };
}

export async function getUserHistory(userId: string, limit = 50) {
  return db
    .select()
    .from(drinks)
    .where(eq(drinks.userId, userId))
    .orderBy(desc(drinks.drunkAt))
    .limit(limit);
}

/** How many drinks the user has had since "tonight" began in the given timezone. */
export async function getMyTonight(userId: string, tz: string) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${drinks.quantity}), 0)::int` })
    .from(drinks)
    .where(and(eq(drinks.userId, userId), sql`${drinks.drunkAt} >= ${periodStart("tonight", tz)}`));
  return row.n;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function isMember(groupId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return false;
  const [row] = await db
    .select({ one: sql`1` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}

const messageColumns = {
  id: schema.messages.id,
  body: schema.messages.body,
  createdAt: schema.messages.createdAt,
  userId: users.id,
  username: users.username,
  displayName: shownName,
  emoji: users.emoji,
};

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  username: string;
  displayName: string;
  emoji: string;
};

function toChatMessage(m: { createdAt: Date } & Omit<ChatMessage, "createdAt">): ChatMessage {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

/**
 * Messages in a group, oldest first. `after` returns everything newer (for
 * polling, inclusive so same-millisecond messages aren't missed; the client
 * dedupes by id). `before` pages backwards through history.
 */
export async function getMessages(groupId: string, opts: { after?: Date; before?: Date; limit?: number } = {}) {
  const limit = opts.limit ?? 50;
  const { messages } = schema;
  const conds = [eq(messages.groupId, groupId)];
  if (opts.after) conds.push(gte(messages.createdAt, opts.after));
  if (opts.before) conds.push(lt(messages.createdAt, opts.before));

  const rows = await db
    .select(messageColumns)
    .from(messages)
    .innerJoin(users, eq(users.id, messages.userId))
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, messages.groupId), eq(groupMembers.userId, messages.userId)))
    .where(and(...conds))
    // Polling wants the oldest new messages first; history wants the newest page
    .orderBy(opts.after ? asc(messages.createdAt) : desc(messages.createdAt))
    .limit(limit);

  if (!opts.after) rows.reverse();
  return rows.map(toChatMessage);
}

export async function getLatestMessage(groupId: string) {
  const [row] = await getMessages(groupId, { limit: 1 });
  return row ?? null;
}

export async function getMessageById(id: string) {
  const [row] = await db
    .select(messageColumns)
    .from(schema.messages)
    .innerJoin(users, eq(users.id, schema.messages.userId))
    .leftJoin(
      groupMembers,
      and(eq(groupMembers.groupId, schema.messages.groupId), eq(groupMembers.userId, schema.messages.userId)),
    )
    .where(eq(schema.messages.id, id))
    .limit(1);
  return row ? toChatMessage(row) : null;
}

// ─── Seshes ──────────────────────────────────────────────────────────────────

const { seshes, seshDrinks } = schema;

export async function getLiveSesh(groupId: string) {
  const [row] = await db
    .select()
    .from(seshes)
    .where(and(eq(seshes.groupId, groupId), isNull(seshes.endedAt)))
    .limit(1);
  return row ?? null;
}

/** Seshes in a group, newest first, with totals. */
export async function getSeshes(groupId: string, limit = 50) {
  return db
    .select({
      id: seshes.id,
      name: seshes.name,
      startedAt: seshes.startedAt,
      endedAt: seshes.endedAt,
      drinks: sql<number>`coalesce(sum(${drinks.quantity}), 0)::int`,
      people: sql<number>`count(distinct ${drinks.userId})::int`,
    })
    .from(seshes)
    .leftJoin(seshDrinks, eq(seshDrinks.seshId, seshes.id))
    .leftJoin(drinks, eq(drinks.id, seshDrinks.drinkId))
    .where(eq(seshes.groupId, groupId))
    .groupBy(seshes.id)
    .orderBy(desc(seshes.startedAt))
    .limit(limit);
}

export type SeshSummary = Awaited<ReturnType<typeof getSeshes>>[number];

/** The sesh, if it belongs to this group; 404s otherwise. */
export async function requireSesh(groupId: string, seshId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(seshId)) notFound();
  const [row] = await db
    .select()
    .from(seshes)
    .where(and(eq(seshes.id, seshId), eq(seshes.groupId, groupId)))
    .limit(1);
  if (!row) notFound();
  return row;
}

/** Everyone who drank in the sesh, ranked. */
export async function getSeshLeaderboard(seshId: string) {
  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: shownName,
      emoji: users.emoji,
      drinks: sql<number>`sum(${drinks.quantity})::int`,
      units: sql<number>`sum(${drinks.units})::float`,
      lastDrinkAt: sql<Date | null>`max(${drinks.drunkAt})`.mapWith((v) => (v ? new Date(v) : null)),
    })
    .from(seshDrinks)
    .innerJoin(drinks, eq(drinks.id, seshDrinks.drinkId))
    .innerJoin(users, eq(users.id, drinks.userId))
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, seshDrinks.groupId), eq(groupMembers.userId, users.id)))
    .where(eq(seshDrinks.seshId, seshId))
    .groupBy(users.id, groupMembers.nickname)
    .orderBy(desc(sql`sum(${drinks.quantity})`), desc(sql`sum(${drinks.units})`), shownName);
}

const drinkRowColumns = {
  id: drinks.id,
  type: drinks.type,
  quantity: drinks.quantity,
  units: drinks.units,
  note: drinks.note,
  drunkAt: drinks.drunkAt,
  userId: users.id,
  username: users.username,
  displayName: shownName,
  emoji: users.emoji,
};

export async function getSeshDrinks(seshId: string) {
  return db
    .select({ ...drinkRowColumns, seshId: seshDrinks.seshId, seshName: sql<string | null>`null` })
    .from(seshDrinks)
    .innerJoin(drinks, eq(drinks.id, seshDrinks.drinkId))
    .innerJoin(users, eq(users.id, drinks.userId))
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, seshDrinks.groupId), eq(groupMembers.userId, users.id)))
    .where(eq(seshDrinks.seshId, seshId))
    .orderBy(desc(drinks.drunkAt));
}

/** Recent drinks by group members that aren't in any of this group's seshes yet. */
export async function getUnassignedDrinks(groupId: string, days = 14) {
  return db
    .select({ ...drinkRowColumns, seshId: sql<string | null>`null`, seshName: sql<string | null>`null` })
    .from(drinks)
    .innerJoin(users, eq(users.id, drinks.userId))
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, drinks.userId)))
    .leftJoin(seshDrinks, and(eq(seshDrinks.drinkId, drinks.id), eq(seshDrinks.groupId, groupId)))
    .where(
      and(
        isNull(seshDrinks.drinkId),
        gte(drinks.drunkAt, sql`now() - make_interval(days => ${days})`),
      ),
    )
    .orderBy(desc(drinks.drunkAt))
    .limit(100);
}

/**
 * Ids of the newest `limit` messages plus the timestamp of the oldest of them,
 * so polling clients can drop messages deleted inside that window.
 */
export async function getRecentMessageIds(groupId: string, limit = 100) {
  const rows = await db
    .select({ id: schema.messages.id, createdAt: schema.messages.createdAt })
    .from(schema.messages)
    .where(eq(schema.messages.groupId, groupId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit);
  return {
    ids: rows.map((r) => r.id),
    // null = the window covers the whole history
    since: rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null,
  };
}
