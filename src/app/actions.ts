"use server";

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, asc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { DRINK_TYPES, EMOJIS, type DrinkType } from "@/lib/drinks";
import { getMessageById, isMember, requireGroup, requireSesh, type ChatMessage } from "@/lib/queries";
import * as v from "@/lib/validation";
import type { FormState } from "@/lib/validation";

const { users, groups, groupMembers, drinks, seshes, seshDrinks } = schema;

/** Postgres unique_violation. Drizzle wraps driver errors, so check the cause chain too. */
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  if ("code" in e && e.code === "23505") return true;
  return "cause" in e && isUniqueViolation(e.cause);
}

// Compared against when the username doesn't exist, so response time doesn't leak which usernames exist
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

/** Tells open pages in this group to refresh (they poll groups.version). */
async function touchGroup(groupId: string) {
  await db
    .update(groups)
    .set({ version: sql`${groups.version} + 1` })
    .where(eq(groups.id, groupId));
}

/** Same, for every group a user is in (their drinks show in all of them). */
async function touchUserGroups(userId: string) {
  const mine = db.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
  await db
    .update(groups)
    .set({ version: sql`${groups.version} + 1` })
    .where(inArray(groups.id, mine));
}

/** Only allow same-site relative redirects. */
function safeNext(next: FormDataEntryValue | null) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  username: v.username,
  displayName: v.displayName,
  password: v.password,
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: v.firstError(parsed.error) };
  const { username, displayName, password } = parsed.data;

  let userId: string;
  try {
    const [user] = await db
      .insert(users)
      .values({
        username,
        displayName,
        passwordHash: await bcrypt.hash(password, 10),
        emoji: EMOJIS[randomInt(EMOJIS.length)],
      })
      .returning({ id: users.id });
    userId = user.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "That username is taken" };
    throw e;
  }

  await createSession(userId);
  redirect(safeNext(form.get("next")));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Wrong username or password" };

  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = z
    .object({ displayName: v.displayName, emoji: z.enum(EMOJIS as [string, ...string[]]) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: v.firstError(parsed.error) };

  await db.update(users).set(parsed.data).where(eq(users.id, me.id));
  await touchUserGroups(me.id);
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const parsed = v.password.safeParse(form.get("password"));
  if (!parsed.success) return { error: v.firstError(parsed.error) };

  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id));
  if (!(await bcrypt.compare(current, row.hash))) return { error: "Current password is wrong" };

  await db.update(users).set({ passwordHash: await bcrypt.hash(parsed.data, 10) }).where(eq(users.id, me.id));
  // Log out every other device
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, me.id));
  await createSession(me.id);
  return { ok: "Password changed" };
}

// ─── Groups ──────────────────────────────────────────────────────────────────

// No 0/O/1/I/L so codes survive being read out loud in a loud bar
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newInviteCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export async function createGroup(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = z
    .object({ name: v.groupName, timezone: v.timezone.catch("Europe/London") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: v.firstError(parsed.error) };

  let groupId: string | undefined;
  for (let attempt = 0; attempt < 5 && !groupId; attempt++) {
    try {
      groupId = await db.transaction(async (tx) => {
        const [g] = await tx
          .insert(groups)
          .values({ ...parsed.data, inviteCode: newInviteCode(), createdBy: me.id })
          .returning({ id: groups.id });
        await tx.insert(groupMembers).values({ groupId: g.id, userId: me.id, role: "owner" });
        return g.id;
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // invite code collision → retry
    }
  }
  if (!groupId) return { error: "Couldn't create group, try again" };

  revalidatePath("/", "layout");
  redirect(`/g/${groupId}`);
}

export async function joinGroup(_: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "")
    .trim()
    .toUpperCase();
  const me = await requireUser(`/join/${encodeURIComponent(code)}`);
  const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.inviteCode, code)).limit(1);
  if (!group) return { error: "No group with that code" };

  await db.insert(groupMembers).values({ groupId: group.id, userId: me.id }).onConflictDoNothing();
  await touchGroup(group.id);
  revalidatePath("/", "layout");
  redirect(`/g/${group.id}`);
}

export async function leaveGroup(groupId: string) {
  const me = await requireUser();
  const { role } = await requireGroup(groupId, me.id);

  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, me.id)));
    if (role !== "owner") return;
    // Hand ownership to the longest-standing member, or delete the empty group
    const [heir] = await tx
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt))
      .limit(1);
    if (heir) {
      await tx
        .update(groupMembers)
        .set({ role: "owner" })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, heir.userId)));
    } else {
      await tx.delete(groups).where(eq(groups.id, groupId));
    }
  });

  await touchGroup(groupId);
  revalidatePath("/", "layout");
  redirect("/groups");
}

