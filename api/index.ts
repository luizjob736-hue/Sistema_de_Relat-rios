import express from "express";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import { pgTable, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";

const CACHE_FILE = path.join(process.cwd(), "db_fallback_cache.json");

interface FallbackData {
  users: any[];
  schemas: any[];
  records: any[];
  tratativas?: any[];
  backups?: any[];
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
    {
      id: 'observacaoFinal',
      label: 'Observação final',
      type: 'list',
      options: [
        '-',
        'Link de formalização enviado/reenviado',
        'Contato sem sucesso',
        'Proposta finalizada/paga',
        'Proposta cancelada',
        'Proposta reprovada',
        'Proposta reapresentada',
        'Documentação pendente',
        'Documentação apresentada',
        'Dados corrigidos',
        'Aguardando',
        'Sem interesse',
        'Retorno à jornada'
      ],
      readOnly: false
    }
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
    records: [],
    tratativas: [],
    backups: []
  };

  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(content);
      return {
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : defaultData.users,
        schemas: Array.isArray(parsed.schemas) && parsed.schemas.length > 0 ? parsed.schemas : defaultData.schemas,
        records: Array.isArray(parsed.records) ? parsed.records : defaultData.records,
        tratativas: Array.isArray(parsed.tratativas) ? parsed.tratativas : defaultData.tratativas,
        backups: Array.isArray(parsed.backups) ? parsed.backups : defaultData.backups
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

export const auditTratativas = pgTable("audit_tratativas", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  dateStr: text("date_str").notNull(),
  username: text("username").notNull(),
  userRole: text("user_role"),
  reportId: text("report_id").notNull(),
  recordId: text("record_id").notNull(),
  clientName: text("client_name"),
  clientCpf: text("client_cpf"),
  actionType: text("action_type").notNull(),
  details: jsonb("details").notNull().$type<Record<string, any>>(),
});

export const databaseBackups = pgTable("database_backups", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  dateStr: text("date_str").notNull(),
  backupType: text("backup_type").notNull(),
  totalSchemas: integer("total_schemas").notNull(),
  totalRecords: integer("total_records").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  schemasSummary: jsonb("schemas_summary").notNull().$type<any[]>(),
  snapshotData: jsonb("snapshot_data").notNull().$type<Record<string, any>>(),
  status: text("status").notNull(),
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
    await sql`
      CREATE TABLE IF NOT EXISTS audit_tratativas (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_str TEXT NOT NULL,
        username TEXT NOT NULL,
        user_role TEXT,
        report_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        client_name TEXT,
        client_cpf TEXT,
        action_type TEXT NOT NULL,
        details JSONB NOT NULL
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_audit_tratativas_date ON audit_tratativas(date_str);
      CREATE INDEX IF NOT EXISTS idx_audit_tratativas_user ON audit_tratativas(username);
      CREATE INDEX IF NOT EXISTS idx_audit_tratativas_report ON audit_tratativas(report_id);
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS database_backups (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        date_str TEXT NOT NULL,
        backup_type TEXT NOT NULL,
        total_schemas INT NOT NULL,
        total_records INT NOT NULL,
        file_size_bytes INT,
        schemas_summary JSONB NOT NULL,
        snapshot_data JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'SUCCESS'
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_database_backups_date ON database_backups(date_str);
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

// Helper to log Tratativas
async function logTratativa(entry: {
  username: string;
  userRole?: string;
  reportId: string;
  recordId: string;
  clientName?: string;
  clientCpf?: string;
  actionType: string;
  details: Record<string, any>;
}) {
  const id = `trat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const payload = {
    id,
    createdAt: now.toISOString(),
    dateStr,
    username: entry.username || 'Operador',
    userRole: entry.userRole || 'editor',
    reportId: entry.reportId || 'default',
    recordId: entry.recordId,
    clientName: entry.clientName || '',
    clientCpf: entry.clientCpf || '',
    actionType: entry.actionType || 'TRATATIVA',
    details: entry.details || {}
  };

  try {
    const detailsJson = JSON.stringify(entry.details || {});
    await sql`
      INSERT INTO audit_tratativas (id, created_at, date_str, username, user_role, report_id, record_id, client_name, client_cpf, action_type, details)
      VALUES (${id}, ${now}, ${dateStr}, ${payload.username}, ${payload.userRole}, ${payload.reportId}, ${payload.recordId}, ${payload.clientName}, ${payload.clientCpf}, ${payload.actionType}, ${detailsJson}::jsonb)
    `;
  } catch (err) {
    console.warn("Direct DB write for tratativa failed, storing in cache", err);
  }

  // Also cache fallback
  try {
    const cache = loadFallbackData();
    if (!cache.tratativas) cache.tratativas = [];
    cache.tratativas.unshift(payload);
    if (cache.tratativas.length > 5000) {
      cache.tratativas = cache.tratativas.slice(0, 5000);
    }
    saveFallbackData(cache);
  } catch (e) {}

  return payload;
}

// Full Database Backup Engine
async function executeDatabaseBackup(type: 'AUTOMATIC_DAILY' | 'MANUAL' = 'AUTOMATIC_DAILY') {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const id = `backup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  try {
    let allSchemas: any[] = [];
    let allRecords: any[] = [];
    let allUsers: any[] = [];
    let allTratativas: any[] = [];

    try {
      [allSchemas, allRecords, allUsers, allTratativas] = await Promise.all([
        sql`SELECT id, name, fields FROM report_schemas`,
        sql`SELECT id, report_id as "reportId", data FROM dynamic_records`,
        sql`SELECT id, username, role FROM users`,
        sql`SELECT id, created_at as "createdAt", date_str as "dateStr", username, user_role as "userRole", report_id as "reportId", record_id as "recordId", client_name as "clientName", client_cpf as "clientCpf", action_type as "actionType", details FROM audit_tratativas ORDER BY created_at DESC LIMIT 5000`
      ]);
    } catch (dbErr) {
      const cache = loadFallbackData();
      allSchemas = cache.schemas || [];
      allRecords = cache.records || [];
      allUsers = cache.users || [];
      allTratativas = cache.tratativas || [];
    }

    const schemaSummary = (allSchemas || []).map(s => {
      const count = (allRecords || []).filter(r => r.reportId === s.id || r.report_id === s.id).length;
      return { id: s.id, name: s.name, recordCount: count };
    });

    const snapshotData = {
      backupId: id,
      timestamp: now.toISOString(),
      dateStr,
      backupType: type,
      totalSchemas: allSchemas.length,
      totalRecords: allRecords.length,
      schemas: allSchemas,
      records: allRecords,
      users: allUsers,
      tratativas: allTratativas
    };

    const snapshotJson = JSON.stringify(snapshotData);
    const fileSizeBytes = Buffer.byteLength(snapshotJson, 'utf-8');
    const summaryJson = JSON.stringify(schemaSummary);

    // Save to PostgreSQL database_backups table
    try {
      await sql`
        INSERT INTO database_backups (id, created_at, date_str, backup_type, total_schemas, total_records, file_size_bytes, schemas_summary, snapshot_data, status)
        VALUES (${id}, ${now}, ${dateStr}, ${type}, ${allSchemas.length}, ${allRecords.length}, ${fileSizeBytes}, ${summaryJson}::jsonb, ${snapshotJson}::jsonb, 'SUCCESS')
      `;
    } catch (dbErr) {
      console.warn("Failed to write backup record to DB, writing to file & cache", dbErr);
    }

    // Save locally to backups directory
    try {
      const backupDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const fileName = `backup_${dateStr}_${type.toLowerCase()}_${id}.json`;
      fs.writeFileSync(path.join(backupDir, fileName), snapshotJson, "utf-8");
    } catch (fsErr) {
      console.warn("Failed to write local backup file", fsErr);
    }

    // Save to cache
    const cache = loadFallbackData();
    if (!cache.backups) cache.backups = [];
    cache.backups.unshift({
      id,
      createdAt: now.toISOString(),
      dateStr,
      backupType: type,
      totalSchemas: allSchemas.length,
      totalRecords: allRecords.length,
      fileSizeBytes,
      schemasSummary: schemaSummary,
      status: 'SUCCESS'
    });
    if (cache.backups.length > 50) cache.backups = cache.backups.slice(0, 50);
    saveFallbackData(cache);

    console.log(`[Database Backup] ${type} backup completed successfully (ID: ${id}, Records: ${allRecords.length}, Schemas: ${allSchemas.length})`);
    return { success: true, id, dateStr, totalSchemas: allSchemas.length, totalRecords: allRecords.length, fileSizeBytes };
  } catch (err) {
    console.error("[Database Backup] Error during backup execution:", err);
    throw err;
  }
}

// Automated Daily Backup Schedule Checker
async function checkAndRunDailyBackup() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    let hasTodayBackup = false;

    try {
      const existing = await sql`
        SELECT id FROM database_backups 
        WHERE date_str = ${todayStr} AND backup_type = 'AUTOMATIC_DAILY' AND status = 'SUCCESS'
        LIMIT 1
      `;
      if (existing && existing.length > 0) {
        hasTodayBackup = true;
      }
    } catch (dbErr) {
      const cache = loadFallbackData();
      hasTodayBackup = !!(cache.backups || []).find(b => b.dateStr === todayStr && b.backupType === 'AUTOMATIC_DAILY');
    }

    if (!hasTodayBackup) {
      console.log(`[Auto Backup] No automated daily backup found for ${todayStr}. Executing automatic backup...`);
      await executeDatabaseBackup('AUTOMATIC_DAILY');
    }
  } catch (err) {
    console.error("[Auto Backup] Error during daily backup verification:", err);
  }
}

// Check on startup after 10 seconds, then every 30 minutes
setTimeout(() => {
  checkAndRunDailyBackup();
}, 10000);
setInterval(() => {
  checkAndRunDailyBackup();
}, 30 * 60 * 1000);

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

    // Update Cache
    const cache = loadFallbackData();
    cache.users = cache.users.filter(u => u.id !== id);
    saveFallbackData(cache);

    res.json({ success: true, fallback: !dbSuccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Report Schemas
app.get("/api/schemas", async (req, res) => {
  try {
    let allSchemas;
    try {
      allSchemas = await sql`
        SELECT id, name, fields
        FROM report_schemas
        ORDER BY name ASC
      `;
      // Ensure fields is parsed if string
      allSchemas = allSchemas.map(s => ({
        ...s,
        fields: typeof s.fields === 'string' ? JSON.parse(s.fields) : s.fields
      }));
    } catch (dbErr) {
      // Secondary schema load
      const cache = loadFallbackData();
      allSchemas = cache.schemas;
    }

    // If no schemas exist, return empty array
    res.json(allSchemas || []);
  } catch (err) {
    console.error("Error fetching schemas:", err);
    res.status(500).json({ error: "Failed to fetch report schemas" });
  }
});

app.post("/api/schemas", async (req, res) => {
  try {
    const { id, name, fields } = req.body;
    if (!id || !name || !fields) {
      return res.status(400).json({ error: "Missing required schema fields" });
    }

    let dbSuccess = false;
    try {
      const fieldsJson = JSON.stringify(fields);
      await sql`
        INSERT INTO report_schemas (id, name, fields)
        VALUES (${id}, ${name}, ${fieldsJson}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          fields = EXCLUDED.fields
      `;
      dbSuccess = true;
    } catch (dbErr) {
      console.warn("Direct DB schema write failed, updating fallback cache", dbErr);
    }

    // Update Fallback Cache
    const cache = loadFallbackData();
    const existingIndex = cache.schemas.findIndex(s => s.id === id);
    const schemaToSave = { id, name, fields };
    if (existingIndex >= 0) {
      cache.schemas[existingIndex] = schemaToSave;
    } else {
      cache.schemas.push(schemaToSave);
    }
    saveFallbackData(cache);

    res.json({ success: true, fallback: !dbSuccess });
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
      await sql`DELETE FROM report_schemas WHERE id = ${id}`;
      dbSuccess = true;
    } catch (dbErr) {
      // Secondary schema delete executed
    }

    // Update Fallback Cache
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

// Records Management
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
    if (!newRecord || !newRecord.id) {
      return res.status(400).json({ error: "Invalid record: ID is required" });
    }
    const rId = newRecord.reportId || 'default';

    let dbSuccess = false;
    try {
      const dataJson = JSON.stringify(newRecord.data || {});
      await sql`
        INSERT INTO dynamic_records (id, report_id, data)
        VALUES (${newRecord.id}, ${rId}, ${dataJson}::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          data = dynamic_records.data || EXCLUDED.data,
          report_id = CASE
            WHEN dynamic_records.report_id IS NOT NULL 
                 AND dynamic_records.report_id != 'default' 
                 AND dynamic_records.report_id != '1' 
                 AND (EXCLUDED.report_id = 'default' OR EXCLUDED.report_id = '1')
            THEN dynamic_records.report_id
            ELSE EXCLUDED.report_id
          END
      `;
      dbSuccess = true;
    } catch (dbErr) {
      console.warn("Direct DB write failed, updating fallback cache", dbErr);
    }

    // Update Fallback Cache with field merging and safe reportId preservation
    const cache = loadFallbackData();
    const existingIndex = cache.records.findIndex(r => r.id === newRecord.id);
    let recordToSave;
    if (existingIndex >= 0) {
      const existing = cache.records[existingIndex];
      const safeReportId = (existing.reportId && existing.reportId !== 'default' && existing.reportId !== '1' && (rId === 'default' || rId === '1'))
        ? existing.reportId
        : rId;
      recordToSave = {
        id: newRecord.id,
        reportId: safeReportId,
        data: { ...existing.data, ...(newRecord.data || {}) }
      };
      cache.records[existingIndex] = recordToSave;
    } else {
      recordToSave = { id: newRecord.id, reportId: rId, data: newRecord.data || {} };
      cache.records.push(recordToSave);
    }
    saveFallbackData(cache);

    // Auto-log tratativa if operator info or updated field was passed
    if (newRecord.username || newRecord.data) {
      const clientName = newRecord.data?.nome || newRecord.data?.NOME || newRecord.clientName || '';
      const clientCpf = newRecord.data?.cpf || newRecord.data?.CPF || newRecord.clientCpf || '';
      const actionType = newRecord.data?.status || newRecord.data?.Status ? 'STATUS_CHANGE' : 
                         newRecord.data?.observacaoFinal || newRecord.data?.['Observação final'] ? 'OBSERVACAO_CHANGE' : 'EDICAO';
      
      logTratativa({
        username: newRecord.username || 'Operador',
        userRole: newRecord.userRole || 'editor',
        reportId: rId,
        recordId: newRecord.id,
        clientName,
        clientCpf,
        actionType,
        details: { changes: newRecord.data || {} }
      }).catch(e => console.warn("Log tratativa error:", e));
    }

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
    const { ids, updatedData, username, userRole, reportId } = req.body;
    
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
      const idsSet = new Set(ids);
      cache.records = cache.records.map(r => {
        if (idsSet.has(r.id)) {
          return { ...r, data: { ...r.data, ...updatedData } };
        }
        return r;
      });
      saveFallbackData(cache);

      // Log bulk tratativas
      if (username) {
        logTratativa({
          username,
          userRole: userRole || 'editor',
          reportId: reportId || 'default',
          recordId: ids[0],
          clientName: `${ids.length} clientes atualizados em massa`,
          actionType: 'BULK_UPDATE',
          details: { updatedCount: ids.length, changes: updatedData }
        }).catch(e => console.warn(e));
      }
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

// ==========================================
// TRATATIVAS & AUDIT LOGS ENDPOINTS
// ==========================================

app.post("/api/tratativas", async (req, res) => {
  try {
    const { username, userRole, reportId, recordId, clientName, clientCpf, actionType, details } = req.body;
    const log = await logTratativa({
      username,
      userRole,
      reportId,
      recordId,
      clientName,
      clientCpf,
      actionType,
      details
    });
    res.json({ success: true, log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log tratativa" });
  }
});

app.get("/api/tratativas", async (req, res) => {
  try {
    const { date, username, reportId, limit = 200 } = req.query;
    let logs: any[] = [];
    
    try {
      if (date && username) {
        logs = await sql`
          SELECT id, created_at as "createdAt", date_str as "dateStr", username, user_role as "userRole", report_id as "reportId", record_id as "recordId", client_name as "clientName", client_cpf as "clientCpf", action_type as "actionType", details
          FROM audit_tratativas
          WHERE date_str = ${String(date)} AND username = ${String(username)}
          ORDER BY created_at DESC
          LIMIT ${Number(limit)}
        `;
      } else if (date) {
        logs = await sql`
          SELECT id, created_at as "createdAt", date_str as "dateStr", username, user_role as "userRole", report_id as "reportId", record_id as "recordId", client_name as "clientName", client_cpf as "clientCpf", action_type as "actionType", details
          FROM audit_tratativas
          WHERE date_str = ${String(date)}
          ORDER BY created_at DESC
          LIMIT ${Number(limit)}
        `;
      } else if (username) {
        logs = await sql`
          SELECT id, created_at as "createdAt", date_str as "dateStr", username, user_role as "userRole", report_id as "reportId", record_id as "recordId", client_name as "clientName", client_cpf as "clientCpf", action_type as "actionType", details
          FROM audit_tratativas
          WHERE username = ${String(username)}
          ORDER BY created_at DESC
          LIMIT ${Number(limit)}
        `;
      } else {
        logs = await sql`
          SELECT id, created_at as "createdAt", date_str as "dateStr", username, user_role as "userRole", report_id as "reportId", record_id as "recordId", client_name as "clientName", client_cpf as "clientCpf", action_type as "actionType", details
          FROM audit_tratativas
          ORDER BY created_at DESC
          LIMIT ${Number(limit)}
        `;
      }
    } catch (dbErr) {
      const cache = loadFallbackData();
      logs = (cache.tratativas || []);
      if (date) logs = logs.filter(l => l.dateStr === date);
      if (username) logs = logs.filter(l => l.username === username);
      logs = logs.slice(0, Number(limit));
    }

    res.json(logs);
  } catch (err) {
    console.error("Error in /api/tratativas:", err);
    res.status(500).json({ error: "Failed to fetch tratativas" });
  }
});

app.get("/api/tratativas/stats", async (req, res) => {
  try {
    const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
    
    let allUsers: any[] = [];
    let dayLogs: any[] = [];
    let schemas: any[] = [];

    try {
      [allUsers, dayLogs, schemas] = await Promise.all([
        sql`SELECT id, username, role FROM users`,
        sql`
          SELECT id, created_at as "createdAt", date_str as "dateStr", username, user_role as "userRole", report_id as "reportId", record_id as "recordId", client_name as "clientName", client_cpf as "clientCpf", action_type as "actionType", details
          FROM audit_tratativas
          WHERE date_str = ${targetDate}
          ORDER BY created_at ASC
        `,
        sql`SELECT id, name FROM report_schemas`
      ]);
    } catch (dbErr) {
      const cache = loadFallbackData();
      allUsers = cache.users || [];
      dayLogs = (cache.tratativas || []).filter(l => l.dateStr === targetDate);
      schemas = cache.schemas || [];
    }

    const schemaNameMap = new Map<string, string>();
    (schemas || []).forEach(s => schemaNameMap.set(s.id, s.name));

    // Aggregate user stats
    const userStatsMap = new Map<string, {
      username: string;
      userRole: string;
      totalTratativas: number;
      comSucesso: number;
      semSucesso: number;
      semResposta: number;
      outras: number;
      lastActivityTime?: string;
      reportsWorked: Set<string>;
    }>();

    // Initialize all existing users
    allUsers.forEach(u => {
      userStatsMap.set(u.username, {
        username: u.username,
        userRole: u.role,
        totalTratativas: 0,
        comSucesso: 0,
        semSucesso: 0,
        semResposta: 0,
        outras: 0,
        reportsWorked: new Set()
      });
    });

    let comSucessoToday = 0;
    let semSucessoToday = 0;
    let semRespostaToday = 0;

    const hourlyMap = new Map<string, number>();
    for (let h = 7; h <= 20; h++) {
      const hourStr = `${h.toString().padStart(2, '0')}:00`;
      hourlyMap.set(hourStr, 0);
    }

    const baseMap = new Map<string, number>();

    dayLogs.forEach((log: any) => {
      let stat = userStatsMap.get(log.username);
      if (!stat) {
        stat = {
          username: log.username,
          userRole: log.userRole || 'editor',
          totalTratativas: 0,
          comSucesso: 0,
          semSucesso: 0,
          semResposta: 0,
          outras: 0,
          reportsWorked: new Set()
        };
        userStatsMap.set(log.username, stat);
      }

      stat.totalTratativas++;
      stat.lastActivityTime = log.createdAt;
      if (log.reportId) {
        stat.reportsWorked.add(schemaNameMap.get(log.reportId) || log.reportId);
      }

      // Check status outcome
      const details = log.details || {};
      const changes = details.changes || {};
      const newStatus = (changes.status || changes.Status || details.newValue || '').toLowerCase();
      const newObs = (changes.observacaoFinal || changes['Observação final'] || '').toLowerCase();

      if (newStatus.includes('sucesso') && !newStatus.includes('sem')) {
        stat.comSucesso++;
        comSucessoToday++;
      } else if (newStatus.includes('sem sucesso') || newObs.includes('contato sem sucesso')) {
        stat.semSucesso++;
        semSucessoToday++;
      } else if (newStatus.includes('sem resposta') || newObs.includes('pendente')) {
        stat.semResposta++;
        semRespostaToday++;
      } else {
        stat.outras++;
      }

      // Hourly grouping
      try {
        const logDate = new Date(log.createdAt);
        const hour = logDate.getHours();
        const hourStr = `${hour.toString().padStart(2, '0')}:00`;
        hourlyMap.set(hourStr, (hourlyMap.get(hourStr) || 0) + 1);
      } catch (e) {}

      // Base grouping
      const rId = log.reportId || 'default';
      baseMap.set(rId, (baseMap.get(rId) || 0) + 1);
    });

    const userStats = Array.from(userStatsMap.values()).map(u => ({
      ...u,
      reportsWorked: Array.from(u.reportsWorked)
    })).sort((a, b) => b.totalTratativas - a.totalTratativas);

    const hourlyDistribution = Array.from(hourlyMap.entries()).map(([hour, count]) => ({ hour, count }));
    const baseDistribution = Array.from(baseMap.entries()).map(([reportId, count]) => ({
      reportId,
      reportName: schemaNameMap.get(reportId) || reportId,
      count
    }));

    const activeUsersCount = userStats.filter(u => u.totalTratativas > 0).length;

    res.json({
      date: targetDate,
      totalToday: dayLogs.length,
      comSucessoToday,
      semSucessoToday,
      semRespostaToday,
      activeUsersCount,
      userStats,
      hourlyDistribution,
      baseDistribution
    });
  } catch (err) {
    console.error("Error in /api/tratativas/stats:", err);
    res.status(500).json({ error: "Failed to calculate tratativas stats" });
  }
});

// ==========================================
// BACKUP MANAGEMENT ENDPOINTS
// ==========================================

app.get("/api/backups", async (req, res) => {
  try {
    let backupsList: any[] = [];
    try {
      backupsList = await sql`
        SELECT id, created_at as "createdAt", date_str as "dateStr", backup_type as "backupType", 
               total_schemas as "totalSchemas", total_records as "totalRecords", 
               file_size_bytes as "fileSizeBytes", schemas_summary as "schemasSummary", status
        FROM database_backups
        ORDER BY created_at DESC
        LIMIT 50
      `;
    } catch (dbErr) {
      const cache = loadFallbackData();
      backupsList = (cache.backups || []);
    }
    res.json(backupsList);
  } catch (err) {
    console.error("Error fetching backups:", err);
    res.status(500).json({ error: "Failed to fetch backups" });
  }
});

app.post("/api/backups/create", async (req, res) => {
  try {
    const result = await executeDatabaseBackup('MANUAL');
    res.json(result);
  } catch (err) {
    console.error("Error creating backup:", err);
    res.status(500).json({ error: "Failed to create manual backup" });
  }
});

app.get("/api/backups/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    let snapshot: any = null;

    try {
      const rows = await sql`SELECT snapshot_data as "snapshotData", date_str as "dateStr" FROM database_backups WHERE id = ${id}`;
      if (rows && rows.length > 0) {
        snapshot = rows[0].snapshotData;
      }
    } catch (dbErr) {}

    if (!snapshot) {
      return res.status(404).json({ error: "Backup snapshot not found" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="backup_${id}.json"`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});

// Consolidated Multi-Sheet Excel for Live Database (All Bases)
app.get("/api/export/all-bases.xlsx", async (req, res) => {
  try {
    let schemas: any[] = [];
    let records: any[] = [];

    try {
      [schemas, records] = await Promise.all([
        sql`SELECT id, name, fields FROM report_schemas`,
        sql`SELECT id, report_id as "reportId", data FROM dynamic_records`
      ]);
    } catch (dbErr) {
      const cache = loadFallbackData();
      schemas = cache.schemas || [];
      records = cache.records || [];
    }

    const wb = xlsx.utils.book_new();

    (schemas || []).forEach((schema: any, idx: number) => {
      let fields = schema.fields;
      if (typeof fields === "string") fields = JSON.parse(fields);

      const schemaRecords = records.filter(r => r.reportId === schema.id || r.report_id === schema.id);

      const rows = schemaRecords.map(r => {
        const d = r.data || {};
        const isFin = d.finalizada === "true" || d.finalizada === true || d.observacaoFinal === "Proposta finalizada/paga" || d["Observação final"] === "Proposta finalizada/paga";
        const rowObj: Record<string, any> = {
          "Status Proposta": isFin ? "Finalizada" : "Aberta"
        };
        (fields || []).forEach((f: any) => {
          let val = d[f.id];
          if (val === undefined || val === null || val === "") {
            val = d[f.label] !== undefined ? d[f.label] : "";
          }
          if (f.id === "status" && !val) val = d.Status || "";
          if (f.id === "observacaoFinal" && !val) val = d["Observação final"] || "";
          rowObj[f.label || f.id] = val ?? "";
        });
        return rowObj;
      });

      const cleanSheetName = (schema.name || `Base_${idx + 1}`).replace(/[*?:/\\\[\]]/g, '').substring(0, 31);
      const ws = xlsx.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Aviso": "Nenhum registro nesta base" }]);
      xlsx.utils.book_append_sheet(wb, ws, cleanSheetName);
    });

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().split('T')[0];

    res.setHeader("Content-Disposition", `attachment; filename="backup_todas_as_bases_${today}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("Export all bases error:", err);
    res.status(500).json({ error: "Failed to export all bases to Excel" });
  }
});

// Download Multi-Sheet Excel for a specific backup snapshot
app.get("/api/backups/:id/download-xlsx", async (req, res) => {
  try {
    const { id } = req.params;
    let snapshot: any = null;

    try {
      const rows = await sql`SELECT snapshot_data as "snapshotData" FROM database_backups WHERE id = ${id}`;
      if (rows && rows.length > 0) {
        snapshot = rows[0].snapshotData;
      }
    } catch (dbErr) {}

    if (!snapshot) {
      return res.status(404).json({ error: "Backup not found" });
    }

    const schemas = snapshot.schemas || [];
    const records = snapshot.records || [];

    const wb = xlsx.utils.book_new();

    schemas.forEach((schema: any, idx: number) => {
      let fields = schema.fields;
      if (typeof fields === "string") fields = JSON.parse(fields);

      const schemaRecords = records.filter((r: any) => r.reportId === schema.id || r.report_id === schema.id);

      const rows = schemaRecords.map((r: any) => {
        const d = r.data || {};
        const isFin = d.finalizada === "true" || d.finalizada === true || d.observacaoFinal === "Proposta finalizada/paga" || d["Observação final"] === "Proposta finalizada/paga";
        const rowObj: Record<string, any> = {
          "Status Proposta": isFin ? "Finalizada" : "Aberta"
        };
        (fields || []).forEach((f: any) => {
          let val = d[f.id];
          if (val === undefined || val === null || val === "") {
            val = d[f.label] !== undefined ? d[f.label] : "";
          }
          if (f.id === "status" && !val) val = d.Status || "";
          if (f.id === "observacaoFinal" && !val) val = d["Observação final"] || "";
          rowObj[f.label || f.id] = val ?? "";
        });
        return rowObj;
      });

      const cleanSheetName = (schema.name || `Base_${idx + 1}`).replace(/[*?:/\\\[\]]/g, '').substring(0, 31);
      const ws = xlsx.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Aviso": "Nenhum registro" }]);
      xlsx.utils.book_append_sheet(wb, ws, cleanSheetName);
    });

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", `attachment; filename="backup_${id}.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Excel export failed" });
  }
});

// Restore backup endpoint (admin)
app.post("/api/backups/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;
    let snapshot: any = null;

    try {
      const rows = await sql`SELECT snapshot_data as "snapshotData" FROM database_backups WHERE id = ${id}`;
      if (rows && rows.length > 0) {
        snapshot = rows[0].snapshotData;
      }
    } catch (dbErr) {}

    if (!snapshot) {
      return res.status(404).json({ error: "Backup not found" });
    }

    const { schemas, records } = snapshot;

    // Restore schemas
    if (schemas && Array.isArray(schemas)) {
      for (const s of schemas) {
        const fieldsJson = JSON.stringify(s.fields || []);
        await sql`
          INSERT INTO report_schemas (id, name, fields)
          VALUES (${s.id}, ${s.name}, ${fieldsJson}::jsonb)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, fields = EXCLUDED.fields
        `;
      }
    }

    // Restore records
    if (records && Array.isArray(records)) {
      const chunkSize = 2000;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const rowsToInsert = chunk.map((r: any) => ({
          id: r.id,
          report_id: r.reportId || r.report_id || 'default',
          data: r.data || {}
        }));
        const jsonPayload = JSON.stringify(rowsToInsert);
        await sql`
          INSERT INTO dynamic_records (id, report_id, data)
          SELECT
            (x->>'id')::text,
            (x->>'report_id')::text,
            (x->'data')::jsonb
          FROM jsonb_array_elements(${jsonPayload}::jsonb) AS x
          ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, report_id = EXCLUDED.report_id
        `;
      }
    }

    // Update Cache
    const cache = loadFallbackData();
    cache.schemas = schemas;
    cache.records = records;
    saveFallbackData(cache);

    res.json({ success: true, restoredSchemas: schemas.length, restoredRecords: records.length });
  } catch (err) {
    console.error("Restore failed:", err);
    res.status(500).json({ error: "Restore failed" });
  }
});

// Direct Download Endpoints for Base Ativa - Pend. e Aband.
app.get("/api/export/base-pend-aband.xlsx", async (req, res) => {
  try {
    const xlsxPath = path.join(process.cwd(), "public", "base_ativa_pend_e_aband_atualizada.xlsx");
    if (fs.existsSync(xlsxPath)) {
      res.setHeader("Content-Disposition", "attachment; filename=\"base_ativa_pend_e_aband_atualizada.xlsx\"");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.sendFile(xlsxPath);
    }
    res.status(404).json({ error: "File not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Export failed" });
  }
});

app.get("/api/export/base-pend-aband.csv", async (req, res) => {
  try {
    const csvPath = path.join(process.cwd(), "public", "base_ativa_pend_e_aband_atualizada.csv");
    if (fs.existsSync(csvPath)) {
      res.setHeader("Content-Disposition", "attachment; filename=\"base_ativa_pend_e_aband_atualizada.csv\"");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.sendFile(csvPath);
    }
    res.status(404).json({ error: "File not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Export failed" });
  }
});

export default app;
