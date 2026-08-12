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
    await sql`
      INSERT INTO report_schemas (id, name, fields)
      VALUES ('1', 'Relatório Padrão', ${JSON.stringify(defaultSchemaFields)}::jsonb)
      ON CONFLICT (id) DO NOTHING
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
    await sql`
      INSERT INTO report_schemas (id, name, fields)
      VALUES (${newSchema.id}, ${newSchema.name}, ${JSON.stringify(newSchema.fields)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        fields = EXCLUDED.fields
    `;
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
