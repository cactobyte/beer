import "server-only";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import type { Period } from "./drinks";

const { users, groups, groupMembers, drinks } = schema;

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
      displayName: users.displayName,
      emoji: users.emoji,
      drinks: sql<number>`coalesce(sum(${drinks.quantity}), 0)::int`,
      units: sql<number>`coalesce(sum(${drinks.units}), 0)::float`,
      lastDrinkAt: sql<Date | null>`max(${drinks.drunkAt})`.mapWith((v) => (v ? new Date(v) : null)),
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(drinks, and(eq(drinks.userId, users.id), inPeriod))
    .where(eq(groupMembers.groupId, groupId))
    .groupBy(users.id)
    .orderBy(
      desc(sql`coalesce(sum(${drinks.quantity}), 0)`),
      desc(sql`coalesce(sum(${drinks.units}), 0)`),
      users.displayName,
    );
}

export type LeaderboardRow = Awaited<ReturnType<typeof getLeaderboard>>[number];

/** Latest drinks logged by anyone in the group. */
export async function getGroupFeed(groupId: string, limit = 25) {
  const memberIds = db
    .select({ id: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

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
      displayName: users.displayName,
      emoji: users.emoji,
    })
    .from(drinks)
    .innerJoin(users, eq(users.id, drinks.userId))
    .where(inArray(drinks.userId, memberIds))
    .orderBy(desc(drinks.drunkAt))
    .limit(limit);
}

export type FeedItem = Awaited<ReturnType<typeof getGroupFeed>>[number];

export async function getGroupMembers(groupId: string) {
  return db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
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
