import React, { useState, useMemo } from "react";
import { 
  DollarSign, 
  Filter, 
  Calculator, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Layers, 
  Download, 
  Search, 
  CheckCircle2, 
  HelpCircle, 
  XCircle, 
  Award, 
  Percent, 
  FileSpreadsheet, 
  ArrowUpDown,
  Sliders,
  Sparkles,
  Info,
  Target,
  Users,
  Eye,
  ListFilter,
  Check
} from "lucide-react";
import { ReportSchema, DynamicRecord, FieldDef } from "../types";
import * as xlsx from "xlsx";

interface AdminSomaseManagerialViewProps {
  schemas: ReportSchema[];
  records: DynamicRecord[];
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

// Robust currency and number parser
export function parseFinancialValue(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let str = String(val).trim();
  if (!str || str === '-' || str === '—' || str.toLowerCase() === 'null') return 0;

  // Remove currency symbol, spaces and letters
  str = str.replace(/[R$\s]/g, '');

  // Check Brazilian vs US number format
  // Example "1.500,50" -> "1500.50"
  // Example "1500,50" -> "1500.50"
  // Example "1,500.50" -> "1500.50"
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // Format 1.500,50 (Brazilian standard)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format 1,500.50 (US standard)
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Format 1500,50
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Currency formatter
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export const AdminSomaseManagerialView: React.FC<AdminSomaseManagerialViewProps> = ({
  schemas,
  records,
  showToast
}) => {
  // 1. Select active Base / Schema
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>("ALL");

  // Determine current active schema and its fields
  const currentSchema = useMemo(() => {
    if (selectedSchemaId === "ALL") return null;
    return schemas.find(s => s.id === selectedSchemaId) || null;
  }, [schemas, selectedSchemaId]);

  // Combine available fields across schemas or for selected schema
  const availableFields = useMemo<FieldDef[]>(() => {
    if (currentSchema) {
      return currentSchema.fields || [];
    }
    // For "ALL", aggregate common fields from all schemas
    const fieldMap = new Map<string, FieldDef>();
    schemas.forEach(s => {
      (s.fields || []).forEach(f => {
        if (!fieldMap.has(f.id)) {
          fieldMap.set(f.id, f);
        }
      });
    });
    return Array.from(fieldMap.values());
  }, [currentSchema, schemas]);

  // 2. Select Sum Column (Always Numeric)
  const defaultSumColumn = useMemo(() => {
    const candidate = availableFields.find(f => {
      const idL = f.id.toLowerCase();
      const labL = f.label.toLowerCase();
      return idL.includes('liberado') || labL.includes('liberado') ||
             idL.includes('valor') || labL.includes('valor') ||
             idL.includes('solicitado') || labL.includes('solicitado') ||
             idL.includes('lucro') || labL.includes('lucro');
    });
    return candidate ? candidate.id : (availableFields[0]?.id || 'valorLiberado');
  }, [availableFields]);

  const [sumFieldId, setSumFieldId] = useState<string>(defaultSumColumn);

  // 3. Select Criteria / Filter Column (Always Text / Category)
  const defaultCriteriaColumn = useMemo(() => {
    const candidate = availableFields.find(f => {
      const idL = f.id.toLowerCase();
      const labL = f.label.toLowerCase();
      return idL === 'status' || labL === 'status' ||
             idL.includes('observa') || labL.includes('observa') ||
             idL.includes('base') || labL.includes('base');
    });
    return candidate ? candidate.id : (availableFields[1]?.id || 'status');
  }, [availableFields]);

  const [criteriaFieldId, setCriteriaFieldId] = useState<string>(defaultCriteriaColumn);

  // 4. Specific Unique Criterion Selection ("ALL" or specific preenchimento value)
  const [selectedSpecificCriterion, setSelectedSpecificCriterion] = useState<string>("ALL");

  // Profit multiplier simulation (e.g. 100% full volume, or commission percentage)
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [tableSortBy, setTableSortBy] = useState<'sum' | 'count' | 'avg' | 'name'>('sum');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showOnlySelectedRow, setShowOnlySelectedRow] = useState<boolean>(false);
  const [showMatchingProposalsModal, setShowMatchingProposalsModal] = useState<boolean>(false);

  // Filter records based on selected schema
  const relevantRecords = useMemo(() => {
    if (selectedSchemaId === "ALL") {
      return records;
    }
    return records.filter(r => r.reportId === selectedSchemaId);
  }, [records, selectedSchemaId]);

  // Labels of selected columns
  const sumFieldLabel = useMemo(() => {
    const f = availableFields.find(af => af.id === sumFieldId);
    return f ? f.label : sumFieldId;
  }, [availableFields, sumFieldId]);

  const criteriaFieldLabel = useMemo(() => {
    const f = availableFields.find(af => af.id === criteriaFieldId);
    return f ? f.label : criteriaFieldId;
  }, [availableFields, criteriaFieldId]);

  // Extract all unique preenchimentos / distinct criteria values for the selected column
  const uniqueCriteriaOptions = useMemo(() => {
    const map = new Map<string, { count: number; rawSum: number }>();

    relevantRecords.forEach(rec => {
      const data = rec.data || {};
      let val = String(data[criteriaFieldId] || "").trim();
      if (!val || val === '-' || val === '—' || val.toLowerCase() === 'null') {
        val = "(Sem Classificação / Vazio)";
      }
      const num = parseFinancialValue(data[sumFieldId]);
      const curr = map.get(val) || { count: 0, rawSum: 0 };
      map.set(val, { count: curr.count + 1, rawSum: curr.rawSum + num });
    });

    const multiplier = profitMarginPercent / 100;

    return Array.from(map.entries())
      .map(([val, stats]) => ({
        value: val,
        count: stats.count,
        rawSum: stats.rawSum,
        adjustedSum: stats.rawSum * multiplier
      }))
      .sort((a, b) => b.count - a.count);
  }, [relevantRecords, criteriaFieldId, sumFieldId, profitMarginPercent]);

  // Reset or adjust specific criterion when column changes
  const handleCriteriaFieldChange = (newFieldId: string) => {
    setCriteriaFieldId(newFieldId);
    setSelectedSpecificCriterion("ALL");
  };

  // ==========================================
  // SOMASE CORE CALCULATION ENGINE
  // ==========================================
  const somaseResults = useMemo(() => {
    const groupMap = new Map<string, { 
      criterion: string; 
      count: number; 
      rawSum: number; 
      records: DynamicRecord[] 
    }>();

    let totalRawSum = 0;
    let totalCount = 0;
    let validNumericValuesCount = 0;

    relevantRecords.forEach(rec => {
      const data = rec.data || {};
      
      // Get Criteria Value (Text)
      let criterionVal = String(data[criteriaFieldId] || "").trim();
      if (!criterionVal || criterionVal === '-' || criterionVal === '—' || criterionVal.toLowerCase() === 'null') {
        criterionVal = "(Sem Classificação / Vazio)";
      }

      // Get Sum Value (Numeric)
      const rawNum = parseFinancialValue(data[sumFieldId]);
      if (rawNum > 0) {
        validNumericValuesCount++;
      }

      if (!groupMap.has(criterionVal)) {
        groupMap.set(criterionVal, {
          criterion: criterionVal,
          count: 0,
          rawSum: 0,
          records: []
        });
      }

      const item = groupMap.get(criterionVal)!;
      item.count += 1;
      item.rawSum += rawNum;
      item.records.push(rec);

      totalRawSum += rawNum;
      totalCount += 1;
    });

    const multiplier = profitMarginPercent / 100;
    const totalAdjustedSum = totalRawSum * multiplier;

    // Convert to enriched array
    let allItems = Array.from(groupMap.values()).map(item => {
      const adjustedSum = item.rawSum * multiplier;
      const avgValue = item.count > 0 ? (adjustedSum / item.count) : 0;
      const shareSumPercent = totalAdjustedSum > 0 ? (adjustedSum / totalAdjustedSum) * 100 : 0;
      const shareCountPercent = totalCount > 0 ? (item.count / totalCount) * 100 : 0;

      return {
        criterion: item.criterion,
        count: item.count,
        rawSum: item.rawSum,
        adjustedSum,
        avgValue,
        shareSumPercent,
        shareCountPercent,
        records: item.records
      };
    });

    // Find the specific item if selected
    const singleSpecificItem = selectedSpecificCriterion !== "ALL"
      ? allItems.find(it => it.criterion === selectedSpecificCriterion) || {
          criterion: selectedSpecificCriterion,
          count: 0,
          rawSum: 0,
          adjustedSum: 0,
          avgValue: 0,
          shareSumPercent: 0,
          shareCountPercent: 0,
          records: []
        }
      : null;

    let displayItems = [...allItems];

    // Filter by specific criterion if option to isolate is enabled
    if (selectedSpecificCriterion !== "ALL" && showOnlySelectedRow) {
      displayItems = displayItems.filter(item => item.criterion === selectedSpecificCriterion);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      displayItems = displayItems.filter(item => item.criterion.toLowerCase().includes(term));
    }

    // Sorting
    displayItems.sort((a, b) => {
      // If a specific criterion is selected and in full list, pin it to top if desired or sort normally
      let comparison = 0;
      if (tableSortBy === 'sum') {
        comparison = a.adjustedSum - b.adjustedSum;
      } else if (tableSortBy === 'count') {
        comparison = a.count - b.count;
      } else if (tableSortBy === 'avg') {
        comparison = a.avgValue - b.avgValue;
      } else if (tableSortBy === 'name') {
        comparison = a.criterion.localeCompare(b.criterion);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Top Performer by Value
    const sortedBySum = [...allItems].sort((a, b) => b.adjustedSum - a.adjustedSum);
    const topByValue = sortedBySum[0] || null;

    // Top by Count
    const sortedByCount = [...allItems].sort((a, b) => b.count - a.count);
    const topByCount = sortedByCount[0] || null;

    return {
      allItems,
      items: displayItems,
      singleSpecificItem,
      totalCount,
      totalRawSum,
      totalAdjustedSum,
      overallAvg: totalCount > 0 ? (totalAdjustedSum / totalCount) : 0,
      topByValue,
      topByCount,
      validNumericValuesCount
    };
  }, [
    relevantRecords, 
    sumFieldId, 
    criteriaFieldId, 
    selectedSpecificCriterion,
    showOnlySelectedRow,
    profitMarginPercent, 
    searchTerm, 
    tableSortBy, 
    sortOrder
  ]);

  // Matching records for the single selected criterion
  const singleCriterionRecords = useMemo(() => {
    if (selectedSpecificCriterion === "ALL") return [];
    return somaseResults.singleSpecificItem?.records || [];
  }, [selectedSpecificCriterion, somaseResults.singleSpecificItem]);

  // Export to Excel handler
  const handleExportExcel = () => {
    try {
      const exportRows = somaseResults.items.map((row, idx) => ({
        "#": idx + 1,
        "Critério / Categoria": row.criterion,
        "Quantidade de Tratativas": row.count,
        "% Quantidade": `${row.shareCountPercent.toFixed(1)}%`,
        [`Soma (${sumFieldLabel})`]: row.adjustedSum,
        "% do Total Financeiro": `${row.shareSumPercent.toFixed(1)}%`,
        "Ticket Médio por Tratativa": row.avgValue
      }));

      // Add Total Summary Row
      exportRows.push({
        "#": 0,
        "Critério / Categoria": selectedSpecificCriterion === "ALL" ? "TOTAL GERAL" : `TOTAL GERAL (Todos os Critérios)`,
        "Quantidade de Tratativas": somaseResults.totalCount,
        "% Quantidade": "100.0%",
        [`Soma (${sumFieldLabel})`]: somaseResults.totalAdjustedSum,
        "% do Total Financeiro": "100.0%",
        "Ticket Médio por Tratativa": somaseResults.overallAvg
      });

      const ws = xlsx.utils.json_to_sheet(exportRows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "SOMASE Gerencial");

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `relatorio_gerencial_somase_${dateStr}.xlsx`;
      xlsx.writeFile(wb, filename);

      showToast(`Relatório SOMASE exportado: ${filename}`, 'success');
    } catch (e) {
      console.error(e);
      showToast("Erro ao exportar planilha Excel.", 'error');
    }
  };

  const handleToggleSort = (field: 'sum' | 'count' | 'avg' | 'name') => {
    if (tableSortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortBy(field);
      setSortOrder('desc');
    }
  };

  const isSingleMode = selectedSpecificCriterion !== "ALL";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Control Deck */}
      <div className="bg-[#EBEAE5] border-2 border-[#141414] p-5 shadow-[4px_4px_0px_#141414] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#141414] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-300 border-2 border-[#141414] flex items-center justify-center shadow-[3px_3px_0px_#141414] text-[#141414]">
              <Calculator size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141414] text-white px-2 py-0.5">
                  Visualização Gerencial
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-400 px-1.5 py-0.5">
                  Função SOMASE • Excel
                </span>
                {isSingleMode && (
                  <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-950 border border-emerald-500 px-1.5 py-0.5 flex items-center gap-1">
                    <Target size={11} /> Critério Único Ativo
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-[#141414] mt-0.5">
                Cálculo Gerencial de Lucro & Tratativas
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-black transition-all border-2 border-[#141414] shadow-[3px_3px_0px_#C5C4C0] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer"
            >
              <Download size={14} className="text-emerald-400" />
              <span>Exportar Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Formula Configuration Pickers (The SOMASE Engine Controls) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
          {/* 1. Base / Guia Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <Layers size={12} className="text-[#141414]" />
              1. Base de Dados
            </label>
            <select
              value={selectedSchemaId}
              onChange={(e) => {
                setSelectedSchemaId(e.target.value);
                setSelectedSpecificCriterion("ALL");
              }}
              className="w-full bg-white border-2 border-[#141414] p-2 text-xs font-bold text-[#141414] shadow-[2px_2px_0px_#141414] focus:outline-none cursor-pointer"
            >
              <option value="ALL">★ Todas as Guias Combinadas ({records.length} registros)</option>
              {schemas.map(s => {
                const count = records.filter(r => r.reportId === s.id).length;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({count} registros)
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Sum Column Selector (Always Numeric) */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1">
              <DollarSign size={12} className="text-emerald-700" />
              2. Coluna para Soma (Numérica)
            </label>
            <select
              value={sumFieldId}
              onChange={(e) => setSumFieldId(e.target.value)}
              className="w-full bg-emerald-50 border-2 border-[#141414] p-2 text-xs font-bold text-emerald-950 shadow-[2px_2px_0px_#141414] focus:outline-none cursor-pointer"
            >
              {availableFields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.id})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Criteria Column Selector (Always Text/Category) */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-blue-950 flex items-center gap-1">
              <Filter size={12} className="text-blue-700" />
              3. Coluna Critério (Texto)
            </label>
            <select
              value={criteriaFieldId}
              onChange={(e) => handleCriteriaFieldChange(e.target.value)}
              className="w-full bg-blue-50 border-2 border-[#141414] p-2 text-xs font-bold text-blue-950 shadow-[2px_2px_0px_#141414] focus:outline-none cursor-pointer"
            >
              {availableFields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.id})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Single Specific Criterion Filter (Preenchimento Específico) */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-amber-950 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Target size={12} className="text-amber-700" />
                4. Critério Único (Preenchimento)
              </span>
              {isSingleMode && (
                <button
                  type="button"
                  onClick={() => setSelectedSpecificCriterion("ALL")}
                  className="text-[9px] font-mono font-bold uppercase text-blue-700 underline hover:text-blue-900"
                >
                  Ver Todos
                </button>
              )}
            </label>
            <select
              value={selectedSpecificCriterion}
              onChange={(e) => setSelectedSpecificCriterion(e.target.value)}
              className={`w-full border-2 border-[#141414] p-2 text-xs font-bold shadow-[2px_2px_0px_#141414] focus:outline-none cursor-pointer ${
                isSingleMode ? 'bg-amber-100 text-amber-950 border-amber-800' : 'bg-white text-[#141414]'
              }`}
            >
              <option value="ALL">★ Todos os preenchimentos ({uniqueCriteriaOptions.length} categorias)</option>
              {uniqueCriteriaOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} ({opt.count} trat. • {formatCurrencyBRL(opt.adjustedSum)})
                </option>
              ))}
            </select>
          </div>

          {/* 5. Profit Multiplier / Simulation */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-purple-950 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Percent size={12} className="text-purple-700" />
                5. Margem / Volume
              </span>
              <span className="font-mono font-bold text-purple-900 bg-purple-100 px-1 border border-purple-300">
                {profitMarginPercent}%
              </span>
            </label>
            <div className="flex items-center gap-2 bg-purple-50 border-2 border-[#141414] p-2 shadow-[2px_2px_0px_#141414]">
              <input
                type="range"
                min={1}
                max={100}
                value={profitMarginPercent}
                onChange={(e) => setProfitMarginPercent(parseInt(e.target.value, 10) || 100)}
                className="w-full accent-[#141414] cursor-pointer"
                title="Ajuste para simular porcentagem de lucro líquido ou comissão"
              />
              <button
                type="button"
                onClick={() => setProfitMarginPercent(100)}
                className="text-[9px] font-mono font-bold uppercase bg-white px-1.5 py-0.5 border border-purple-400 hover:bg-purple-200"
                title="Restaurar para 100%"
              >
                100%
              </button>
            </div>
          </div>
        </div>

        {/* Quick Criterion Selection Pills (Preenchimentos mais frequentes) */}
        {uniqueCriteriaOptions.length > 0 && (
          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1 mr-1">
              <ListFilter size={11} /> Seleção Rápida:
            </span>
            <button
              onClick={() => setSelectedSpecificCriterion("ALL")}
              className={`text-[10px] font-bold px-2 py-0.5 border border-[#141414] transition-all cursor-pointer ${
                selectedSpecificCriterion === "ALL"
                  ? "bg-[#141414] text-white shadow-[2px_2px_0px_rgba(0,0,0,0.3)] font-black"
                  : "bg-white text-slate-700 hover:bg-slate-200"
              }`}
            >
              ★ Todos ({uniqueCriteriaOptions.length})
            </button>
            {uniqueCriteriaOptions.slice(0, 6).map(opt => {
              const isSelected = selectedSpecificCriterion === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedSpecificCriterion(opt.value)}
                  className={`text-[10px] font-bold px-2 py-0.5 border border-[#141414] transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? "bg-amber-400 text-amber-950 font-black shadow-[2px_2px_0px_#141414]"
                      : "bg-white text-slate-800 hover:bg-amber-100"
                  }`}
                  title={`${opt.value}: ${opt.count} tratativas (${formatCurrencyBRL(opt.adjustedSum)})`}
                >
                  {isSelected && <Check size={10} className="stroke-[3]" />}
                  <span className="truncate max-w-[140px]">{opt.value}</span>
                  <span className="text-[9px] opacity-75 font-mono">({opt.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Dynamic Formula Display Explanation */}
        <div className="bg-white border-2 border-slate-300 p-2.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-bold bg-[#141414] text-white px-1.5 py-0.5 text-[10px]">FÓRMULA EXCEL:</span>
            <span>
              =SOMASE(<strong>{criteriaFieldLabel}</strong>; <strong>"{isSingleMode ? selectedSpecificCriterion : `[${criteriaFieldLabel}]`}"</strong>; <strong>{sumFieldLabel}</strong>)
              {profitMarginPercent !== 100 && ` * ${profitMarginPercent}%`}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-bold">
            <Info size={13} className="text-blue-600" />
            <span>
              {isSingleMode 
                ? `${somaseResults.singleSpecificItem?.count || 0} propostas atendem ao critério "${selectedSpecificCriterion}"`
                : `${somaseResults.validNumericValuesCount} registros com valores numéricos válidos`
              }
            </span>
          </div>
        </div>
      </div>

      {/* SINGLE CRITERION SPOTLIGHT BANNER (When a unique criteria is chosen) */}
      {isSingleMode && somaseResults.singleSpecificItem && (
        <div className="bg-amber-50 border-3 border-[#141414] p-5 shadow-[6px_6px_0px_#141414] animate-in fade-in duration-300 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-amber-300 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-400 border-2 border-[#141414] flex items-center justify-center text-[#141414] shadow-[2px_2px_0px_#141414]">
                <Target size={22} />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900 bg-amber-200 px-1.5 py-0.5 border border-amber-400">
                  Critério Específico Selecionado
                </span>
                <h3 className="text-lg font-black uppercase text-[#141414] mt-0.5">
                  "{somaseResults.singleSpecificItem.criterion}"
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMatchingProposalsModal(true)}
                className="flex items-center gap-1.5 bg-[#141414] text-white px-3.5 py-1.5 text-xs font-black uppercase hover:bg-black transition-all border-2 border-[#141414] shadow-[2px_2px_0px_#C5C4C0] active:translate-y-0.5 cursor-pointer"
              >
                <Eye size={13} className="text-amber-300" />
                <span>Ver {singleCriterionRecords.length} Propostas deste Critério</span>
              </button>

              <button
                onClick={() => setSelectedSpecificCriterion("ALL")}
                className="flex items-center gap-1.5 bg-white text-[#141414] px-3 py-1.5 text-xs font-bold uppercase hover:bg-slate-100 transition-all border-2 border-[#141414] shadow-[2px_2px_0px_#141414] active:translate-y-0.5 cursor-pointer"
              >
                Limpar Filtro Específico
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Spotlight Card 1: Soma Específica */}
            <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_#141414]">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 block">
                Soma SOMASE Exata
              </span>
              <div className="text-xl font-black font-mono text-emerald-900 mt-1">
                {formatCurrencyBRL(somaseResults.singleSpecificItem.adjustedSum)}
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-800">
                {somaseResults.singleSpecificItem.shareSumPercent.toFixed(1)}% do faturamento total
              </span>
            </div>

            {/* Spotlight Card 2: Quantidade de Tratativas */}
            <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_#141414]">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 block">
                Qtd de Tratativas
              </span>
              <div className="text-xl font-black font-mono text-[#141414] mt-1">
                {somaseResults.singleSpecificItem.count} ocorrências
              </div>
              <span className="text-[10px] font-mono font-bold text-blue-800">
                {somaseResults.singleSpecificItem.shareCountPercent.toFixed(1)}% das tratativas da base
              </span>
            </div>

            {/* Spotlight Card 3: Ticket Médio Específico */}
            <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_#141414]">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 block">
                Ticket Médio do Critério
              </span>
              <div className="text-xl font-black font-mono text-purple-950 mt-1">
                {formatCurrencyBRL(somaseResults.singleSpecificItem.avgValue)}
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                por proposta com este critério
              </span>
            </div>

            {/* Spotlight Card 4: Comparativo com Total Geral */}
            <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_#141414]">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 block">
                Total Geral da Base
              </span>
              <div className="text-xl font-black font-mono text-slate-800 mt-1">
                {formatCurrencyBRL(somaseResults.totalAdjustedSum)}
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-600">
                em {somaseResults.totalCount} tratativas totais
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Summary Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sum (Lucro Total / Volume) */}
        <div className="bg-[#D9D8D4] border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
              {isSingleMode ? `Soma do Critério: ${selectedSpecificCriterion}` : `Soma Total (${sumFieldLabel})`}
            </span>
            <div className="bg-emerald-200 p-1.5 border border-emerald-900 text-emerald-950">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-emerald-950 tracking-tight">
              {formatCurrencyBRL(isSingleMode ? (somaseResults.singleSpecificItem?.adjustedSum || 0) : somaseResults.totalAdjustedSum)}
            </div>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              {isSingleMode
                ? `${somaseResults.singleSpecificItem?.shareSumPercent.toFixed(1)}% do total da base (${formatCurrencyBRL(somaseResults.totalAdjustedSum)})`
                : profitMarginPercent === 100 ? "Volume financeiro total acumulado" : `Aplicando margem de ${profitMarginPercent}%`
              }
            </p>
          </div>
        </div>

        {/* Total Count of Treatments */}
        <div className="bg-[#D9D8D4] border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
              {isSingleMode ? `Tratativas no Critério` : `Total de Tratativas / Registros`}
            </span>
            <div className="bg-blue-200 p-1.5 border border-blue-900 text-blue-950">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-[#141414]">
              {isSingleMode ? (somaseResults.singleSpecificItem?.count || 0) : somaseResults.totalCount}
            </div>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              {isSingleMode
                ? `${somaseResults.singleSpecificItem?.shareCountPercent.toFixed(1)}% de ${somaseResults.totalCount} tratativas totais`
                : `${somaseResults.allItems.length} categorias/critérios distintos`
              }
            </p>
          </div>
        </div>

        {/* Overall Average Ticket */}
        <div className="bg-[#D9D8D4] border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
              {isSingleMode ? `Ticket Médio do Critério` : `Ticket Médio Geral`}
            </span>
            <div className="bg-purple-200 p-1.5 border border-purple-900 text-purple-950">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-purple-950">
              {formatCurrencyBRL(isSingleMode ? (somaseResults.singleSpecificItem?.avgValue || 0) : somaseResults.overallAvg)}
            </div>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              {isSingleMode
                ? `Média geral da base: ${formatCurrencyBRL(somaseResults.overallAvg)}`
                : "Valor médio por ocorrência"
              }
            </p>
          </div>
        </div>

        {/* Top Performer Category */}
        <div className="bg-[#D9D8D4] border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
              Maior Volume Financeiro
            </span>
            <div className="bg-amber-200 p-1.5 border border-amber-900 text-amber-950">
              <Award size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-base font-black text-amber-950 truncate" title={somaseResults.topByValue?.criterion || "-"}>
              {somaseResults.topByValue?.criterion || "Nenhum"}
            </div>
            <p className="text-[10px] font-mono text-amber-900 font-bold mt-0.5 flex items-center justify-between">
              <span>{formatCurrencyBRL(somaseResults.topByValue?.adjustedSum || 0)}</span>
              <span>({(somaseResults.topByValue?.shareSumPercent || 0).toFixed(1)}%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Visual Charts & Comparison Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Financial Value (Lucro) by Criterion */}
        <div className="bg-[#EBEAE5] border-2 border-[#141414] p-4 shadow-[4px_4px_0px_#141414] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b-2 border-[#141414] pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-[#141414]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#141414]">
                Distribuição Financeira (Soma por {criteriaFieldLabel})
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold bg-[#141414] text-white px-2 py-0.5">
              Valores em R$
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-72 pr-1">
            {somaseResults.allItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">Nenhum critério com valor financeiro encontrado.</p>
            ) : (
              somaseResults.allItems.map((item, idx) => {
                const isSelected = isSingleMode && item.criterion === selectedSpecificCriterion;
                const isPositive = item.criterion.toLowerCase().includes("sucesso") || item.criterion.toLowerCase().includes("paga");
                const isNegative = item.criterion.toLowerCase().includes("sem") || item.criterion.toLowerCase().includes("cancelada") || item.criterion.toLowerCase().includes("reprovada");
                
                const barColor = isSelected ? 'bg-amber-400' : isPositive ? 'bg-emerald-500' : isNegative ? 'bg-rose-400' : 'bg-blue-400';

                return (
                  <div 
                    key={item.criterion} 
                    onClick={() => setSelectedSpecificCriterion(item.criterion)}
                    className={`space-y-1 p-1.5 transition-all cursor-pointer rounded-xs ${
                      isSelected ? 'bg-amber-100 border-2 border-amber-600 shadow-xs' : 'hover:bg-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#141414] truncate max-w-[220px] flex items-center gap-1" title={item.criterion}>
                        {isSelected && <Target size={12} className="text-amber-800 shrink-0" />}
                        <span>{idx + 1}. {item.criterion}</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`font-black ${isSelected ? 'text-amber-950 font-extrabold' : 'text-[#141414]'}`}>
                          {formatCurrencyBRL(item.adjustedSum)}
                        </span>
                        <span className="text-[10px] text-slate-600 font-bold w-12 text-right">
                          {item.shareSumPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-300 h-3 border border-[#141414] overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(item.adjustedSum > 0 ? 3 : 0, item.shareSumPercent))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Volume of Treatments (Quantidade) by Criterion */}
        <div className="bg-[#EBEAE5] border-2 border-[#141414] p-4 shadow-[4px_4px_0px_#141414] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b-2 border-[#141414] pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <PieChart size={16} className="text-[#141414]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#141414]">
                Volume de Tratativas (Qtd por {criteriaFieldLabel})
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold bg-[#141414] text-white px-2 py-0.5">
              Qtd Propostas
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-72 pr-1">
            {somaseResults.allItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">Nenhum dado encontrado.</p>
            ) : (
              somaseResults.allItems.map((item, idx) => {
                const isSelected = isSingleMode && item.criterion === selectedSpecificCriterion;

                return (
                  <div 
                    key={item.criterion} 
                    onClick={() => setSelectedSpecificCriterion(item.criterion)}
                    className={`space-y-1 p-1.5 transition-all cursor-pointer rounded-xs ${
                      isSelected ? 'bg-amber-100 border-2 border-amber-600 shadow-xs' : 'hover:bg-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#141414] truncate max-w-[220px] flex items-center gap-1" title={item.criterion}>
                        {isSelected && <Target size={12} className="text-amber-800 shrink-0" />}
                        <span>{idx + 1}. {item.criterion}</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={`font-black ${isSelected ? 'text-amber-950 font-extrabold' : 'text-[#141414]'}`}>
                          {item.count} tratativas
                        </span>
                        <span className="text-[10px] text-slate-600 font-bold w-12 text-right">
                          {item.shareCountPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-300 h-3 border border-[#141414] overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${isSelected ? 'bg-amber-500' : 'bg-blue-600'}`}
                        style={{ width: `${Math.min(100, Math.max(item.count > 0 ? 3 : 0, item.shareCountPercent))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SOMASE Master Analytical Table */}
      <div className="bg-[#EBEAE5] border-2 border-[#141414] shadow-[4px_4px_0px_#141414] overflow-hidden">
        {/* Table Header & Search Filter */}
        <div className="p-3 bg-[#D9D8D4] border-b-2 border-[#141414] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-[#141414]">
              Tabela Analítica SOMASE ({somaseResults.items.length} linhas)
            </span>
            {isSingleMode && (
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-200 px-2 py-0.5 border border-amber-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlySelectedRow}
                  onChange={(e) => setShowOnlySelectedRow(e.target.checked)}
                  className="accent-[#141414]"
                />
                <span>Isolar apenas "{selectedSpecificCriterion}"</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por critério..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border-2 border-[#141414] text-xs font-bold focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#141414] text-white uppercase text-[10px] tracking-wider">
                <th className="p-3 border-r border-slate-700 text-center w-12">#</th>
                
                <th 
                  onClick={() => handleToggleSort('name')}
                  className="p-3 border-r border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span>Critério: {criteriaFieldLabel}</span>
                    <ArrowUpDown size={12} className={tableSortBy === 'name' ? 'text-amber-400' : 'text-slate-500'} />
                  </div>
                </th>

                <th 
                  onClick={() => handleToggleSort('count')}
                  className="p-3 border-r border-slate-700 text-center cursor-pointer hover:bg-slate-800 transition-colors w-36"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Qtd Tratativas</span>
                    <ArrowUpDown size={12} className={tableSortBy === 'count' ? 'text-amber-400' : 'text-slate-500'} />
                  </div>
                </th>

                <th className="p-3 border-r border-slate-700 text-center w-20 font-mono">
                  % Qtd
                </th>

                <th 
                  onClick={() => handleToggleSort('sum')}
                  className="p-3 border-r border-slate-700 text-right cursor-pointer hover:bg-slate-800 transition-colors w-44 text-emerald-300"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Soma ({sumFieldLabel})</span>
                    <ArrowUpDown size={12} className={tableSortBy === 'sum' ? 'text-amber-400' : 'text-slate-500'} />
                  </div>
                </th>

                <th className="p-3 border-r border-slate-700 text-center w-24 font-mono text-emerald-300">
                  % Financeiro
                </th>

                <th 
                  onClick={() => handleToggleSort('avg')}
                  className="p-3 border-r border-slate-700 text-right cursor-pointer hover:bg-slate-800 transition-colors w-36"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Ticket Médio</span>
                    <ArrowUpDown size={12} className={tableSortBy === 'avg' ? 'text-amber-400' : 'text-slate-500'} />
                  </div>
                </th>

                <th className="p-3 w-40 text-center">
                  Ação / Proporção
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414] bg-white">
              {somaseResults.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 italic bg-[#F2F1EB]">
                    Nenhum dado encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                somaseResults.items.map((row, idx) => {
                  const isSelected = isSingleMode && row.criterion === selectedSpecificCriterion;
                  const isTopValue = idx === 0 && tableSortBy === 'sum' && row.adjustedSum > 0;

                  return (
                    <tr 
                      key={row.criterion}
                      onClick={() => setSelectedSpecificCriterion(row.criterion)}
                      className={`hover:bg-amber-50/70 transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-100 font-bold border-y-2 border-amber-600' 
                          : isTopValue ? 'bg-amber-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 border-r border-[#141414] text-center font-mono font-bold text-slate-700">
                        {isSelected ? "🎯" : isTopValue ? "★ 1" : idx + 1}
                      </td>

                      <td className="p-3 border-r border-[#141414] font-bold text-[#141414]">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 border inline-block ${
                            isSelected 
                              ? 'bg-amber-400 text-amber-950 border-amber-800 font-black' 
                              : 'bg-[#F2F1EB] border-slate-300'
                          }`}>
                            {row.criterion}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-mono uppercase bg-[#141414] text-white px-1.5 py-0.2">
                              Foco
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 border-r border-[#141414] text-center font-mono font-bold text-slate-900">
                        {row.count}
                      </td>

                      <td className="p-3 border-r border-[#141414] text-center font-mono text-slate-600">
                        {row.shareCountPercent.toFixed(1)}%
                      </td>

                      <td className="p-3 border-r border-[#141414] text-right font-mono font-bold text-emerald-900 text-sm">
                        {formatCurrencyBRL(row.adjustedSum)}
                      </td>

                      <td className="p-3 border-r border-[#141414] text-center font-mono font-bold text-emerald-800">
                        {row.shareSumPercent.toFixed(1)}%
                      </td>

                      <td className="p-3 border-r border-[#141414] text-right font-mono text-slate-800">
                        {formatCurrencyBRL(row.avgValue)}
                      </td>

                      <td className="p-3 text-center">
                        <div className="w-full bg-slate-200 h-2.5 border border-slate-400 overflow-hidden">
                          <div 
                            className={`h-full ${isSelected ? 'bg-amber-500' : 'bg-emerald-600'}`}
                            style={{ width: `${Math.min(100, Math.max(row.adjustedSum > 0 ? 3 : 0, row.shareSumPercent))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total Footer Row */}
            <tfoot className="border-t-2 border-[#141414] bg-[#EBEAE5] font-black uppercase text-xs">
              <tr>
                <td colSpan={2} className="p-3 border-r border-[#141414] text-right">
                  TOTAL GERAL ({somaseResults.items.length} itens)
                </td>
                <td className="p-3 border-r border-[#141414] text-center font-mono text-base text-[#141414]">
                  {somaseResults.totalCount}
                </td>
                <td className="p-3 border-r border-[#141414] text-center font-mono">
                  100.0%
                </td>
                <td className="p-3 border-r border-[#141414] text-right font-mono text-emerald-950 text-base">
                  {formatCurrencyBRL(somaseResults.totalAdjustedSum)}
                </td>
                <td className="p-3 border-r border-[#141414] text-center font-mono text-emerald-950">
                  100.0%
                </td>
                <td className="p-3 border-r border-[#141414] text-right font-mono text-[#141414]">
                  {formatCurrencyBRL(somaseResults.overallAvg)}
                </td>
                <td className="p-3 text-center text-[10px] font-mono text-slate-500">
                  SOMASE OK
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MATCHING PROPOSALS MODAL (Drilldown of records for selected criterion) */}
      {showMatchingProposalsModal && isSingleMode && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border-4 border-[#141414] shadow-[10px_10px_0px_#141414] max-w-4xl w-full max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-4 bg-[#EBEAE5] border-b-2 border-[#141414] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-300 border-2 border-[#141414] flex items-center justify-center font-black shadow-[2px_2px_0px_#141414]">
                  <Target size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-[#141414]">
                    Propostas com Critério: "{selectedSpecificCriterion}"
                  </h3>
                  <p className="text-[10px] font-mono text-slate-600">
                    {singleCriterionRecords.length} registros • Soma total: {formatCurrencyBRL(somaseResults.singleSpecificItem?.adjustedSum || 0)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMatchingProposalsModal(false)}
                className="bg-[#141414] text-white px-3 py-1 text-xs font-black uppercase border-2 border-[#141414] hover:bg-red-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Records List Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#141414] text-white uppercase text-[10px] tracking-wider">
                    <th className="p-2 border-r border-slate-700 text-center w-10">#</th>
                    <th className="p-2 border-r border-slate-700">Cliente</th>
                    <th className="p-2 border-r border-slate-700">CPF</th>
                    <th className="p-2 border-r border-slate-700 text-right">{sumFieldLabel}</th>
                    <th className="p-2 border-r border-slate-700">{criteriaFieldLabel}</th>
                    <th className="p-2">Base / Guia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {singleCriterionRecords.map((rec, idx) => {
                    const d = rec.data || {};
                    const schemaName = schemas.find(s => s.id === rec.reportId)?.name || d.nomeBase || rec.reportId;
                    const val = parseFinancialValue(d[sumFieldId]);
                    return (
                      <tr key={rec.id || idx} className="hover:bg-slate-100">
                        <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-bold text-[#141414]">
                          {d.nome || d.Nome || d.cliente || "-"}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono text-slate-700">
                          {d.cpf || d.CPF || "-"}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-900">
                          {formatCurrencyBRL(val * (profitMarginPercent / 100))}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-bold text-amber-950">
                          <span className="bg-amber-100 px-1.5 py-0.5 border border-amber-300">
                            {d[criteriaFieldId] || selectedSpecificCriterion}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-[10px] text-slate-600">
                          {schemaName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-3 bg-[#EBEAE5] border-t-2 border-[#141414] flex justify-between items-center text-xs font-bold">
              <span>Total de {singleCriterionRecords.length} propostas listadas</span>
              <button
                onClick={() => setShowMatchingProposalsModal(false)}
                className="bg-[#141414] text-white px-4 py-1.5 font-black uppercase text-xs border-2 border-[#141414] cursor-pointer"
              >
                Concluir Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSomaseManagerialView;
