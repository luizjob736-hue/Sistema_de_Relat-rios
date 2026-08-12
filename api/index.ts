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

    // Ensure default schema exists in report_schemas
    const defaultSchemaFields = [
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

    await sql`
      INSERT INTO report_schemas (id, name, fields)
      VALUES ('default', 'Relatório Padrão', ${JSON.stringify(defaultSchemaFields)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
    
    // Clean up legacy schema '1' if present and migrate its records to 'default'
    try {
      await sql`UPDATE dynamic_records SET report_id = 'default' WHERE report_id = '1'`;
      await sql`DELETE FROM report_schemas WHERE id = '1'`;
    } catch (e) {}

    // Clean up any duplicate schemas in report_schemas table by name
    try {
      const existingSchemas = await sql`SELECT id, name FROM report_schemas`;
      const seenNames = new Map<string, string>(); // nameLower -> id
      for (const s of existingSchemas) {
        const norm = (s.name || "").trim().toLowerCase();
        if (!norm) continue;
        if (seenNames.has(norm)) {
          const keepId = seenNames.get(norm)!;
          const removeId = s.id;
          if (removeId !== keepId) {
            await sql`UPDATE dynamic_records SET report_id = ${keepId} WHERE report_id = ${removeId}`;
            await sql`DELETE FROM report_schemas WHERE id = ${removeId}`;
          }
        } else {
          seenNames.set(norm, s.id);
        }
      }
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

    // Check if a schema with this name already exists under another ID
    const existingByName = await sql`
      SELECT id FROM report_schemas WHERE LOWER(TRIM(name)) = ${normName}
    `;
    const targetId = existingByName.length > 0 ? existingByName[0].id : schemaId;

    await sql`
      INSERT INTO report_schemas (id, name, fields)
      VALUES (${targetId}, ${newSchema.name}, ${JSON.stringify(newSchema.fields || [])}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        fields = EXCLUDED.fields
    `;
    res.json({ success: true, id: targetId });
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
    const allRecords = await sql`
      SELECT id, report_id as "reportId", data
      FROM dynamic_records
    `;
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

    await sql`
      INSERT INTO report_schemas (id, name, fields)
      VALUES (${rId}, 'Relatório Padrão', '[]'::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;

    const dataJson = JSON.stringify(newRecord.data || {});
    await sql`
      INSERT INTO dynamic_records (id, report_id, data)
      VALUES (${newRecord.id}, ${rId}, ${dataJson}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        report_id = EXCLUDED.report_id
    `;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save record" });
  }
});

