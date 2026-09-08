import fs from "fs";
import postgres from "postgres";

const sql = postgres("postgresql://neondb_owner:npg_EUvOxA3yk1za@ep-little-cell-ac1uvd3q-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require", { max: 10 });

// Map of contractId -> boolean (true = Finalizada, false = Aberta)
async function run() {
  const schemas = await sql`SELECT id, name FROM report_schemas WHERE name ILIKE '%pend%' OR name ILIKE '%aband%'`;
  if (!schemas.length) {
    console.error("Schema not found");
    process.exit(1);
  }
  const reportId = schemas[0].id;
  console.log(`Found schema "${schemas[0].name}" (ID: ${reportId})`);

  // Read data from CSV file or input
  const csvText = fs.readFileSync("./status_update.csv", "utf8");
  const lines = csvText.split("\n");
  
  const statusMap = new Map(); // contractId -> "true" (Finalizada) | "false" (Aberta)
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(";");
    if (parts.length < 2) continue;
    
    const statusRaw = parts[0].trim().toLowerCase();
    const contractId = parts[1].trim();
    
    if (contractId && !isNaN(Number(contractId))) {
      const isFinalizada = (statusRaw === "finalizada" || statusRaw === "fechada" || statusRaw === "finalizado");
      statusMap.set(contractId, isFinalizada ? "true" : "false");
    }
  }

  console.log(`Parsed ${statusMap.size} contract status mappings.`);

  // Fetch all records for this schema
  const records = await sql`SELECT id, data FROM dynamic_records WHERE report_id = ${reportId}`;
  console.log(`Fetched ${records.length} records in database.`);

  let updatedCount = 0;
  let finalizadaCount = 0;
  let abertaCount = 0;

  const updates = [];

  for (const r of records) {
    let data = r.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch(e) {}
    }
    
    // Find contract ID in record data
    const contractId = data.idContrato || data["ID CONTRATO"] || data["Contrato"] || data["field_1786632065075"];
    
    if (contractId && statusMap.has(String(contractId).trim())) {
      const targetStatus = statusMap.get(String(contractId).trim());
      if (data.finalizada !== targetStatus) {
        data.finalizada = targetStatus;
        updates.push({ id: r.id, data });
        updatedCount++;
      }
      if (targetStatus === "true") finalizadaCount++;
      else abertaCount++;
    }
  }

  console.log(`Applying ${updates.length} updates...`);
  
  const chunkSize = 100;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map(u => 
      sql`UPDATE dynamic_records SET data = ${sql.json(u.data)} WHERE id = ${u.id}`
    ));
    process.stdout.write(".");
  }

  console.log(`\nSuccessfully updated ${updatedCount} records!`);
  console.log(`Total matched: ${finalizadaCount} Finalizadas, ${abertaCount} Abertas.`);

  // Verify final count in DB
  const allRecords = await sql`SELECT data FROM dynamic_records WHERE report_id = ${reportId}`;
  let totalFinal = 0;
  let totalAberta = 0;
  allRecords.forEach(r => {
    const d = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    if (d.finalizada === "true") totalFinal++;
    else totalAberta++;
  });
  console.log(`Database state now: ${totalFinal} Finalizadas, ${totalAberta} Abertas.`);

  process.exit(0);
}

run().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
