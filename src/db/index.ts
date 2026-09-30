import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse one client across hot reloads in dev and across invocations of a warm
// serverless function in prod.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

const client =
  globalForDb.sql ??
  postgres(url, {
    // Neon's pooled endpoint (PgBouncer, transaction mode) can't hold prepared statements
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = client;

export const db = drizzle(client, { schema });
export { schema };