async function requireOwner(groupId: string) {
  const me = await requireUser();
  const { role } = await requireGroup(groupId, me.id);
  if (role !== "owner") throw new Error("Only the group owner can do that");
  return me;
}

export async function updateGroup(groupId: string, _: FormState, form: FormData): Promise<FormState> {
  await requireOwner(groupId);
  const parsed = z.object({ name: v.groupName, timezone: v.timezone }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: v.firstError(parsed.error) };

  await db.update(groups).set(parsed.data).where(eq(groups.id, groupId));
  await touchGroup(groupId);
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

export async function regenerateInvite(groupId: string) {
  await requireOwner(groupId);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.update(groups).set({ inviteCode: newInviteCode() }).where(eq(groups.id, groupId));
      break;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
}

export async function removeMember(groupId: string, userId: string) {
  const me = await requireOwner(groupId);
  if (userId === me.id) throw new Error("Use 'leave group' instead");
  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), ne(groupMembers.role, "owner")));
  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
}

/** Owner gives a member a name that's shown everywhere inside this group. Blank clears it. */
export async function setNickname(groupId: string, userId: string, _: FormState, form: FormData): Promise<FormState> {
  await requireOwner(groupId);
  const raw = String(form.get("nickname") ?? "").trim();
  let nickname: string | null = null;
  if (raw) {
    const parsed = v.displayName.safeParse(raw);
    if (!parsed.success) return { error: v.firstError(parsed.error) };
    nickname = parsed.data;
  }
  const updated = await db
    .update(groupMembers)
    .set({ nickname })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .returning({ userId: groupMembers.userId });
  if (updated.length === 0) return { error: "They're not in this group" };
  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
  return { ok: nickname ? "Renamed" : "Nickname cleared" };
}

// ─── Drinks ──────────────────────────────────────────────────────────────────

export type LogResult = { error?: string; loggedId?: string; label?: string; at?: number } | undefined;

export async function logDrink(_: LogResult, form: FormData): Promise<LogResult> {
  const me = await requireUser();
  const parsed = v.logDrink.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: v.firstError(parsed.error) };
  const { type, quantity, note, drunkAt } = parsed.data;
  const info = DRINK_TYPES[type as DrinkType];

  const [row] = await db
    .insert(drinks)
    .values({
      userId: me.id,
      type,
      quantity,
      note,
      drunkAt,
      units: Math.round(info.units * quantity * 10) / 10,
    })
    .returning({ id: drinks.id });

  // Count it towards every live sesh (started before the drink) in the drinker's groups
  const live = await db
    .select({ seshId: seshes.id, groupId: seshes.groupId })
    .from(seshes)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, seshes.groupId), eq(groupMembers.userId, me.id)))
    .where(and(isNull(seshes.endedAt), lte(seshes.startedAt, drunkAt)));
  if (live.length) {
    await db
      .insert(seshDrinks)
      .values(live.map((l) => ({ ...l, drinkId: row.id })))
      .onConflictDoNothing();
  }

  await touchUserGroups(me.id);
  revalidatePath("/", "layout");
  return {
    loggedId: row.id,
    label: `${quantity > 1 ? `${quantity}× ` : ""}${info.label} ${info.emoji}`,
    // Lets the client tell two identical logs apart
    at: Date.now(),
  };
}

/**
 * The drinker's id if `me` may change this drink (it's theirs, or `groupId` is
 * given, they own that group, and the drinker is a member of it), else null.
 */
async function canManageDrink(meId: string, drinkId: string, groupId?: string) {
  if (!/^[0-9a-f-]{36}$/i.test(drinkId)) return null;
  const [drink] = await db.select({ userId: drinks.userId }).from(drinks).where(eq(drinks.id, drinkId)).limit(1);
  if (!drink) return null;
  if (drink.userId === meId) return drink.userId;
  if (!groupId || !/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  const rows = await db
    .select({ userId: groupMembers.userId, role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, [meId, drink.userId])));
  const mine = rows.find((r) => r.userId === meId);
  return mine?.role === "owner" && rows.some((r) => r.userId === drink.userId) ? drink.userId : null;
}

export async function deleteDrink(drinkId: string, groupId?: string) {
  const me = await requireUser();
  const drinker = await canManageDrink(me.id, drinkId, groupId);
  if (!drinker) return;
  await db.delete(drinks).where(eq(drinks.id, drinkId));
  await touchUserGroups(drinker);
  revalidatePath("/", "layout");
}

