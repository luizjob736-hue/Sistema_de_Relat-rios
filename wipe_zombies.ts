import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

const dynamicRecords = pgTable("dynamic_records", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull(),
  data: jsonb("data").notNull().$type<any>(),
});

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function run() {
  try {
    await sql`DELETE FROM dynamic_records WHERE report_id = 'default' OR report_id = '1'`;
    console.log("Deleted zombie records");
  } catch(e) {
    console.log("Error:", e);
  }
  process.exit(0);
}
run();
