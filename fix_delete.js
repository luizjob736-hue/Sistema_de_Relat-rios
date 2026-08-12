const fs = require('fs');
let code = fs.readFileSync('api/index.ts', 'utf8');
code = code.replace(
  /await db\.delete\(dynamicRecords\)\.where\(eq\(dynamicRecords\.reportId, reportId\)\);/g,
  "await sql`DELETE FROM dynamic_records WHERE report_id = ${reportId}`; "
);
fs.writeFileSync('api/index.ts', code);
