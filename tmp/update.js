const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../src/rawCsvData.ts');
const csvPath = path.join(__dirname, 'attachment.csv');

if (!fs.existsSync(csvPath)) {
  console.error("CSV file not found");
  process.exit(1);
}

// Read raw data
let rawTs = fs.readFileSync(srcPath, 'utf8');
const attachmentText = fs.readFileSync(csvPath, 'utf8');

// Parse raw TS data
const tsMatch = rawTs.match(/export const rawCsvData = `([\s\S]+?)`;/);
if (!tsMatch) {
  console.error("Could not find rawCsvData in rawCsvData.ts");
  process.exit(1);
}

const tsLines = tsMatch[1].trim().split('\n');
const tsHeaders = tsLines[0].split(';');

// Map header indexes for TS
const tsHeaderIdx = {};
tsHeaders.forEach((h, i) => {
  tsHeaderIdx[h.trim()] = i;
});

// Parse attachment CSV rows
const attachLines = attachmentText.trim().split('\n');
const attachHeaders = attachLines[0].split(';');

const attachHeaderIdx = {};
attachHeaders.forEach((h, i) => {
  attachHeaderIdx[h.trim()] = i;
});

// Map of normalized CPF -> updated fields
const updatesMap = new Map();

for (let i = 1; i < attachLines.length; i++) {
  const line = attachLines[i].trim();
  if (!line) continue;
  const cols = line.split(';');
  
  const nome = cols[attachHeaderIdx['Nome']] || '';
  const cpf = (cols[attachHeaderIdx['CPF']] || '').trim().replace(/\D/g, '');
  const tentativa = cols[attachHeaderIdx['Tentativa 1']] || '';
  const status = cols[attachHeaderIdx['Status']] || '';
  const obs = cols[attachHeaderIdx['Observação final']] || '';
  
  if (cpf) {
    updatesMap.set(cpf, { tentativa, status, obs, nome });
  } else if (nome) {
    const normNome = nome.toUpperCase().trim();
    updatesMap.set(normNome, { tentativa, status, obs, nome });
  }
}

// Update TS lines
const updatedTsLines = tsLines.map((line, idx) => {
  if (idx === 0) return line;
  const cols = line.split(';');
  if (cols.length < 5) return line;
  
  const cpf = (cols[tsHeaderIdx['CPF']] || '').trim().replace(/\D/g, '');
  const nome = (cols[tsHeaderIdx['Nome']] || '').toUpperCase().trim();
  
  let update = updatesMap.get(cpf) || updatesMap.get(nome);
  if (update) {
    // Keep cadastral, but update editable fields
    if (update.tentativa && update.tentativa !== '—' && update.tentativa !== '-') {
      cols[tsHeaderIdx['Tentativa 1']] = update.tentativa.trim();
    }
    if (update.status && update.status !== '—' && update.status !== '-') {
      cols[tsHeaderIdx['Status']] = update.status.trim();
    }
    if (update.obs && update.obs !== '—' && update.obs !== '-') {
      cols[tsHeaderIdx['Observação final']] = update.obs.trim();
    }
  }
  
  return cols.join(';');
});

const newRawCsvData = updatedTsLines.join('\n');
const newTsContent = rawTs.replace(/export const rawCsvData = `([\s\S]+?)`;/, `export const rawCsvData = \`\n${newRawCsvData}\n\`;`);

fs.writeFileSync(srcPath, newTsContent, 'utf8');
console.log("Successfully matched and updated rawCsvData.ts!");
