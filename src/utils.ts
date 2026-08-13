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
        _order: String(i),
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

export const normalizeHeader = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

// Parses CSV into Dynamic Records matching the active Report Schema
export const parseDynamicCSV = (csvText: string, schema: ReportSchema): DynamicRecord[] => {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) return [];

  let separator = ";";
  if (lines[0] && lines[0].includes(",") && !lines[0].includes(";")) {
    separator = ",";
  }

  // Parse header
  let headerCols = lines[0].split(separator).map(c => cleanColumn(c));
  
  // Remove trailing empty column if CSV ends with trailing delimiter
  while (headerCols.length > 0 && !headerCols[headerCols.length - 1]) {
    headerCols.pop();
  }

  const expectedFields = schema?.fields || [];
  if (expectedFields.length === 0) return [];

  // Map each expected field to a column index in the uploaded CSV
  // Strategy:
  // 1. Try matching by column header title/label (case-insensitive & accent-insensitive)
  // 2. If title matching fails, fallback to positional index (excluding trailing fixed columns like Status/Observação if missing)
  const normHeaderCols = headerCols.map(c => normalizeHeader(c));

  // Build field mapping array: for each schema field, find CSV column index or -1
  const fieldToColIndexMap: number[] = expectedFields.map((field, fIdx) => {
    const normLabel = normalizeHeader(field.label || "");
    const normId = normalizeHeader(field.id || "");

    // 1. Look for exact label or ID match in CSV headers
    let matchIdx = normHeaderCols.findIndex(
      h => h === normLabel || h === normId || (normLabel && h && (h.includes(normLabel) || normLabel.includes(h)))
    );

    // Special alias matching for common Portuguese column names
    if (matchIdx === -1) {
      if (normLabel.includes("observa") || normId.includes("observa")) {
        matchIdx = normHeaderCols.findIndex(h => h.includes("obs") || h.includes("observa"));
      } else if (normLabel === "status" || normId === "status") {
        matchIdx = normHeaderCols.findIndex(h => h === "status" || h.includes("stat"));
      } else if (normLabel === "base" || normId === "nomebase") {
        matchIdx = normHeaderCols.findIndex(h => h.includes("base"));
      } else if (normLabel.includes("solicitado") || normId.includes("valorsolicitado")) {
        matchIdx = normHeaderCols.findIndex(h => h.includes("solicitad"));
      } else if (normLabel.includes("liberado") || normId.includes("valorliberado")) {
        matchIdx = normHeaderCols.findIndex(h => h.includes("liberad"));
      } else if (normLabel.includes("tentativa") || normId.includes("tentativa")) {
        matchIdx = normHeaderCols.findIndex(h => h.includes("tentativ"));
      }
    }

    // 2. Positional fallback if CSV header matches standard column count
    if (matchIdx === -1) {
      // Check if CSV column at index fIdx exists
      if (fIdx < headerCols.length) {
        matchIdx = fIdx;
      }
    }

    return matchIdx;
  });

  const records: DynamicRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = line.split(separator);
    const data: Record<string, string> = {};
    
    // Initialize default values for all expected fields
    expectedFields.forEach(f => {
      if (f && f.id) {
        data[f.id] = (f.type === 'list' && f.options && f.options.length > 0) ? (f.options.includes("-") ? "-" : f.options[0]) : "-";
      }
    });

    // Populate data with values from mapped CSV columns
    expectedFields.forEach((field, fIdx) => {
      if (!field || !field.id) return;

      const csvColIdx = fieldToColIndexMap[fIdx];
      let cleaned = (csvColIdx !== undefined && csvColIdx >= 0 && cols[csvColIdx] !== undefined)
        ? cleanColumn(cols[csvColIdx])
        : "";
      
      const fId = field.id ? field.id.toLowerCase() : "";
      const fLabel = field.label ? field.label.toLowerCase() : "";

      // Normalize Attempt 1 Date/Time if applicable
      if (fId.includes("tentativa") || fLabel.includes("tentativa")) {
        cleaned = normalizeDateTime(cleaned);
      } else if (field.type === 'list' && field.options) {
        // Normalize if matches predefined option case-insensitively
        const matchedOpt = field.options.find(o => o && cleaned && o.toLowerCase() === cleaned.toLowerCase().trim());
        if (matchedOpt) {
          cleaned = matchedOpt;
        }
      }

      if (!cleaned || cleaned.trim() === "") {
        cleaned = "-";
      }

      data[field.id] = cleaned;
    });

    // Keep _order tracking for fixed position ordering
    data._order = String(i);

    // Skip line if all fields are empty or defaults (ignoring metadata keys like _order)
    const isAllEmpty = Object.keys(data)
      .filter(k => k !== '_order')
      .every(k => data[k] === "-" || data[k] === "");
      
    if (isAllEmpty) {
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