export async function editDrink(drinkId: string, groupId: string | undefined, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const drinker = await canManageDrink(me.id, drinkId, groupId);
  if (!drinker) return { error: "You can't edit that drink" };
  const parsed = v.editDrink.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: v.firstError(parsed.error) };
  const { type, quantity, note, drunkAt } = parsed.data;

  await db
    .update(drinks)
    .set({
      type,
      quantity,
      note,
      drunkAt,
      units: Math.round(DRINK_TYPES[type as DrinkType].units * quantity * 10) / 10,
    })
    .where(eq(drinks.id, drinkId));
  await touchUserGroups(drinker);
  revalidatePath("/", "layout");
  return { ok: "Saved" };
}

// ─── Seshes ──────────────────────────────────────────────────────────────────

/** Starts a sesh, ending the live one first ("next sesh"). Any member can. */
export async function startSesh(groupId: string, _: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  await requireGroup(groupId, me.id);
  const parsed = v.seshName.safeParse(form.get("name"));
  if (!parsed.success) return { error: v.firstError(parsed.error) };

  let seshId: string;
  try {
    seshId = await db.transaction(async (tx) => {
      await tx
        .update(seshes)
        .set({ endedAt: new Date() })
        .where(and(eq(seshes.groupId, groupId), isNull(seshes.endedAt)));
      const [s] = await tx
        .insert(seshes)
        .values({ groupId, name: parsed.data, createdBy: me.id })
        .returning({ id: seshes.id });
      return s.id;
    });
  } catch (e) {
    // Someone else started one at the same moment
    if (isUniqueViolation(e)) return { error: "A sesh was just started, refresh" };
    throw e;
  }

  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
  redirect(`/g/${groupId}/s/${seshId}`);
}

export async function endSesh(groupId: string, seshId: string) {
  const me = await requireUser();
  await requireGroup(groupId, me.id);
  await db
    .update(seshes)
    .set({ endedAt: new Date() })
    .where(and(eq(seshes.id, seshId), eq(seshes.groupId, groupId), isNull(seshes.endedAt)));
  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
}

export async function renameSesh(groupId: string, seshId: string, _: FormState, form: FormData): Promise<FormState> {
  await requireOwner(groupId);
  const parsed = v.seshName.safeParse(form.get("name"));
  if (!parsed.success) return { error: v.firstError(parsed.error) };
  await db
    .update(seshes)
    .set({ name: parsed.data })
    .where(and(eq(seshes.id, seshId), eq(seshes.groupId, groupId)));
  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
  return { ok: "Renamed" };
}

/** Deletes the sesh only; its drinks stay on everyone's record, just unassigned. */
export async function deleteSesh(groupId: string, seshId: string) {
  await requireOwner(groupId);
  await db.delete(seshes).where(and(eq(seshes.id, seshId), eq(seshes.groupId, groupId)));
  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
  redirect(`/g/${groupId}`);
}

/**
 * Owner tool: put drinks into a sesh (moving them out of any other sesh in
 * this group), or pass `seshId: null` to take them out of seshes entirely.
 */
export async function assignDrinks(groupId: string, seshId: string | null, drinkIds: string[]) {
  await requireOwner(groupId);
  const ids = drinkIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
  if (ids.length === 0) return;
  if (seshId) await requireSesh(groupId, seshId);

  // Only drinks by current members of this group
  const memberIds = db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  const valid = await db
    .select({ id: drinks.id })
    .from(drinks)
    .where(and(inArray(drinks.id, ids), inArray(drinks.userId, memberIds)));
  const validIds = valid.map((d) => d.id);
  if (validIds.length === 0) return;

  await db.transaction(async (tx) => {
    await tx.delete(seshDrinks).where(and(eq(seshDrinks.groupId, groupId), inArray(seshDrinks.drinkId, validIds)));
    if (seshId) {
      await tx.insert(seshDrinks).values(validIds.map((drinkId) => ({ seshId, drinkId, groupId })));
    }
  });
  await touchGroup(groupId);
  revalidatePath(`/g/${groupId}`, "layout");
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type SendResult = { error?: string; message?: ChatMessage };

export async function sendMessage(groupId: string, body: string): Promise<SendResult> {
  const me = await requireUser();
  const parsed = v.messageBody.safeParse(body);
  if (!parsed.success) return { error: v.firstError(parsed.error) };
  if (!(await isMember(groupId, me.id))) return { error: "You're not in this group" };

  const [row] = await db
    .insert(schema.messages)
    .values({ groupId, userId: me.id, body: parsed.data })
    .returning({ id: schema.messages.id });
  await touchGroup(groupId);
  const message = await getMessageById(row.id);
  return message ? { message } : { error: "Couldn't send" };
}

export async function deleteMessage(messageId: string) {
  const me = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return;
  const [gone] = await db
    .delete(schema.messages)
    .where(and(eq(schema.messages.id, messageId), eq(schema.messages.userId, me.id)))
    .returning({ groupId: schema.messages.groupId });
  if (gone) await touchGroup(gone.groupId);
}
