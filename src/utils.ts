import { rawCsvData } from "./rawCsvData";
import { DynamicRecord, ReportSchema, defaultSchema } from "./types";

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const cleanColumn = (col: string): string => {
  let s = col.trim();
  if (s.length >= 2 && s.charCodeAt(0) === 34 && s.charCodeAt(s.length - 1) === 34) {
    s = s.slice(1, -1).trim();
  }
  return s;
};

// Fallback bootstrap for backwards compatibility with rawCsvData
export const getFallbackRecords = (): DynamicRecord[] => {
  const records: DynamicRecord[] = [];
  const lines = rawCsvData.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(";");
    if (cols.length < 6) continue;
    
    records.push({
      id: `client-${i}-${generateId()}`,
      reportId: 'default',
      data: {
        nomeBase: '-',
        nome: cleanColumn(cols[0]) || "-",
        cpf: cleanColumn(cols[1]) || "-",
        email: cleanColumn(cols[2]) || "-",
        telefone: cleanColumn(cols[3]) || "-",
        valorSolicitado: cleanColumn(cols[4]) || "-",
        valorLiberado: cleanColumn(cols[5]) || "-",
        tentativa1: cleanColumn(cols[6] || "-"),
        status: cleanColumn(cols[7] || "-"),
        observacaoFinal: cleanColumn(cols[8] || "-")
      }
    });
  }
  return records;
};

export const normalizeDateTime = (raw: string): string => {
  let s = raw.trim();
  if (!s || s === "-" || s === "—" || s === "*") return "-";

  // Remove unwanted leading/trailing dashes, asterisks or other noise
  s = s.replace(/^[\-—*]+|[\-—*]+$/g, '').trim();
  
  const dateMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]?(\d{2,4}))?/);
  let day = "", month = "", year = "";
  if (dateMatch) {
    day = dateMatch[1].padStart(2, "0");
    month = dateMatch[2].padStart(2, "0");
    year = dateMatch[3] || "2026";
    if (year.length === 2) year = "20" + year;
  }

  // Normalize punctuation for time matching
  const sNoSpaces = s.replace(/\s*([:;h])\s*/gi, ":");
  const timeMatch = sNoSpaces.match(/(\d{1,2}):(\d{2})/i);
  let hours = "", minutes = "";
  if (timeMatch) {
    hours = timeMatch[1].padStart(2, "0");
    minutes = timeMatch[2].padStart(2, "0");
  }

  if (day && month) {
    let result = `${day}/${month}/${year}`;
    if (hours && minutes) {
      result += ` às ${hours}:${minutes}`;
    }
    return result;
  }

  return raw;
};

// Parses CSV into Dynamic Records matching the active Report Schema
export const parseDynamicCSV = (csvText: string, schema: ReportSchema): DynamicRecord[] => {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/);
  const records: DynamicRecord[] = [];

  if (lines.length === 0) return [];

  let separator = ";";
  if (lines[0] && lines[0].includes(",") && !lines[0].includes(";")) {
    separator = ",";
  }

  // Parse header
  const headerCols = lines[0].split(separator).map(c => cleanColumn(c).toLowerCase());
  
  // Create a mapping of colIndex -> fieldId
  const colToFieldMap: Record<number, string> = {};
  headerCols.forEach((header, index) => {
    // Exact or fuzzy match on label or id
    const matchedField = schema.fields.find(f => 
      f.label.toLowerCase() === header || f.id.toLowerCase() === header
    );
    if (matchedField) {
      colToFieldMap[index] = matchedField.id;
    }
  });

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = line.split(separator);
    const data: Record<string, string> = {};
    
    // Initialize defaults based on schema
    schema.fields.forEach(f => {
      data[f.id] = (f.type === 'list' && f.options && f.options.length > 0) ? (f.options.includes("-") ? "-" : f.options[0]) : (f.readOnly ? "-" : "-");
    });

    cols.forEach((col, index) => {
      const fieldId = colToFieldMap[index];
      if (fieldId) {
        let cleaned = cleanColumn(col);
        
        // Normalize Attempt 1 Date
        if (fieldId.toLowerCase().includes("tentativa")) {
          cleaned = normalizeDateTime(cleaned);
        } else {
          // Normalize list items (e.g. status, observacao final)
          const fieldDef = schema.fields.find(f => f.id === fieldId);
          if (fieldDef && fieldDef.type === 'list' && fieldDef.options) {
            const matchedOpt = fieldDef.options.find(o => o.toLowerCase() === cleaned.toLowerCase());
            if (matchedOpt) {
              cleaned = matchedOpt;
            } else if (cleaned.toLowerCase().includes('sucesso')) {
               if (cleaned.toLowerCase().includes('com')) cleaned = 'Com Sucesso';
               if (cleaned.toLowerCase().includes('sem')) cleaned = 'Sem Sucesso';
            } else if (cleaned.toLowerCase().includes('resposta')) {
               cleaned = 'Sem Resposta';
            }
          }
        }
        
        data[fieldId] = cleaned;
      }
    });

    // Skip if all fields are essentially empty (defaults)
    if (Object.values(data).every(val => val === "-" || val === "")) {
       continue;
    }

    records.push({
      id: `imported-${i}-${generateId()}`,
      reportId: schema.id,
      data
    });
  }
  
  return records;
};

// Exports Dynamic Records based on their Report Schema
export const exportDynamicCSV = (records: DynamicRecord[], schema: ReportSchema): string => {
  const headers = schema.fields.map(f => f.label).join(";");
  const rows = records.map(r => {
    return schema.fields.map(f => {
      const val = r.data[f.id] || "-";
      return val.includes(";") ? `"${val}"` : val;
    }).join(";");
  });
  return [headers, ...rows].join("\n");
};

export const formatCurrentDateTime = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
};
