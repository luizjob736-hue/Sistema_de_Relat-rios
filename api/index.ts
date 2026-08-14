import express from "express";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "db_fallback_cache.json");

interface FallbackData {
  users: any[];
  schemas: any[];
  records: any[];
}

function loadFallbackData(): FallbackData {
  const defaultFields = [
    { id: 'nomeBase', label: 'Base', type: 'text', readOnly: true },
    { id: 'nome', label: 'Nome', type: 'text', readOnly: true },
    { id: 'cpf', label: 'CPF', type: 'text', readOnly: true },
    { id: 'email', label: 'E-mail', type: 'text', readOnly: true },
    { id: 'telefone', label: 'Telefone', type: 'text', readOnly: true },
    { id: 'valorSolicitado', label: 'Valor Solicitado', type: 'text', readOnly: true },
    { id: 'valorLiberado', label: 'Valor Liberado', type: 'text', readOnly: true },
    { id: 'tentativa1', label: 'Tentativa 1', type: 'text', readOnly: false },
    { id: 'status', label: 'Status', type: 'list', options: ['-', 'Com Sucesso', 'Sem Resposta', 'Sem Sucesso'], readOnly: false },
    { id: 'observacaoFinal', label: 'Observação final', type: 'list', options: ['-', 'Cliente informa que desconto foi realizado', 'Cliente informa que desconto não foi realizado', 'Sem contato com o cliente'], readOnly: false }
  ];

  const initialUsers = [
    { id: 'admin-1', username: 'Admin', password: 'Proativa_*2026', role: 'admin' },
    { id: 'viewer-1', username: 'Visualizador', password: 'Visua@prt06', role: 'viewer' },
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `op-${i + 1}`,
      username: `Operador ${i + 1}`,
      password: '123456',
      role: 'editor'
    }))
  ];

  const defaultData: FallbackData = {
    users: initialUsers,
    schemas: [],
    records: []
  };

  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return {
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : defaultData.users,
        schemas: Array.isArray(parsed.schemas) && parsed.schemas.length > 0 ? parsed.schemas : defaultData.schemas,
        records: Array.isArray(parsed.records) ? parsed.records : defaultData.records
      };
    }
  } catch (e) {
    console.error("Failed to load fallback cache file, using defaults", e);
  }
  return defaultData;
}

