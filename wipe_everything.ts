import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function run() {
  try {
    // Delete all data in tables, keep structure
    await sql`TRUNCATE TABLE dynamic_records, report_schemas RESTART IDENTITY CASCADE`;
    console.log("All data cleared successfully.");
  } catch(e) {
    console.log("Error clearing data:", e);
  }
  process.exit(0);
}
run();
