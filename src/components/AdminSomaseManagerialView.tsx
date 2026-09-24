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
  Info
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

  // Profit multiplier simulation (e.g. 100% full volume, or commission percentage)
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [tableSortBy, setTableSortBy] = useState<'sum' | 'count' | 'avg' | 'name'>('sum');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hideEmptyValues, setHideEmptyValues] = useState<boolean>(true);

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
    let items = Array.from(groupMap.values()).map(item => {
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

    // Optional Filter: Hide Empty if requested
    if (hideEmptyValues) {
      items = items.filter(item => item.criterion !== "(Sem Classificação / Vazio)" || item.count > 0);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item => item.criterion.toLowerCase().includes(term));
    }

    // Sorting
    items.sort((a, b) => {
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
    const sortedBySum = [...items].sort((a, b) => b.adjustedSum - a.adjustedSum);
    const topByValue = sortedBySum[0] || null;

    // Top by Count
    const sortedByCount = [...items].sort((a, b) => b.count - a.count);
    const topByCount = sortedByCount[0] || null;

    return {
      items,
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
    profitMarginPercent, 
    searchTerm, 
    tableSortBy, 
    sortOrder, 
    hideEmptyValues
  ]);

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
        "Critério / Categoria": "TOTAL GERAL",
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 pt-1">
          {/* 1. Base / Guia Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <Layers size={12} className="text-[#141414]" />
              1. Base de Dados
            </label>
            <select
              value={selectedSchemaId}
              onChange={(e) => setSelectedSchemaId(e.target.value)}
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
              3. Coluna de Critério / Filtro (Texto)
            </label>
            <select
              value={criteriaFieldId}
              onChange={(e) => setCriteriaFieldId(e.target.value)}
              className="w-full bg-blue-50 border-2 border-[#141414] p-2 text-xs font-bold text-blue-950 shadow-[2px_2px_0px_#141414] focus:outline-none cursor-pointer"
            >
              {availableFields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.id})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Profit Multiplier / Simulation */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-purple-950 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Percent size={12} className="text-purple-700" />
                4. Margem de Lucro / Volume
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

        {/* Dynamic Formula Display Explanation */}
        <div className="bg-white border-2 border-slate-300 p-2.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-bold bg-[#141414] text-white px-1.5 py-0.5 text-[10px]">FÓRMULA EXCEL:</span>
            <span>
              =SOMASE(<strong>{criteriaFieldLabel}</strong>; [Critério]; <strong>{sumFieldLabel}</strong>)
              {profitMarginPercent !== 100 && ` * ${profitMarginPercent}%`}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-bold">
            <Info size={13} className="text-blue-600" />
            <span>{somaseResults.validNumericValuesCount} registros com valores numéricos válidos</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sum (Lucro Total / Volume) */}
        <div className="bg-[#D9D8D4] border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
              Soma Total ({sumFieldLabel})
            </span>
            <div className="bg-emerald-200 p-1.5 border border-emerald-900 text-emerald-950">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-emerald-950 tracking-tight">
              {formatCurrencyBRL(somaseResults.totalAdjustedSum)}
            </div>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              {profitMarginPercent === 100 ? "Volume financeiro total acumulado" : `Aplicando margem de ${profitMarginPercent}%`}
            </p>
          </div>
        </div>

        {/* Total Count of Treatments */}
        <div className="bg-[#D9D8D4] border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
              Total de Tratativas / Registros
            </span>
            <div className="bg-blue-200 p-1.5 border border-blue-900 text-blue-950">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-[#141414]">
              {somaseResults.totalCount}
            </div>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              {somaseResults.items.length} categorias/critérios distintos
            </p>
          </div>
        </div>

        {/* Overall Average Ticket */}
        <div className="bg-[#D9D8D4] border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
              Ticket Médio Geral
            </span>
            <div className="bg-purple-200 p-1.5 border border-purple-900 text-purple-950">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-purple-950">
              {formatCurrencyBRL(somaseResults.overallAvg)}
            </div>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              Valor médio por ocorrência
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
            {somaseResults.items.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">Nenhum critério com valor financeiro encontrado.</p>
            ) : (
              somaseResults.items.map((item, idx) => {
                const isPositive = item.criterion.toLowerCase().includes("sucesso") || item.criterion.toLowerCase().includes("paga");
                const isNegative = item.criterion.toLowerCase().includes("sem") || item.criterion.toLowerCase().includes("cancelada") || item.criterion.toLowerCase().includes("reprovada");
                
                const barColor = isPositive ? 'bg-emerald-500' : isNegative ? 'bg-rose-400' : 'bg-amber-400';

                return (
                  <div key={item.criterion} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#141414] truncate max-w-[200px]" title={item.criterion}>
                        {idx + 1}. {item.criterion}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-black text-[#141414]">
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
                Volume de Tratativas / Ocorrências (Qtd por {criteriaFieldLabel})
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold bg-[#141414] text-white px-2 py-0.5">
              Qtd Propostas
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-72 pr-1">
            {somaseResults.items.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">Nenhum dado encontrado.</p>
            ) : (
              somaseResults.items.map((item, idx) => {
                return (
                  <div key={item.criterion} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#141414] truncate max-w-[200px]" title={item.criterion}>
                        {idx + 1}. {item.criterion}
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-black text-[#141414]">
                          {item.count} tratativas
                        </span>
                        <span className="text-[10px] text-slate-600 font-bold w-12 text-right">
                          {item.shareCountPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-300 h-3 border border-[#141414] overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-500"
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#141414]">
              Tabela Analítica SOMASE ({somaseResults.items.length} linhas calculadas)
            </span>
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
                  Proporção Visual
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
                  const isTopValue = idx === 0 && tableSortBy === 'sum' && row.adjustedSum > 0;

                  return (
                    <tr 
                      key={row.criterion}
                      className={`hover:bg-amber-50/70 transition-colors ${
                        isTopValue ? 'bg-amber-50/40 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 border-r border-[#141414] text-center font-mono font-bold text-slate-700">
                        {isTopValue ? "★ 1" : idx + 1}
                      </td>

                      <td className="p-3 border-r border-[#141414] font-bold text-[#141414]">
                        <span className="bg-[#F2F1EB] px-2 py-0.5 border border-slate-300 inline-block">
                          {row.criterion}
                        </span>
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
                            className="h-full bg-emerald-600"
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
    </div>
  );
};

export default AdminSomaseManagerialView;
