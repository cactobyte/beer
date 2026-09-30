// Applies pending SQL migrations from ./drizzle. Runs before `next build`, so
// every Vercel deploy brings the database schema up to date first.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("migrate: schema up to date");
} finally {
  await sql.end();
}
