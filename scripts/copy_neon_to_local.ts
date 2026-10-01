import postgres from "postgres";
import fs from "fs";
import path from "path";

// 1. Connection string setup
let connectionString = process.env.DATABASE_URL || "";
if (!connectionString.startsWith("postgres")) {
  connectionString = "postgresql://neondb_owner:npg_EUvOxA3yk1za@ep-little-cell-ac1uvd3q-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
}

const sql = postgres(connectionString);

async function copyNeonToLocal() {
  console.log("==========================================");
  console.log("🚀 COPIANDO DADOS DO BANCO NEON PARA BANCO LOCAL");
  console.log("==========================================");
  console.log(`📡 Conectando ao Neon PostgreSQL...`);

  try {
    // Fetch all tables from Neon
    console.log("📦 Extraindo tabela 'users'...");
    const users = await sql`SELECT id, username, password, role, is_blocked as "isBlocked", blocked_guides as "blockedGuides", allowed_guides as "allowedGuides" FROM users`;

    console.log("📦 Extraindo tabela 'report_schemas'...");
    const schemas = await sql`SELECT id, name, fields, is_locked as "isLocked", status_configs as "statusConfigs", global_sort_config as "globalSortConfig" FROM report_schemas`;

    console.log("📦 Extraindo tabela 'dynamic_records'...");
    const records = await sql`SELECT id, report_id as "reportId", data FROM dynamic_records`;

    console.log("📦 Extraindo tabela 'audit_tratativas'...");
    const tratativas = await sql`SELECT id, created_at as "createdAt", date_str as "dateStr", username, user_role as "userRole", report_id as "reportId", record_id as "recordId", client_name as "clientName", client_cpf as "clientCpf", action_type as "actionType", details FROM audit_tratativas ORDER BY created_at DESC LIMIT 5000`;

    console.log("📦 Extraindo tabela 'database_backups'...");
    const backups = await sql`SELECT id, created_at as "createdAt", date_str as "dateStr", backup_type as "backupType", total_schemas as "totalSchemas", total_records as "totalRecords", file_size_bytes as "fileSizeBytes", schemas_summary as "schemasSummary", status FROM database_backups ORDER BY created_at DESC LIMIT 50`;

    console.log("\n📊 Resumo dos dados copiados do Neon:");
    console.log(` - Usuários: ${users.length}`);
    console.log(` - Bases (Schemas): ${schemas.length}`);
    console.log(` - Registros de Clientes: ${records.length}`);
    console.log(` - Histórico de Tratativas: ${tratativas.length}`);
    console.log(` - Snapshots de Backup: ${backups.length}`);

    // Create JSON local copy
    const snapshot = {
      copiedAt: new Date().toISOString(),
      source: "Neon PostgreSQL (sa-east-1)",
      summary: {
        usersCount: users.length,
        schemasCount: schemas.length,
        recordsCount: records.length,
        tratativasCount: tratativas.length,
        backupsCount: backups.length,
      },
      users,
      schemas,
      records,
      tratativas,
      backups
    };

    const localJsonPath = path.join(process.cwd(), "local_neon_copy.json");
    fs.writeFileSync(localJsonPath, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`\n✅ Arquivo JSON salvo em: ${localJsonPath}`);

    // Update local fallback cache
    const fallbackPath = path.join(process.cwd(), "db_fallback_cache.json");
    const fallbackData = {
      users,
      schemas,
      records,
      tratativas,
      backups
    };
    fs.writeFileSync(fallbackPath, JSON.stringify(fallbackData, null, 2), "utf-8");
    console.log(`✅ Cache local atualizado em: ${fallbackPath}`);

    // Generate local SQL dump file
    let sqlContent = `-- ==========================================\n`;
    sqlContent += `-- CÓPIA LOCAL DE DADOS DO BANCO NEON\n`;
    sqlContent += `-- Data da cópia: ${new Date().toLocaleString('pt-BR')}\n`;
    sqlContent += `-- ==========================================\n\n`;

    sqlContent += `CREATE TABLE IF NOT EXISTS report_schemas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fields JSONB NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  status_configs JSONB DEFAULT '[]'::jsonb,
  global_sort_config JSONB
);\n\n`;

    sqlContent += `CREATE TABLE IF NOT EXISTS dynamic_records (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES report_schemas(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);\n\n`;

    sqlContent += `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  is_blocked BOOLEAN DEFAULT false,
  blocked_guides JSONB DEFAULT '[]'::jsonb,
  allowed_guides JSONB DEFAULT '[]'::jsonb
);\n\n`;

    sqlContent += `CREATE TABLE IF NOT EXISTS audit_tratativas (
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
);\n\n`;

    // Insert statement helpers
    function escapeSqlStr(str: any) {
      if (str === null || str === undefined) return 'NULL';
      return `'${String(str).replace(/'/g, "''")}'`;
    }

    function escapeJsonStr(obj: any) {
      if (obj === null || obj === undefined) return `'{}'::jsonb`;
      const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
      return `'${json.replace(/'/g, "''")}'::jsonb`;
    }

    // Insert Users
    users.forEach(u => {
      sqlContent += `INSERT INTO users (id, username, password, role, is_blocked, blocked_guides, allowed_guides) VALUES (${escapeSqlStr(u.id)}, ${escapeSqlStr(u.username)}, ${escapeSqlStr(u.password)}, ${escapeSqlStr(u.role)}, ${u.isBlocked ? 'true' : 'false'}, ${escapeJsonStr(u.blockedGuides || [])}, ${escapeJsonStr(u.allowedGuides || [])}) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password;\n`;
    });
    sqlContent += `\n`;

    // Insert Schemas
    schemas.forEach(s => {
      sqlContent += `INSERT INTO report_schemas (id, name, fields, is_locked, status_configs, global_sort_config) VALUES (${escapeSqlStr(s.id)}, ${escapeSqlStr(s.name)}, ${escapeJsonStr(s.fields)}, ${s.isLocked ? 'true' : 'false'}, ${escapeJsonStr(s.statusConfigs || [])}, ${escapeJsonStr(s.globalSortConfig || null)}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, fields = EXCLUDED.fields;\n`;
    });
    sqlContent += `\n`;

    // Insert Records
    records.forEach(r => {
      sqlContent += `INSERT INTO dynamic_records (id, report_id, data) VALUES (${escapeSqlStr(r.id)}, ${escapeSqlStr(r.reportId)}, ${escapeJsonStr(r.data)}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;\n`;
    });
    sqlContent += `\n`;

    const sqlDumpPath = path.join(process.cwd(), "local_neon_dump.sql");
    fs.writeFileSync(sqlDumpPath, sqlContent, "utf-8");
    console.log(`✅ Dump SQL local salvo em: ${sqlDumpPath}`);

    console.log("\n🎉 CÓPIA DO NEON PARA O BANCO LOCAL CONCLUÍDA COM SUCESSO!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erro ao copiar dados do Neon para o banco local:", error);
    process.exit(1);
  }
}

copyNeonToLocal();
