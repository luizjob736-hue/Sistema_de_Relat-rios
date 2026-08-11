import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, inArray } from "drizzle-orm";
import * as schema from "./src/db/schema.ts";

// Setup database connection
let connectionString = process.env.DATABASE_URL || "";
if (!connectionString.startsWith("postgres")) {
  connectionString = "postgresql://neondb_owner:npg_EUvOxA3yk1za@ep-little-cell-ac1uvd3q-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
}

const sql = postgres(connectionString);
const db = drizzle(sql, { schema });

async function runMigrations() {
  // Try to create tables manually if migrator isn't set up, or just use raw queries for simplicity since we don't have drizzle config here.
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
    console.log("Database tables verified/created.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

async function startServer() {
  await runMigrations();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  
  // Schemas
  app.get("/api/schemas", async (req, res) => {
    try {
      const allSchemas = await db.select().from(schema.reportSchemas);
      res.json(allSchemas);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch schemas" });
    }
  });

  app.post("/api/schemas", async (req, res) => {
    try {
      const newSchema = req.body;
      await db.insert(schema.reportSchemas).values(newSchema)
        .onConflictDoUpdate({ target: schema.reportSchemas.id, set: { name: newSchema.name, fields: newSchema.fields } });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save schema" });
    }
  });

  // Records
  app.get("/api/records", async (req, res) => {
    try {
      const allRecords = await db.select().from(schema.dynamicRecords);
      res.json(allRecords);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch records" });
    }
  });

  app.post("/api/records", async (req, res) => {
    try {
      const newRecord = req.body;
      await db.insert(schema.dynamicRecords).values(newRecord)
        .onConflictDoUpdate({ target: schema.dynamicRecords.id, set: { data: newRecord.data, reportId: newRecord.reportId } });
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
        await db.delete(schema.dynamicRecords).where(eq(schema.dynamicRecords.reportId, reportId));
      }
      
      if (records.length > 0) {
        // Chunk inserts to avoid massive statement size limits
        const chunkSize = 1000;
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          await db.insert(schema.dynamicRecords).values(chunk)
            .onConflictDoUpdate({
              target: schema.dynamicRecords.id,
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
        // For Drizzle postgres-js, updating multiple records dynamically can be done by fetching and updating, or raw sql
        // Let's do raw sql for merging JSONB
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
        await db.delete(schema.dynamicRecords).where(inArray(schema.dynamicRecords.id, ids));
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete records" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
