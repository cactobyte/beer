import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    emoji: text("emoji").notNull().default("🍺"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie token; the raw token never touches the DB
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    inviteCode: text("invite_code").notNull(),
    // IANA zone used to decide when "tonight" / "this week" start
    timezone: text("timezone").notNull().default("Europe/London"),
    // Bumped on anything that changes what a member sees (drinks, seshes,
    // members, chat). Open pages poll it and refresh when it moves.
    version: integer("version").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("groups_invite_code_idx").on(t.inviteCode)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
    // Set by the group owner; shown instead of the display name inside this group
    nickname: text("nickname"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("group_members_user_idx").on(t.userId),
  ],
);

// Drinks belong to a person, not a group: one night out counts on every
// leaderboard you're part of.
export const drinks = pgTable(
  "drinks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    quantity: integer("quantity").notNull().default(1),
    // Total alcohol units for this entry (quantity × per-drink units), frozen
    // at log time so catalogue changes never rewrite history.
    units: real("units").notNull(),
    note: text("note"),
    drunkAt: timestamp("drunk_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("drinks_user_drunk_at_idx").on(t.userId, t.drunkAt),
    check("drinks_quantity_range", sql`${t.quantity} between 1 and 20`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_group_created_at_idx").on(t.groupId, t.createdAt),
    check("messages_body_length", sql`char_length(${t.body}) between 1 and 500`),
  ],
);

// A named night out within a group ("The restaurant", "Pres at Dave's").
// At most one is live (ended_at null) per group at a time.
export const seshes = pgTable(
  "seshes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("seshes_group_started_at_idx").on(t.groupId, t.startedAt),
    uniqueIndex("seshes_one_live_per_group_idx").on(t.groupId).where(sql`${t.endedAt} is null`),
  ],
);

// Which sesh a drink counts towards, per group. Drinks belong to people, so
// the same drink can sit in one sesh in each group its drinker is in.
export const seshDrinks = pgTable(
  "sesh_drinks",
  {
    seshId: uuid("sesh_id")
      .notNull()
      .references(() => seshes.id, { onDelete: "cascade" }),
    drinkId: uuid("drink_id")
      .notNull()
      .references(() => drinks.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.seshId, t.drinkId] }),
    uniqueIndex("sesh_drinks_group_drink_idx").on(t.groupId, t.drinkId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(groupMembers),
  drinks: many(drinks),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const drinksRelations = relations(drinks, ({ one }) => ({
  user: one(users, { fields: [drinks.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Drink = typeof drinks.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Sesh = typeof seshes.$inferSelect;