function saveFallbackData(data: FallbackData) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save fallback cache file", e);
  }
}

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

    
    // Clean up legacy schema '1' if present and migrate its records to 'default'
    try {
      await sql`UPDATE dynamic_records SET report_id = 'default' WHERE report_id = '1'`;
      await sql`DELETE FROM report_schemas WHERE id = '1'`;
    } catch (e) {}

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
    let user;
    try {
      const found = await db.select().from(users).where(eq(users.username, username));
      user = found[0];
    } catch (dbErr) {
      // Secondary login source check
      const cache = loadFallbackData();
      user = cache.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
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
    let allUsers;
    try {
      allUsers = await db.select().from(users);
    } catch (dbErr) {
      // Secondary user data load
      const cache = loadFallbackData();
      allUsers = cache.users;
    }
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
    let dbSuccess = false;
    try {
      await db.insert(users).values({ id: userId, username, password, role })
        .onConflictDoUpdate({ target: users.username, set: { password, role } });
      dbSuccess = true;
    } catch (dbErr) {
      // Secondary user write executed
    }

    // Update Cache
    const cache = loadFallbackData();
    const existingIndex = cache.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    const userToSave = { id: userId, username, password, role };
    if (existingIndex >= 0) {
      cache.users[existingIndex] = userToSave;
    } else {
      cache.users.push(userToSave);
    }
    saveFallbackData(cache);

    res.json({ success: true, id: userId, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save user" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let dbSuccess = false;
    try {
      await db.delete(users).where(eq(users.id, id));
      dbSuccess = true;
    } catch (dbErr) {
      // Secondary user delete executed
    }

    // Remove from Cache
    const cache = loadFallbackData();
    cache.users = cache.users.filter(u => u.id !== id);
    saveFallbackData(cache);

    res.json({ success: true, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.get("/api/schemas", async (req, res) => {
  try {
    let allSchemas;
    try {
      allSchemas = await db.select().from(reportSchemas);
    } catch (dbErr) {
      // Secondary schemas read executed
      const cache = loadFallbackData();
      allSchemas = cache.schemas;
    }

    const uniqueSchemas: typeof allSchemas = [];
    const seenIds = new Set<string>();
    const seenNames = new Map<string, string>(); // normName -> id

    for (const schema of allSchemas) {
      if (!schema || !schema.id) continue;
      const sId = schema.id === '1' ? 'default' : schema.id;
      const normName = (schema.name || "").trim().toLowerCase();

      if (seenNames.has(normName) || seenIds.has(sId)) {
        continue;
      }

      uniqueSchemas.push({ ...schema, id: sId });
      seenIds.add(sId);
      if (normName) {
        seenNames.set(normName, sId);
      }
    }

    res.json(uniqueSchemas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch schemas" });
  }
});

app.post("/api/schemas", async (req, res) => {
  try {
    const newSchema = req.body;
    if (!newSchema || !newSchema.name) {
      return res.status(400).json({ error: "Invalid schema payload" });
    }
    const schemaId = (!newSchema.id || newSchema.id === '1') ? 'default' : newSchema.id;
    const normName = newSchema.name.trim().toLowerCase();

    let targetId = schemaId;
    let dbSuccess = false;
    try {
      // Check if a schema with this name already exists under another ID
      const existingByName = await sql`
        SELECT id FROM report_schemas WHERE LOWER(TRIM(name)) = ${normName}
      `;
      targetId = existingByName.length > 0 ? existingByName[0].id : schemaId;

      await sql`
        INSERT INTO report_schemas (id, name, fields)
        VALUES (${targetId}, ${newSchema.name}, ${JSON.stringify(newSchema.fields || [])}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          fields = EXCLUDED.fields
      `;
      dbSuccess = true;
    } catch (dbErr) {
      // Secondary schema write executed
    }

    // Update Cache
    const cache = loadFallbackData();
    const existingIndex = cache.schemas.findIndex(s => s.id === targetId || s.name.trim().toLowerCase() === normName);
    const schemaToSave = { id: targetId, name: newSchema.name, fields: newSchema.fields || [] };
    if (existingIndex >= 0) {
      cache.schemas[existingIndex] = schemaToSave;
    } else {
      cache.schemas.push(schemaToSave);
    }
    saveFallbackData(cache);

    res.json({ success: true, id: targetId, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save schema" });
  }
});

app.delete("/api/schemas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let dbSuccess = false;
    try {
      await db.delete(reportSchemas).where(eq(reportSchemas.id, id));
      dbSuccess = true;
    } catch (dbErr) {
      console.error("DB_ERR in delete schema:", dbErr);
      throw dbErr; // Let the outer catch handle it
    }

    // Update Cache
    const cache = loadFallbackData();
    cache.schemas = cache.schemas.filter(s => s.id !== id);
    cache.records = cache.records.filter(r => r.reportId !== id);
    saveFallbackData(cache);

    res.json({ success: true, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete schema" });
  }
});

app.get("/api/records", async (req, res) => {
  try {
    let allRecords;
    try {
      allRecords = await sql`
        SELECT id, report_id as "reportId", data
        FROM dynamic_records
      `;
    } catch (dbErr) {
      // Secondary records read executed
      const cache = loadFallbackData();
      allRecords = cache.records;
    }
    res.json(allRecords);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

app.post("/api/records", async (req, res) => {
  try {
    const newRecord = req.body;
    const rId = newRecord.reportId || 'default';

    let dbSuccess = false;
    try {
      const dataJson = JSON.stringify(newRecord.data || {});
      await sql`
        INSERT INTO dynamic_records (id, report_id, data)
        VALUES (${newRecord.id}, ${rId}, ${dataJson}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data,
          report_id = EXCLUDED.report_id
      `;
      dbSuccess = true;
    } catch (dbErr) {
      // Secondary record write executed
    }

    // Update Cache
    const cache = loadFallbackData();
    const existingIndex = cache.records.findIndex(r => r.id === newRecord.id);
    const recordToSave = { id: newRecord.id, reportId: rId, data: newRecord.data || {} };
    if (existingIndex >= 0) {
      cache.records[existingIndex] = recordToSave;
    } else {
      cache.records.push(recordToSave);
    }
    saveFallbackData(cache);

    res.json({ success: true, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save record" });
  }
});

app.post("/api/records/bulk", async (req, res) => {
  try {
    const { records, mode, reportId } = req.body;
    const targetReportId = reportId || (records && records[0]?.reportId) || 'default';
    
    let dbSuccess = false;
    try {
      if (mode === "overwrite") {
        if (targetReportId === 'default' || targetReportId === '1') {
          await sql`DELETE FROM dynamic_records WHERE report_id = 'default' OR report_id = '1' OR report_id = ${targetReportId}`;
        } else {
          await sql`DELETE FROM dynamic_records WHERE report_id = ${targetReportId}`;
        }
      }
      
      if (records && Array.isArray(records) && records.length > 0) {
        const chunkSize = 2000;
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          const rows = chunk.map((rec: any) => ({
            id: rec.id,
            report_id: rec.reportId || targetReportId,
            data: rec.data || {}
          }));

          const jsonPayload = JSON.stringify(rows);
          await sql`
            INSERT INTO dynamic_records (id, report_id, data)
            SELECT
              (x->>'id')::text,
              (x->>'report_id')::text,
              (x->'data')::jsonb
            FROM jsonb_array_elements(${jsonPayload}::jsonb) AS x
            ON CONFLICT (id) DO UPDATE SET
              data = EXCLUDED.data,
              report_id = EXCLUDED.report_id
          `;
        }
      }
      dbSuccess = true;
    } catch (dbErr) {
      console.error("Critical DB error during bulk import:", dbErr);
      dbSuccess = false;
    }

    if (!dbSuccess) {
      return res.status(500).json({ error: "Failed to save records to database" });
    }

    // Sync Cache with O(1) map index
    const cache = loadFallbackData();
    if (mode === "overwrite") {
      if (targetReportId === 'default' || targetReportId === '1') {
        cache.records = cache.records.filter(r => r.reportId !== 'default' && r.reportId !== '1' && r.reportId !== targetReportId);
      } else {
        cache.records = cache.records.filter(r => r.reportId !== targetReportId);
      }
    }

    if (records && records.length > 0) {
      const existingMap = new Map<string, number>();
      cache.records.forEach((r, idx) => existingMap.set(r.id, idx));

      records.forEach((rec: any) => {
        const recReportId = rec.reportId || targetReportId;
        const recordToSave = { id: rec.id, reportId: recReportId, data: rec.data || {} };
        const existingIndex = existingMap.get(rec.id);
        if (existingIndex !== undefined) {
          cache.records[existingIndex] = recordToSave;
        } else {
          cache.records.push(recordToSave);
          existingMap.set(rec.id, cache.records.length - 1);
        }
      });
    }
    saveFallbackData(cache);

    res.json({ success: true, count: records ? records.length : 0, fallback: !dbSuccess });
  } catch (err) {
    console.error("Error in /api/records/bulk:", err);
    res.status(500).json({ error: "Failed to save records in bulk" });
  }
});

app.put("/api/records/bulk-update", async (req, res) => {
  try {
    const { ids, updatedData } = req.body;
    
    let dbSuccess = false;
    if (ids && ids.length > 0) {
      try {
        const jsonUpdate = JSON.stringify(updatedData);
        await sql`
          UPDATE dynamic_records
          SET data = data || ${jsonUpdate}::jsonb
          WHERE id = ANY(${ids})
        `;
        dbSuccess = true;
      } catch (dbErr) {
        // Secondary bulk update executed
      }

      // Sync Cache
      const cache = loadFallbackData();
      cache.records = cache.records.map(r => {
        if (ids.includes(r.id)) {
          return { ...r, data: { ...r.data, ...updatedData } };
        }
        return r;
      });
      saveFallbackData(cache);
    }
    
    res.json({ success: true, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to bulk update records" });
  }
});

app.delete("/api/records/bulk", async (req, res) => {
  try {
    const { ids } = req.body;
    let dbSuccess = false;
    if (ids && ids.length > 0) {
      try {
        await db.delete(dynamicRecords).where(inArray(dynamicRecords.id, ids));
        dbSuccess = true;
      } catch (dbErr) {
        // Secondary bulk delete executed
      }

      // Sync Cache
      const cache = loadFallbackData();
      cache.records = cache.records.filter(r => !ids.includes(r.id));
      saveFallbackData(cache);
    }
    res.json({ success: true, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete records" });
  }
});

app.delete("/api/records/report/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    let dbSuccess = false;
    try {
      if (reportId === 'default' || reportId === '1') {
        await sql`DELETE FROM dynamic_records WHERE report_id = 'default' OR report_id = '1' OR report_id = ${reportId}`;
      } else {
        await sql`DELETE FROM dynamic_records WHERE report_id = ${reportId}`;
      }
      dbSuccess = true;
    } catch (dbErr) {
      console.error("DB_ERR:", dbErr);
    }

    // Sync Cache
    const cache = loadFallbackData();
    if (reportId === 'default' || reportId === '1') {
      cache.records = cache.records.filter(r => r.reportId !== 'default' && r.reportId !== '1' && r.reportId !== reportId);
    } else {
      cache.records = cache.records.filter(r => r.reportId !== reportId);
    }
    saveFallbackData(cache);

    res.json({ success: true, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear report records" });
  }
});

export default app;
