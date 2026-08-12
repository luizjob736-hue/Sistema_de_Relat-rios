import express from "express";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

export const reportSchemas = pgTable("report_schemas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  fields: jsonb("fields").notNull().$type<any[]>(),
});

export const dynamicRecords = pgTable("dynamic_records", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => reportSchemas.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().$type<Record<string, any>>(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
});

let connectionString = process.env.DATABASE_URL || "";
if (!connectionString.startsWith("postgres")) {
  connectionString = "postgresql://neondb_owner:npg_EUvOxA3yk1za@ep-little-cell-ac1uvd3q-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
}

const sql = postgres(connectionString);
const db = drizzle(sql);

// Auto-run migrations (CREATE TABLE IF NOT EXISTS) when the module loads
async function initDb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS report_schemas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        fields JSONB NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS dynamic_records (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL REFERENCES report_schemas(id) ON DELETE CASCADE,
        data JSONB NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL
      );
    `;

    const existingUsers = await sql`SELECT count(*) FROM users`;
    if (parseInt(existingUsers[0].count) === 0) {
      await sql`INSERT INTO users (id, username, password, role) VALUES ('admin-1', 'Admin', 'Proativa_*2026', 'admin') ON CONFLICT (username) DO NOTHING`;
      await sql`INSERT INTO users (id, username, password, role) VALUES ('viewer-1', 'Visualizador', 'Visua@prt06', 'viewer') ON CONFLICT (username) DO NOTHING`;
      for (let i = 1; i <= 15; i++) {
        await sql`INSERT INTO users (id, username, password, role) VALUES (${`op-${i}`}, ${`Operador ${i}`}, '123456', 'editor') ON CONFLICT (username) DO NOTHING`;
      }
    } else {
      // Ensure Visualizador user exists even if database was already seeded
      await sql`INSERT INTO users (id, username, password, role) VALUES ('viewer-1', 'Visualizador', 'Visua@prt06', 'viewer') ON CONFLICT (username) DO UPDATE SET password = 'Visua@prt06', role = 'viewer'`;
    }

    console.log("Database tables verified/created.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}
initDb();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Auth Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const found = await db.select().from(users).where(eq(users.username, username));
    if (found.length === 0) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    const user = found[0];
    if (user.password !== password) {
      return res.status(401).json({ error: "Senha incorreta" });
    }
    res.json({ success: true, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no login" });
  }
});

// Users Management
app.get("/api/users", async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { id, username, password, role } = req.body;
    const userId = id || `user-${Date.now()}`;
    await db.insert(users).values({ id: userId, username, password, role })
      .onConflictDoUpdate({ target: users.username, set: { password, role } });
    res.json({ success: true, id: userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save user" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(users).where(eq(users.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.get("/api/schemas", async (req, res) => {
  try {
    const allSchemas = await db.select().from(reportSchemas);
    res.json(allSchemas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch schemas" });
  }
});

app.post("/api/schemas", async (req, res) => {
  try {
    const newSchema = req.body;
    await db.insert(reportSchemas).values(newSchema)
      .onConflictDoUpdate({ target: reportSchemas.id, set: { name: newSchema.name, fields: newSchema.fields } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save schema" });
  }
});

app.delete("/api/schemas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(reportSchemas).where(eq(reportSchemas.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete schema" });
  }
});

app.get("/api/records", async (req, res) => {
  try {
    const allRecords = await db.select().from(dynamicRecords);
    res.json(allRecords);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

app.post("/api/records", async (req, res) => {
  try {
    const newRecord = req.body;
    await db.insert(dynamicRecords).values(newRecord)
      .onConflictDoUpdate({ target: dynamicRecords.id, set: { data: newRecord.data, reportId: newRecord.reportId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save record" });
  }
});

app.post("/api/records/bulk", async (req, res) => {
  try {
    const { records, mode, reportId } = req.body;
    
    if (mode === "overwrite") {
      await db.delete(dynamicRecords).where(eq(dynamicRecords.reportId, reportId));
    }
    
    if (records.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        await db.insert(dynamicRecords).values(chunk)
          .onConflictDoUpdate({
            target: dynamicRecords.id,
            set: { data: sql`EXCLUDED.data` }
          });
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save records in bulk" });
  }
});

app.put("/api/records/bulk-update", async (req, res) => {
  try {
    const { ids, updatedData } = req.body;
    
    if (ids.length > 0) {
      const formattedIds = ids.map((id: string) => `'${id}'`).join(',');
      const jsonUpdate = JSON.stringify(updatedData);
      
      await sql`
        UPDATE dynamic_records
        SET data = data || ${jsonUpdate}::jsonb
        WHERE id = ANY(${ids})
      `;
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to bulk update records" });
  }
});

app.delete("/api/records/bulk", async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length > 0) {
      await db.delete(dynamicRecords).where(inArray(dynamicRecords.id, ids));
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete records" });
  }
});

app.delete("/api/records/report/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    await db.delete(dynamicRecords).where(eq(dynamicRecords.reportId, reportId));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear report records" });
  }
});

export default app;
