import { DynamicRecord, FieldDef, GlobalSortConfig, SortDataType, SortDirection } from "../types";
import { getCellValue, isRecordFinalized } from "../utils";

/**
 * Extracts a numeric value from string (handling Brazilian R$, thousand dots, decimal commas, percentages).
 * Examples: "R$ 1.500,50" -> 1500.5, "25,4%" -> 25.4, "100" -> 100
 */
export function parseNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  
  let s = String(raw).trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return null;
  }

  // Remove currency prefixes/suffixes and symbols
  s = s.replace(/R\$|\$|EUR|USD|BRL|\s|%/gi, "");
  
  // Detect Brazilian currency format (dots for thousands, comma for decimals: 1.234.567,89)
  if (s.includes(",") && s.includes(".")) {
    // Has both dot and comma
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // e.g. 1.250,50 -> remove dots, replace comma with dot
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // e.g. 1,250.50 -> remove commas
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    // Only comma: e.g. 1500,50 or 50,00
    s = s.replace(",", ".");
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

/**
 * Extracts a timestamp (ms) from Brazilian date strings (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY HH:mm:ss) or ISO formats.
 */
export function parseDateValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.getTime();
  
  const s = String(raw).trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return null;
  }

  // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (with optional HH:mm:ss)
  const brMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const minute = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const second = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
    
    // Validate day and month ranges
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day, hour, minute, second);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
  }

  // 2. ISO format YYYY-MM-DD (with optional T or space and time)
  const isoMatch = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day, hour, minute, second);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
  }

  // 3. Fallback to standard Date.parse if it looks like a date string
  if (s.length >= 8 && (s.includes("-") || s.includes("/") || s.includes(":"))) {
    const parsed = Date.parse(s);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}

/**
 * Extracts a numeric value or timestamp from numbers, currency, or dates.
 * Returns { type: 'date' | 'number', value: number } or null.
 */
export function parseNumericOrDateValue(raw: any): { type: 'date' | 'number'; value: number } | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return isNaN(raw) ? null : { type: 'number', value: raw };

  const s = String(raw).trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return null;
  }

  // 1. Check if it's a date (DD/MM/YYYY, YYYY-MM-DD, etc.)
  const dateMs = parseDateValue(s);
  if (dateMs !== null) {
    return { type: 'date', value: dateMs };
  }

  // 2. Check if it's a standard number / currency / quantity
  const num = parseNumericValue(s);
  if (num !== null) {
    return { type: 'number', value: num };
  }

  return null;
}

/**
 * Auto-detects the most suitable SortDataType based on values present in that column.
 */
export function autoDetectSortType(
  records: DynamicRecord[],
  fieldDef: FieldDef | undefined,
  fieldId: string
): SortDataType {
  if (fieldId === "_finalizada" || fieldId === "status" || fieldId === "observacaoFinal") {
    return "text";
  }

  const sampleValues: string[] = [];
  for (const r of records) {
    if (!r?.data) continue;
    const val = fieldDef ? getCellValue(r.data, fieldDef) : r.data[fieldId];
    if (val && val !== "-" && val.trim() !== "") {
      sampleValues.push(val.trim());
      if (sampleValues.length >= 30) break;
    }
  }

  if (sampleValues.length === 0) {
    const idOrLabel = (fieldDef ? fieldDef.label + " " + fieldDef.id : fieldId).toLowerCase();
    if (idOrLabel.includes("valor") || idOrLabel.includes("quant") || idOrLabel.includes("saldo") || idOrLabel.includes("preco") || idOrLabel.includes("taxa") || idOrLabel.includes("score")) {
      return "number";
    }
    if (idOrLabel.includes("data") || idOrLabel.includes("nasc") || idOrLabel.includes("venc")) {
      return "date";
    }
    return "text";
  }

  let numericCount = 0;
  let dateCount = 0;

  for (const v of sampleValues) {
    if (parseDateValue(v) !== null && (v.includes("/") || v.includes("-")) && v.length >= 8) {
      dateCount++;
    } else if (parseNumericValue(v) !== null) {
      numericCount++;
    }
  }

  const total = sampleValues.length;
  if (numericCount / total >= 0.7) return "number";
  if (dateCount / total >= 0.7) return "date";

  return "text";
}

/**
 * Robust comparator for DynamicRecord items according to field and sort settings.
 */
export function sortRecordsByCriteria(
  records: DynamicRecord[],
  fields: FieldDef[],
  config: GlobalSortConfig
): DynamicRecord[] {
  const { fieldId, order, sortType = "text", emptyPosition = "last" } = config;
  const isAsc = order === "asc";
  const fieldDef = fields.find((f) => f && f.id === fieldId);

  const cloned = [...records];

  return cloned.sort((a, b) => {
    // 1. Special field: _finalizada (Status da proposta)
    if (fieldId === "_finalizada") {
      const isFinalA = isRecordFinalized(a, fields) ? 1 : 0;
      const isFinalB = isRecordFinalized(b, fields) ? 1 : 0;
      if (isFinalA !== isFinalB) {
        return isAsc ? isFinalA - isFinalB : isFinalB - isFinalA;
      }
      return 0;
    }

    const valA = fieldDef ? getCellValue(a?.data || {}, fieldDef) : a?.data?.[fieldId] || "";
    const valB = fieldDef ? getCellValue(b?.data || {}, fieldDef) : b?.data?.[fieldId] || "";

    const isEmptyA = !valA || valA === "-" || valA.trim() === "";
    const isEmptyB = !valB || valB === "-" || valB.trim() === "";

    // Handle Empty Values
    if (isEmptyA && isEmptyB) return 0;
    if (isEmptyA) return emptyPosition === "last" ? 1 : -1;
    if (isEmptyB) return emptyPosition === "last" ? -1 : 1;

    // 2. Numeric & Date comparison (Handles 1 to 100, R$, quantities, percentages, and dates/timestamps)
    if (sortType === "number" || sortType === "date") {
      const parsedA = parseNumericOrDateValue(valA);
      const parsedB = parseNumericOrDateValue(valB);

      if (parsedA !== null && parsedB !== null) {
        if (parsedA.value !== parsedB.value) {
          return isAsc ? parsedA.value - parsedB.value : parsedB.value - parsedA.value;
        }
      } else if (parsedA !== null) {
        return isAsc ? -1 : 1;
      } else if (parsedB !== null) {
        return isAsc ? 1 : -1;
      }
    }

    // 4. Fallback / Text comparison (A-Z or Z-A with natural numeric collation)
    const strA = String(valA).trim();
    const strB = String(valB).trim();
    const textDiff = strA.localeCompare(strB, "pt-BR", { numeric: true, sensitivity: "base" });
    
    if (textDiff !== 0) {
      return isAsc ? textDiff : -textDiff;
    }

    // Secondary fallback: by original order or id
    const orderA = a?.data?._order !== undefined ? Number(a.data._order) : Infinity;
    const orderB = b?.data?._order !== undefined ? Number(b.data._order) : Infinity;
    if (orderA !== orderB) return orderA - orderB;

    return a.id.localeCompare(b.id);
  });
}
