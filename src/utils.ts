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

export const normalizeCpf = (raw: string | undefined | null): string => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length >= 8 && digits !== "00000000000") {
    return digits.padStart(11, "0");
  }
  return "";
};

export const normalizeName = (raw: string | undefined | null): string => {
  if (!raw) return "";
  const s = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (s.length >= 2 && s !== "dado" && s !== "nome" && s !== "cliente" && s !== "semnome") {
    return s;
  }
  return "";
};

export const normalizeContract = (raw: string | undefined | null): string => {
  if (!raw) return "";
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (s && s !== "-" && s !== "—" && s !== "0" && s !== "null" && s !== "undefined") {
    return s;
  }
  return "";
};

export const getRecordIdentifiers = (recData: Record<string, string>, fields?: any[]) => {
  let rawCpf = "";
  let rawName = "";
  let rawContract = "";

  if (recData) {
    for (const [key, val] of Object.entries(recData)) {
      if (!val || val === "-" || val === "—") continue;
      const kNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      if (!rawCpf && kNorm.includes("cpf")) {
        rawCpf = val;
      }
      if (!rawContract && kNorm.includes("contrato")) {
        rawContract = val;
      }
      if (!rawName && (kNorm === "nome" || kNorm === "nomecliente" || (kNorm.includes("nome") && !kNorm.includes("base")))) {
        rawName = val;
      }
    }
  }

  if (fields && Array.isArray(fields)) {
    for (const field of fields) {
      if (!field || !field.id) continue;
      const val = recData ? recData[field.id] : "";
      if (!val || val === "-" || val === "—") continue;
      const labelNorm = (field.label || field.id || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      if (!rawCpf && labelNorm.includes("cpf")) {
        rawCpf = val;
      }
      if (!rawContract && labelNorm.includes("contrato")) {
        rawContract = val;
      }
      if (!rawName && labelNorm.includes("nome") && !labelNorm.includes("base")) {
        rawName = val;
      }
    }
  }

  return {
    cpf: normalizeCpf(rawCpf),
    contractId: normalizeContract(rawContract),
    name: normalizeName(rawName)
  };
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

  // Build field mapping array & verify all schema fields (including Status & Observação final) are present in CSV
  const missingFields: string[] = [];
  const fieldToColIndexMap: number[] = [];

  expectedFields.forEach((field, fIdx) => {
    const normLabel = normalizeHeader(field.label || "");
    const normId = normalizeHeader(field.id || "");

    // Look for exact or fuzzy match in CSV headers
    let matchIdx = normHeaderCols.findIndex(
      h => h === normLabel || h === normId || (normLabel && h && (h === normLabel || h.includes(normLabel)))
    );

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

    // Positional fallback if CSV has exact column count matching expectedFields
    if (matchIdx === -1 && fIdx < headerCols.length && headerCols.length >= expectedFields.length) {
      matchIdx = fIdx;
    }

    if (matchIdx === -1) {
      missingFields.push(field.label || field.id);
    } else {
      fieldToColIndexMap[fIdx] = matchIdx;
    }
  });

  if (missingFields.length > 0) {
    throw new Error(
      `O arquivo CSV de importação deve obrigatoriamente conter todas as colunas da guia, incluindo 'Status' e 'Observação final'.\n\nColuna(s) não encontrada(s) no arquivo CSV:\n• ${missingFields.join("\n• ")}`
    );
  }

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

    // Ensure raw key columns (NOME, ID CONTRATO, CPF) are also stored if present in headerCols
    headerCols.forEach((colHeader, cIdx) => {
      if (colHeader && cols[cIdx] !== undefined) {
        const val = cleanColumn(cols[cIdx]);
        if (val && val !== "-" && val !== "—") {
          const normH = normalizeHeader(colHeader);
          if (normH.includes("cpf") && !data["cpf"]) data["cpf"] = val;
          if (normH.includes("contrato") && !data["idContrato"]) data["idContrato"] = val;
          if ((normH === "nome" || normH === "nomecliente" || (normH.includes("nome") && !normH.includes("base"))) && !data["nome"]) data["nome"] = val;
        }
      }
    });

    // Keep _order tracking for fixed position ordering
    data._order = String(i);
    // New entrants default to unfinalized ("false") so they are manually marked
    data.finalizada = "false";

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
  const headers = ["Status Proposta", ...schema.fields.map(f => f.label)].join(";");
  const rows = records.map(r => {
    const isFin = isRecordFinalized(r, schema.fields) ? "Finalizada" : "Aberta";
    const fieldVals = schema.fields.map(f => {
      const val = r.data[f.id] || "-";
      return val.includes(";") ? `"${val}"` : val;
    });
    return [isFin, ...fieldVals].join(";");
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

export const isObservationFinalized = (obs: string | undefined | null): boolean => {
  if (!obs) return false;
  const s = String(obs).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!s || s === "-" || s === "—") return false;
  return (
    s === "proposta cancelada/reprovada" ||
    s === "proposta cancelada / reprovada" ||
    s === "proposta cancelada" ||
    s === "proposta reprovada" ||
    s.includes("cancelada/reprovada") ||
    s.includes("cancelada / reprovada") ||
    (s.includes("proposta") && (s.includes("cancelada") || s.includes("reprovada")))
  );
};

export const isRecordFinalized = (record: DynamicRecord | undefined | null, fields?: any[]): boolean => {
  if (!record || !record.data) return false;

  // 1. Explicit toggle has highest priority
  const fin = record.data.finalizada || record.data._finalizada;
  if (fin === "true" || fin === "sim" || fin === "1") {
    return true;
  }
  if (fin === "false" || fin === "nao" || fin === "não" || fin === "0") {
    return false;
  }

  // 2. Existing database fallback: check if Observação final matches "Proposta Cancelada/Reprovada"
  let obsVal = record.data.observacaoFinal || record.data["Observação final"] || record.data["Observacao final"] || "";
  
  if (!obsVal && fields && Array.isArray(fields)) {
    const obsField = fields.find(f => f && (f.id === 'observacaoFinal' || (f.label && f.label.toLowerCase().includes('observa'))));
    if (obsField) {
      obsVal = record.data[obsField.id] || record.data[obsField.label] || "";
    }
  }

  if (!obsVal) {
    for (const [k, v] of Object.entries(record.data)) {
      if (k.toLowerCase().includes("observa")) {
        obsVal = v;
        break;
      }
    }
  }

  return isObservationFinalized(obsVal);
};

export const normalizeForDeduplication = (
  raw: string | undefined | null,
  fieldId: string = '',
  fieldLabel: string = ''
): string => {
  if (!raw) return "";
  let val = String(raw).trim();
  if (!val || val === "-" || val === "—" || val === "null" || val === "undefined") return "";

  const idLower = fieldId.toLowerCase();
  const labelLower = fieldLabel.toLowerCase();

  // CPF / Documento: normalize digits
  if (idLower.includes('cpf') || labelLower.includes('cpf') || idLower.includes('doc') || labelLower.includes('documento')) {
    const digits = val.replace(/\D/g, "");
    if (digits.length >= 8) {
      return digits.padStart(11, "0");
    }
    return digits;
  }

  // Telefone / Celular: normalize digits
  if (idLower.includes('tel') || labelLower.includes('tel') || idLower.includes('cel') || labelLower.includes('cel') || idLower.includes('fone') || labelLower.includes('fone')) {
    const digits = val.replace(/\D/g, "");
    if (digits.length >= 8) {
      return digits;
    }
    return digits;
  }

  // Email: lowercase and trim
  if (idLower.includes('email') || labelLower.includes('email') || idLower.includes('e-mail') || labelLower.includes('e-mail')) {
    return val.toLowerCase().replace(/\s+/g, "");
  }

  // General text: normalize extra whitespace and lowercase
  return val.toLowerCase().replace(/\s+/g, " ");
};