// Function to deduplicate records across all schemas/tabs keeping only the latest import
async function deduplicateRecordsInDb() {
  try {
    const schemas = await sql`SELECT * FROM report_schemas`;
    const schemaMap = new Map();
    schemas.forEach(s => schemaMap.set(s.id, s));

    const records = await sql`SELECT id, report_id, data FROM dynamic_records`;
    if (!records || records.length === 0) return { deletedCount: 0, keptCount: 0 };

    const cleanCpf = (val: any) => {
      if (!val || val === '-' || val === '—') return '';
      return String(val).replace(/\D/g, '');
    };

    const cleanName = (val: any) => {
      if (!val || val === '-' || val === '—') return '';
      return String(val).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    };

    function getRecordKeys(r: any) {
      const s = schemaMap.get(r.report_id) || schemaMap.get('default');
      const fields = s ? (s.fields || []) : [];
      let cpf = '';
      let name = '';
      let base = '';

      for (const [k, v] of Object.entries(r.data || {})) {
        if (!v || v === '-' || v === '—') continue;
        const f = fields.find((field: any) => field.id === k);
        const label = f ? (f.label || f.id) : k;
        const normLabel = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

        if (normLabel === 'cpf') {
          cpf = cleanCpf(v);
        } else if (normLabel === 'nome') {
          name = cleanName(v);
        } else if (normLabel === 'base' || normLabel === 'nomebase') {
          base = String(v);
        }
      }

      if (!cpf) {
        if (r.data.cpf) cpf = cleanCpf(r.data.cpf);
        else if (r.data.CPF) cpf = cleanCpf(r.data.CPF);
      }
      if (!name) {
        if (r.data.nome) name = cleanName(r.data.nome);
        else if (r.data.NOME) name = cleanName(r.data.NOME);
      }
      if (!base) {
        if (r.data.nomeBase) base = String(r.data.nomeBase);
        else if (r.data.Base) base = String(r.data.Base);
      }

      const isContatoAtivo = base.toLowerCase().includes('contato ativo');

      return { cpf, name, isContatoAtivo };
    }

    const recordInfos = records.map((r: any, idx: number) => {
      const { cpf, name, isContatoAtivo } = getRecordKeys(r);
      return { idx, id: r.id, report_id: r.report_id, cpf, name, isContatoAtivo };
    });

    const cpfGroups = new Map<string, any[]>();
    const nameGroups = new Map<string, any[]>();

    recordInfos.forEach((r: any) => {
      if (r.cpf && r.cpf.length >= 6) {
        if (!cpfGroups.has(r.cpf)) cpfGroups.set(r.cpf, []);
        cpfGroups.get(r.cpf)!.push(r);
      }
      if (r.name && r.name.length >= 3) {
        if (!nameGroups.has(r.name)) nameGroups.set(r.name, []);
        nameGroups.get(r.name)!.push(r);
      }
    });

    const deleteIds = new Set<string>();
    const recordScore = (r: any) => (r.isContatoAtivo ? 10000000 : 0) + r.idx;

    cpfGroups.forEach((group) => {
      if (group.length > 1) {
        group.sort((a, b) => recordScore(b) - recordScore(a));
        for (let i = 1; i < group.length; i++) {
          deleteIds.add(group[i].id);
        }
      }
    });

    nameGroups.forEach((group) => {
      const remaining = group.filter(r => !deleteIds.has(r.id));
      if (remaining.length > 1) {
        remaining.sort((a, b) => recordScore(b) - recordScore(a));
        for (let i = 1; i < remaining.length; i++) {
          deleteIds.add(remaining[i].id);
        }
      }
    });

    if (deleteIds.size > 0) {
      const deleteArray = Array.from(deleteIds);
      const chunkSize = 500;
      for (let i = 0; i < deleteArray.length; i += chunkSize) {
        const chunk = deleteArray.slice(i, i + chunkSize);
        await sql`DELETE FROM dynamic_records WHERE id = ANY(${chunk})`;
      }
      console.log(`[Deduplication] Deleted ${deleteArray.length} older duplicate records.`);
    }

    return { deletedCount: deleteIds.size, keptCount: records.length - deleteIds.size };
  } catch (err) {
    console.error("Deduplication error:", err);
    return { error: String(err) };
  }
}

app.post("/api/records/deduplicate", async (req, res) => {
  try {
    const result = await deduplicateRecordsInDb();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to deduplicate records" });
  }
});

app.post("/api/records/bulk", async (req, res) => {
  try {
    const { records, mode, reportId } = req.body;
    const targetReportId = reportId || (records && records[0]?.reportId) || 'default';
    
    if (mode === "overwrite") {
      if (targetReportId === 'default' || targetReportId === '1') {
        await sql`DELETE FROM dynamic_records WHERE report_id = 'default' OR report_id = '1' OR report_id = ${targetReportId}`;
      } else {
        await sql`DELETE FROM dynamic_records WHERE report_id = ${targetReportId}`;
      }
    }
    
    if (records && records.length > 0) {
      const reportIds = Array.from(new Set(records.map((r: any) => r.reportId || targetReportId)));
      for (const rId of reportIds) {
        await sql`
          INSERT INTO report_schemas (id, name, fields)
          VALUES (${rId as string}, 'Relatório Padrão', '[]'::jsonb)
          ON CONFLICT (id) DO NOTHING
        `;
      }

      const chunkSize = 500;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        await sql.begin(async (transaction) => {
          for (const rec of chunk) {
            const recReportId = rec.reportId || targetReportId;
            const dataJson = JSON.stringify(rec.data || {});
            await transaction`
              INSERT INTO dynamic_records (id, report_id, data)
              VALUES (${rec.id}, ${recReportId}, ${dataJson}::jsonb)
              ON CONFLICT (id) DO UPDATE SET
                data = EXCLUDED.data,
                report_id = EXCLUDED.report_id
            `;
          }
        });
      }

      // Automatically deduplicate to purge older versions of newly imported records across tabs
      await deduplicateRecordsInDb();
    }
    
    res.json({ success: true, count: records ? records.length : 0 });
  } catch (err) {
    console.error("Error in /api/records/bulk:", err);
    res.status(500).json({ error: "Failed to save records in bulk" });
  }
});

app.put("/api/records/bulk-update", async (req, res) => {
  try {
    const { ids, updatedData } = req.body;
    
    if (ids && ids.length > 0) {
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
    if (reportId === 'default' || reportId === '1') {
      await sql`DELETE FROM dynamic_records WHERE report_id = 'default' OR report_id = '1' OR report_id = ${reportId}`;
    } else {
      await db.delete(dynamicRecords).where(eq(dynamicRecords.reportId, reportId));
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear report records" });
  }
});

export default app;
