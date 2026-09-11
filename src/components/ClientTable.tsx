import React, { useState, useMemo } from "react";
import { Search, Download, Trash2, CheckSquare, ClipboardCopy, BarChart3, Settings2, Filter, RotateCcw, CheckCircle2, Circle, CopySlash, Calendar, CalendarDays, Clock, X, Check, ChevronDown, ChevronUp, ArrowUpDown, Sparkles } from "lucide-react";
import { DynamicRecord, ReportSchema, UserRole, FieldDef, StatusConfigItem, defaultStatusConfigs, ensureFixedColumns, GlobalSortConfig } from "../types";
import { exportDynamicCSV, formatCurrentDateTime, isRecordFinalized, fixMojibake, getRecordStatus, calculateExecutiveStatusSummary, normalizeDateStringToISO, formatISODateToBR, extractRecordFillingDates, getTodayISODate, getYesterdayISODate } from "../utils";
import { StatusConfigModal } from "./StatusConfigModal";
import { DeduplicationModal } from "./DeduplicationModal";
import { EditableTextCell } from "./EditableTextCell";
import { FiltroTratativasModal } from "./FiltroTratativasModal";
import { autoDetectSortType, sortRecordsByCriteria } from "../utils/recordSorting";

interface ClientTableProps {
  schema: ReportSchema;
  records: DynamicRecord[];
  userRole?: UserRole;
  currentUser?: string | null;
  onUpdateRecord: (id: string, updatedData: Record<string, string>) => void;
  onUpdateRecordsBulk: (ids: string[], updatedData: Record<string, string>) => void;
  onDeleteRecords?: (ids: string[]) => void;
  onUpdateSchema?: (updatedSchema: ReportSchema) => void;
  onDeduplicateGuide?: (columnId: string, columnLabel: string, idsToDelete: string[], removedRecords: DynamicRecord[]) => void;
  onApplyGlobalSort?: (schemaId: string, config: GlobalSortConfig | null, reorderedRecordIds: string[]) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ClientTable({
  schema,
  records,
  userRole = 'editor',
  currentUser,
  onUpdateRecord,
  onUpdateRecordsBulk,
  onDeleteRecords,
  onUpdateSchema,
  onDeduplicateGuide,
  onApplyGlobalSort,
  showToast
}: ClientTableProps) {
  const canEdit = userRole === 'admin' || userRole === 'editor';
  const isAdmin = userRole === 'admin';

  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [isStatusConfigOpen, setIsStatusConfigOpen] = useState(false);
  const [isDeduplicationOpen, setIsDeduplicationOpen] = useState(false);
  const [isFiltroTratativasOpen, setIsFiltroTratativasOpen] = useState(false);
  const [bulkEdits, setBulkEdits] = useState<Record<string, string>>({});
  const [countDateFilter, setCountDateFilter] = useState<string>("all");
  const [filterTableByCountDate, setFilterTableByCountDate] = useState<boolean>(false);
  const [isCountPanelExpanded, setIsCountPanelExpanded] = useState<boolean>(true);

  const rowsPerPage = 50;

  // Active status configs (stored on schema or fallback to default)
  const statusConfigs = useMemo<StatusConfigItem[]>(() => {
    if (schema?.statusConfigs && schema.statusConfigs.length > 0) {
      return schema.statusConfigs;
    }
    return defaultStatusConfigs;
  }, [schema?.statusConfigs]);

  // Options for Status column
  const statusOptions = useMemo(() => {
    const opts = statusConfigs.map(c => c.motivo);
    return ["-", ...opts];
  }, [statusConfigs]);

  const getFieldWidthClass = (field: FieldDef) => {
    const idLower = (field.id || '').toLowerCase();
    const labelLower = (field.label || '').toLowerCase();

    if (idLower === 'status' || labelLower === 'status' || idLower.includes('status') || labelLower.includes('status')) {
      return 'min-w-[280px] w-[300px]';
    }
    if (idLower.includes('observa') || labelLower.includes('observa')) {
      return 'min-w-[380px] w-[420px]';
    }
    if (idLower.includes('nome') || labelLower.includes('nome')) {
      return 'min-w-[180px] max-w-[300px]';
    }
    return 'min-w-[120px] max-w-[220px]';
  };

  // Ensure fixed columns at the end of schema fields
  const fields = useMemo(() => {
    return ensureFixedColumns(schema?.fields || [], statusOptions);
  }, [schema?.fields, statusOptions]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [schema?.id, searchTerm, columnFilters]);

  const handleSort = (fieldId: string) => {
    if (sortField === fieldId) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(fieldId);
      setSortOrder("asc");
    }
  };

  const handleColumnFilterChange = (fieldId: string, val: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [fieldId]: val
    }));
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setColumnFilters({});
  };

  const hasActiveFilters = searchTerm !== "" || Object.values(columnFilters).some(v => typeof v === "string" && v.trim() !== "");

  const getCellValue = (recordData: Record<string, string>, field: FieldDef): string => {
    if (!recordData || !field) return "-";
    // 1. Authoritative check on exact field.id
    if (field.id && recordData[field.id] !== undefined) {
      return recordData[field.id] === "" ? "-" : fixMojibake(recordData[field.id]);
    }
    // 2. Secondary check on field.label
    if (field.label && recordData[field.label] !== undefined) {
      return recordData[field.label] === "" ? "-" : fixMojibake(recordData[field.label]);
    }
    // 3. Normalized fallback for unmapped original CSV columns
    const labelText = field.label || field.id || "";
    if (!labelText) return "-";
    const normLabel = labelText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    for (const [key, val] of Object.entries(recordData)) {
      if (key) {
        const normKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        if (normKey === normLabel && val !== undefined) {
          return val === "" ? "-" : fixMojibake(val);
        }
      }
    }
    return "-";
  };

  const getRowColorClass = (item: DynamicRecord) => {
    const isSelected = selectedIds.includes(item.id);
    if (isSelected) {
      return "bg-[#D1EED5] hover:bg-[#C2E8C7] transition-colors font-medium";
    }

    const isFinal = isRecordFinalized(item, fields);
    const { isWorked, subMotivo } = getRecordStatus(item, fields, statusConfigs);

    if (!isWorked) {
      return isFinal ? "bg-[#F5F4F0] opacity-90 hover:bg-[#EDECE7] transition-colors" : "hover:bg-white/60 transition-colors";
    }

    // 1. Sem Sucesso -> Soft Pastel Red
    if (subMotivo === 'Sem Sucesso') {
      return isFinal ? "bg-[#FDECEC] opacity-90 hover:bg-[#FCD8D8] transition-colors" : "bg-[#FCE8E6] hover:bg-[#F9D5D2] transition-colors";
    }

    // 2. Sem Resposta / Pending -> Soft Pastel Yellow
    if (subMotivo === 'Sem Resposta') {
      return isFinal ? "bg-[#FEF9E7] opacity-90 hover:bg-[#FDF2C7] transition-colors" : "bg-[#FFF8E1] hover:bg-[#FFF0B3] transition-colors";
    }

    // 3. Com Sucesso -> Soft Pastel Green
    if (subMotivo === 'Sucesso') {
      return isFinal ? "bg-[#ECF7EE] opacity-90 hover:bg-[#D8EEDC] transition-colors" : "bg-[#E6F4EA] hover:bg-[#C8E6C9] transition-colors";
    }

    return isFinal ? "bg-[#F5F4F0] opacity-90 hover:bg-[#EDECE7] transition-colors" : "hover:bg-white/60 transition-colors";
  };

  const getReportRecords = (allRecs: DynamicRecord[], schemaId: string) => {
    if (!allRecs || allRecs.length === 0) return [];
    
    return allRecs.filter(r => {
      if (r && r.reportId === schemaId) return true;
      if (r && (!r.reportId || r.reportId === 'default' || r.reportId === '1')) {
        if (!schemaId || schemaId === 'default' || schemaId === '1') return true;
      }
      return false;
    });
  };

  // Detected dates available in records of this guide
  const availableDatesData = useMemo(() => {
    const allReportRecords = getReportRecords(records, schema?.id || '');
    const dateCounts: Record<string, number> = {};
    
    allReportRecords.forEach(r => {
      const dates = extractRecordFillingDates(r);
      dates.forEach(d => {
        dateCounts[d] = (dateCounts[d] || 0) + 1;
      });
    });

    const todayISO = getTodayISODate();
    const yesterdayISO = getYesterdayISODate();

    const sortedDates = Object.keys(dateCounts).sort().reverse();
    
    return {
      dates: sortedDates,
      dateCounts,
      todayISO,
      yesterdayISO,
      todayCount: dateCounts[todayISO] || 0,
      yesterdayCount: dateCounts[yesterdayISO] || 0,
    };
  }, [records, schema?.id]);

  const filteredAndSortedRecords = useMemo(() => {
    let result = getReportRecords(records, schema?.id || '');

    // 1. Proposal filter (All, Active, Finalized)
    const proposalFilterVal = columnFilters['_finalizada'];
    if (proposalFilterVal === 'finalized') {
      result = result.filter(record => isRecordFinalized(record, fields));
    } else if (proposalFilterVal === 'active') {
      result = result.filter(record => !isRecordFinalized(record, fields));
    }

    // 2. Optional: Date of filling filter linked to count filter
    if (filterTableByCountDate && countDateFilter !== 'all') {
      const targetISO = normalizeDateStringToISO(countDateFilter);
      if (targetISO) {
        result = result.filter(record => {
          const dates = extractRecordFillingDates(record);
          return dates.includes(targetISO);
        });
      }
    }

    // 3. Global search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(record => {
        const isFinal = isRecordFinalized(record, fields);
        const proposalStatusText = isFinal ? "finalizada" : "aberta";
        if (proposalStatusText.includes(lowerSearch)) return true;

        return fields.some(f => {
          const val = getCellValue(record?.data || {}, f);
          return val && val !== '-' && val.toLowerCase().includes(lowerSearch);
        }) || Object.values(record?.data || {}).some(val => val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch));
      });
    }

    // 4. Per-column filters (excluding _finalizada which is handled above)
    const activeColFilters = Object.entries(columnFilters).filter(
      ([k, val]) => k !== '_finalizada' && typeof val === 'string' && val.trim() !== ""
    ) as [string, string][];

    if (activeColFilters.length > 0) {
      result = result.filter(record => {
        return activeColFilters.every(([fieldId, filterVal]) => {
          const targetField = fields.find(f => f.id === fieldId);
          if (!targetField) return true;
          const cellVal = getCellValue(record?.data || {}, targetField);
          if (!cellVal || cellVal === '-') return false;
          return typeof cellVal === 'string' && cellVal.toLowerCase().includes(filterVal.toLowerCase());
        });
      });
    }

    // 5. Sorting
    if (sortField) {
      // Local temporary sorting by user clicking column header
      const sortFieldDef = fields.find(f => f && f.id === sortField);
      result = sortRecordsByCriteria(result, fields, {
        fieldId: sortField,
        order: sortOrder,
        sortType: autoDetectSortType(result, sortFieldDef, sortField),
        emptyPosition: 'last'
      });
    } else if (schema?.globalSortConfig) {
      // Priority Treat Filter set by Admin (Global to all operators)
      result = sortRecordsByCriteria(result, fields, schema.globalSortConfig);
    } else {
      // Sort by original import/database order to keep record position fixed
      result.sort((a, b) => {
        const orderA = a?.data?._order !== undefined ? Number(a.data._order) : Infinity;
        const orderB = b?.data?._order !== undefined ? Number(b.data._order) : Infinity;
        if (orderA !== orderB) return orderA - orderB;
        return a.id.localeCompare(b.id);
      });
    }

    return result;
  }, [records, searchTerm, columnFilters, sortField, sortOrder, schema?.id, schema?.globalSortConfig, fields, filterTableByCountDate, countDateFilter]);

  // Executive summary calculation based strictly on active (non-finalized) records and the Status column
  const reportStats = useMemo(() => {
    const allReportRecords = getReportRecords(records, schema?.id || '');
    return calculateExecutiveStatusSummary(allReportRecords, fields, statusConfigs);
  }, [records, schema?.id, fields, statusConfigs]);

  const observacaoBreakdown = useMemo(() => {
    const allReportRecords = getReportRecords(records, schema?.id || '');
    const obsField = fields.find(f => f.id === 'observacaoFinal' || f.label.toLowerCase().includes('observa'));
    
    if (!obsField) return { counts: [], total: 0, targetDateISO: null, dateFormatted: null, treatedClientsCount: 0 };

    const targetDateISO = countDateFilter !== 'all' ? normalizeDateStringToISO(countDateFilter) : null;

    const recordsToAnalyze = targetDateISO
      ? allReportRecords.filter(r => {
          const dates = extractRecordFillingDates(r);
          return dates.includes(targetDateISO);
        })
      : allReportRecords;

    const counts: Record<string, number> = {};
    let total = 0;
    
    recordsToAnalyze.forEach(r => {
      let val = getCellValue(r.data, obsField);
      if (!val || val === '-' || val.trim() === '') {
        return;
      }
      val = val.trim();
      counts[val] = (counts[val] || 0) + 1;
      total++;
    });

    const sortedCounts = Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    return { 
      counts: sortedCounts, 
      total, 
      targetDateISO,
      dateFormatted: targetDateISO ? formatISODateToBR(targetDateISO) : null,
      treatedClientsCount: recordsToAnalyze.filter(r => {
        const v = getCellValue(r.data, obsField);
        return v && v !== '-' && v.trim() !== '';
      }).length
    };
  }, [records, schema?.id, fields, countDateFilter]);

  const formatPct = (val: number, total: number) => {
    if (total === 0) return "0,00%";
    return ((val / total) * 100).toFixed(2).replace('.', ',') + "%";
  };

  const copySummary = () => {
    const text = `Resumo Executivo (${schema.name})
• Total da base: ${reportStats.totalBase.toLocaleString('pt-BR')} clientes
• Base trabalhada: ${reportStats.baseTrabalhada.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.baseTrabalhada, reportStats.totalBase)})
• Contato efetivo: ${reportStats.contatoEfetivo.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.contatoEfetivo, reportStats.baseTrabalhada)}) [Sucesso: ${reportStats.comSucesso}]
• Sem contato efetivo: ${reportStats.semContatoEfetivo.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.semContatoEfetivo, reportStats.baseTrabalhada)}) [Sem Sucesso: ${reportStats.semSucesso} | Sem Resposta: ${reportStats.semResposta}]
• Pendências de discagem: ${reportStats.pendenciasDiscagem.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.pendenciasDiscagem, reportStats.totalBase)})${reportStats.finalizadasCount > 0 ? `\n• Propostas marcadas como finalizadas: ${reportStats.finalizadasCount.toLocaleString('pt-BR')}` : ''}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback("Copiado!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  };

  const copyObsTable = () => {
    const dateLabel = observacaoBreakdown.dateFormatted ? ` - ${observacaoBreakdown.dateFormatted}` : " - Todas as Datas";
    let text = `Contagem (Observação Final - ${schema.name}${dateLabel})\nObservação Final\tQtd.\n`;
    observacaoBreakdown.counts.forEach(c => text += `${c.label}\t${c.count}\n`);
    text += `Total Geral\t${observacaoBreakdown.total}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback("Copiado!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  };

  const handleSaveStatusConfigs = (newConfigs: StatusConfigItem[]) => {
    const updatedSchema: ReportSchema = {
      ...schema,
      statusConfigs: newConfigs,
      fields: ensureFixedColumns(schema.fields, ["-", ...newConfigs.map(c => c.motivo)])
    };
    if (onUpdateSchema) {
      onUpdateSchema(updatedSchema);
    }
  };

  const totalPages = Math.ceil(filteredAndSortedRecords.length / rowsPerPage);
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedRecords.length && filteredAndSortedRecords.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedRecords.map((r) => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selId) => selId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const exportSelected = () => {
    const toExport = selectedIds.length > 0
      ? filteredAndSortedRecords.filter((r) => selectedIds.includes(r.id))
      : filteredAndSortedRecords;
    
    const csvContent = exportDynamicCSV(toExport, { ...schema, fields });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `export_${schema.name.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyBulkEdit = (fieldId: string) => {
    if (selectedIds.length === 0) return;
    let value = bulkEdits[fieldId];
    
    // Auto-timestamp for attempts if user typed 'agora' or 'now'
    if (value && value.toLowerCase() === 'agora') {
      value = formatCurrentDateTime();
    }
    
    if (value !== undefined && value !== "") {
      onUpdateRecordsBulk(selectedIds, { [fieldId]: value });
      setSelectedIds([]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#E4E3E0]">
      {/* Contagem (Observação Final) com Filtro por Dia de Preenchimento - Compacta para não atrapalhar */}
      <div className="bg-white border-b-2 border-[#141414] px-2.5 py-1.5 shrink-0">
        <div className="w-full">
          {/* Container Compacto de Observação Final */}
          <div className="bg-[#F2F1EB] p-2 border border-[#141414] shadow-[1px_1px_0px_rgba(0,0,0,1)] flex flex-col transition-all">
            
            {/* Top Bar: Título & Ações Principais Compactas */}
            <div className="flex flex-wrap justify-between items-center gap-1.5 pb-1 border-b border-[#141414]/70 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCountPanelExpanded(prev => !prev)}
                  className="flex items-center gap-1 text-[#141414] hover:text-black cursor-pointer select-none font-black text-[11px] uppercase tracking-wider"
                  title={isCountPanelExpanded ? "Recolher painel de contagem" : "Expandir painel de contagem"}
                >
                  <BarChart3 size={13} className="text-[#141414]" />
                  <span>Contagem (Obs. Final) — {schema.name}</span>
                  {isCountPanelExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <span className="text-[10px] font-mono font-bold bg-[#141414] text-white px-1.5 py-0.2 rounded-none">
                  Total: {observacaoBreakdown.total}
                </span>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsStatusConfigOpen(true)}
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-[#141414] text-[#141414] text-[9px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-all active:translate-y-0.5 cursor-pointer"
                    title="Gerenciar motivos e submotivos do status"
                  >
                    <Settings2 size={10} />
                    <span>Configurar</span>
                  </button>
                  <button
                    onClick={copyObsTable}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white border border-[#141414] text-[#141414] text-[9px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-all active:translate-y-0.5 cursor-pointer"
                    title="Copiar dados da contagem formatados para área de transferência"
                  >
                    <ClipboardCopy size={10} />
                    <span>{copyFeedback || "Copiar"}</span>
                  </button>
                </div>
              )}
            </div>

            {isCountPanelExpanded && (
              <>
                {/* Toolbar de Filtro por Data de Preenchimento / Produtividade Diária Compacta (Apenas Administrador) */}
                {isAdmin && (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 my-1 px-1.5 py-1 bg-white border border-[#141414] text-xs shrink-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-0.5 mr-0.5">
                        <Calendar size={11} className="text-[#141414]" />
                        Data:
                      </span>

                      {/* Botão: Geral (Todas as Datas) */}
                      <button
                        type="button"
                        onClick={() => setCountDateFilter("all")}
                        className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase transition-all border cursor-pointer ${
                          countDateFilter === "all"
                            ? "bg-[#141414] text-white border-[#141414]"
                            : "bg-[#F2F1EB] text-slate-800 border-[#141414] hover:bg-slate-200"
                        }`}
                      >
                        Todas
                      </button>

                      {/* Botão Rápido: Hoje */}
                      <button
                        type="button"
                        onClick={() => setCountDateFilter(availableDatesData.todayISO)}
                        className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase transition-all border flex items-center gap-1 cursor-pointer ${
                          countDateFilter === availableDatesData.todayISO
                            ? "bg-emerald-800 text-white border-emerald-950"
                            : "bg-emerald-50 text-emerald-900 border-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        <span>Hoje ({formatISODateToBR(availableDatesData.todayISO)})</span>
                        {availableDatesData.todayCount > 0 && (
                          <span className="text-[8px] bg-emerald-700/30 text-emerald-950 px-1 rounded-none font-bold">
                            {availableDatesData.todayCount}
                          </span>
                        )}
                      </button>

                      {/* Botão Rápido: Ontem */}
                      <button
                        type="button"
                        onClick={() => setCountDateFilter(availableDatesData.yesterdayISO)}
                        className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase transition-all border flex items-center gap-1 cursor-pointer ${
                          countDateFilter === availableDatesData.yesterdayISO
                            ? "bg-slate-800 text-white border-slate-950"
                            : "bg-[#F2F1EB] text-slate-700 border-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span>Ontem</span>
                        {availableDatesData.yesterdayCount > 0 && (
                          <span className="text-[8px] bg-slate-300 text-slate-800 px-1 rounded-none font-bold">
                            {availableDatesData.yesterdayCount}
                          </span>
                        )}
                      </button>

                      {/* Dropdown de Todas as Datas Detectadas */}
                      <select
                        value={countDateFilter}
                        onChange={(e) => setCountDateFilter(e.target.value)}
                        className="bg-[#F2F1EB] border border-[#141414] text-[9px] font-mono font-bold px-1 py-0.5 outline-none text-[#141414] cursor-pointer max-w-[130px]"
                      >
                        <option value="all">Outras ({availableDatesData.dates.length})...</option>
                        {availableDatesData.dates.map((d) => (
                          <option key={`date_opt_${d}`} value={d}>
                            {formatISODateToBR(d)} ({availableDatesData.dateCounts[d]})
                          </option>
                        ))}
                      </select>

                      {/* Seletor Livre de Calendário */}
                      <input
                        type="date"
                        value={countDateFilter !== "all" ? countDateFilter : ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            setCountDateFilter(e.target.value);
                          }
                        }}
                        className="bg-white border border-[#141414] text-[9px] font-mono font-bold px-1 py-0.5 outline-none text-[#141414] cursor-pointer max-w-[105px]"
                        title="Selecionar qualquer data no calendário"
                      />
                    </div>

                    {/* Opção de sincronizar e filtrar a listagem principal pela data selecionada */}
                    <div className="flex items-center gap-1.5">
                      {countDateFilter !== "all" && (
                        <label className="flex items-center gap-1 cursor-pointer text-[9px] font-bold text-slate-800 select-none bg-amber-50 px-1 py-0.5 border border-amber-800">
                          <input
                            type="checkbox"
                            checked={filterTableByCountDate}
                            onChange={(e) => setFilterTableByCountDate(e.target.checked)}
                            className="rounded-none border border-[#141414] text-[#141414] focus:ring-0 cursor-pointer h-2.5 w-2.5"
                          />
                          <span>Filtrar tabela abaixo</span>
                        </label>
                      )}

                      {countDateFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCountDateFilter("all");
                            setFilterTableByCountDate(false);
                          }}
                          className="flex items-center gap-0.5 px-1 py-0.5 bg-rose-100 border border-rose-900 text-rose-950 text-[9px] font-bold hover:bg-rose-200 transition-colors cursor-pointer"
                          title="Voltar para contagem geral de todas as datas"
                        >
                          <X size={9} />
                          <span>Limpar</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Indicador de Status do Filtro de Data Ativo (Apenas se filtrado por admin) */}
                {isAdmin && observacaoBreakdown.targetDateISO && (
                  <div className="mb-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-800 text-[9px] font-mono font-bold text-emerald-950 flex items-center justify-between">
                    <span>
                      ★ Produtividade de <strong>{observacaoBreakdown.dateFormatted}</strong>: {observacaoBreakdown.total} ações ({observacaoBreakdown.treatedClientsCount} clientes)
                    </span>
                    {filterTableByCountDate && (
                      <span className="text-[8px] text-emerald-800 uppercase tracking-wider">
                        [Tabela Filtrada]
                      </span>
                    )}
                  </div>
                )}
                
                {/* Tabela de Contagem Reduzida com Scroll Suave */}
                <div className="max-h-32 sm:max-h-36 overflow-y-auto border border-[#141414] bg-white">
                  <table className="w-full text-[11px] text-left font-sans">
                    <thead className="bg-[#E4E3E0] text-[#141414] text-[9px] uppercase font-bold border-b border-[#141414] sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-1 border-r border-[#141414]">Observação Final</th>
                        <th className="px-2 py-1 w-20 text-right">Qtd.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {observacaoBreakdown.counts.length > 0 && observacaoBreakdown.counts.map((item, idx) => (
                        <tr key={`obs_${item.label}_${idx}`} className="hover:bg-[#F9F8F6] transition-colors">
                          <td className="px-2 py-0.5 font-medium text-slate-800 text-[11px]">{item.label}</td>
                          <td className="px-2 py-0.5 text-right font-mono font-bold text-slate-900 text-[11px]">{item.count}</td>
                        </tr>
                      ))}
                      {observacaoBreakdown.counts.length === 0 && (
                        <tr key="empty-obs">
                          <td colSpan={2} className="px-2 py-2 text-center text-slate-500 italic text-[10px]">
                            {observacaoBreakdown.targetDateISO 
                              ? `Nenhum preenchimento para ${observacaoBreakdown.dateFormatted}.`
                              : "Nenhuma observação preenchida."
                            }
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#E4E3E0] font-bold border border-t-0 border-[#141414] text-[10px] flex justify-between px-2 py-1 shrink-0">
                  <span className="uppercase font-bold tracking-wider">
                    {observacaoBreakdown.targetDateISO ? `Total em ${observacaoBreakdown.dateFormatted}` : "Total Geral"}
                  </span>
                  <span className="font-mono font-bold">{observacaoBreakdown.total}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Controls & Global Search */}
      <div className="px-2.5 py-1.5 border-b-2 border-[#141414] bg-[#F2F1EB] shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full max-w-xs flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder={`Buscar global em ${schema.name}...`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1 border-2 border-[#141414] bg-white text-xs font-mono text-[#141414] focus:outline-none"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-2 py-1 bg-amber-100 border-2 border-amber-900 text-amber-950 text-[10px] font-bold uppercase hover:bg-amber-200 transition-colors shrink-0"
                title="Limpar todos os filtros"
              >
                <RotateCcw size={12} />
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsFiltroTratativasOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-300 border-2 border-[#141414] text-[#141414] text-[11px] font-black uppercase hover:bg-amber-400 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 cursor-pointer"
                title="Filtro de Tratativas: Ordenar e priorizar a base para todos os operadores"
              >
                <ArrowUpDown size={12} className="text-[#141414]" />
                <span>Filtro de Tratativas</span>
                {schema.globalSortConfig && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse ml-0.5" title="Filtro de priorização ativo na base" />
                )}
              </button>
            )}
            {isAdmin && onDeduplicateGuide && (
              <button
                type="button"
                onClick={() => setIsDeduplicationOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 border-2 border-[#141414] text-[#141414] text-[11px] font-bold uppercase hover:bg-amber-300 transition-colors shadow-2xs cursor-pointer"
                title="Remover registros duplicados com base em uma coluna selecionada"
              >
                <CopySlash size={12} className="text-amber-800" />
                Remover Duplicatas
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsStatusConfigOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border-2 border-[#141414] text-[#141414] text-[11px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors cursor-pointer"
              >
                <Settings2 size={12} />
                Gerenciar Status
              </button>
            )}
            <button
              type="button"
              onClick={exportSelected}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border-2 border-[#141414] text-[#141414] text-[11px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors cursor-pointer"
            >
              <Download size={12} />
              Exportar
            </button>
            {isAdmin && selectedIds.length > 0 && onDeleteRecords && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Tem certeza que deseja excluir os registros selecionados?")) {
                    onDeleteRecords(selectedIds);
                    setSelectedIds([]);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-100 border-2 border-red-900 text-red-900 text-[11px] font-bold uppercase hover:bg-red-900 hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                Excluir ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Global Sort (Filtro de Tratativas) Active Notification Pill */}
        {schema.globalSortConfig && (
          <div className="mt-1.5 flex items-center justify-between px-2.5 py-1 bg-amber-100 border border-amber-900 text-[11px] font-mono text-amber-950">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.2 bg-[#141414] text-amber-300 font-bold text-[9px] uppercase tracking-wider">
                Prioridade ADM
              </span>
              <span>
                Filtro de Tratativas ativo: <strong>{schema.globalSortConfig.description || `${schema.globalSortConfig.fieldId} (${schema.globalSortConfig.order.toUpperCase()})`}</strong>
              </span>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setIsFiltroTratativasOpen(true)}
                className="text-[10px] text-amber-900 underline font-bold hover:text-black cursor-pointer"
              >
                Alterar Regra
              </button>
            ) : (
              <span className="text-[9px] text-amber-800 italic">
                (Ordem padronizada pelo Administrador)
              </span>
            )}
          </div>
        )}

        {/* Dynamic Bulk Action Bar */}
        {canEdit && selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border-2 border-[#141414] shadow-[2px_2px_0px_rgba(0,0,0,1)] mt-1.5">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#141414]">
              {`Ação em Massa (${selectedIds.length}):`}
            </span>
            
            {/* Quick Proposal Status Bulk Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  selectedIds.forEach(id => {
                    onUpdateRecord(id, { finalizada: "true" });
                  });
                  setSelectedIds([]);
                }}
                className="flex items-center gap-1 bg-rose-100 text-rose-900 border-2 border-rose-900 px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-rose-900 hover:text-white transition-colors"
                title="Marcar todos os selecionados como Finalizados"
              >
                <CheckCircle2 size={11} />
                <span>Finalizar ({selectedIds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  selectedIds.forEach(id => {
                    onUpdateRecord(id, { finalizada: "false" });
                  });
                  setSelectedIds([]);
                }}
                className="flex items-center gap-1 bg-white text-slate-800 border-2 border-[#141414] px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors"
                title="Reabrir todos os selecionados (marcar como Abertos)"
              >
                <Circle size={10} />
                <span>Reabrir ({selectedIds.length})</span>
              </button>
            </div>

            <div className="h-4 w-[1px] bg-slate-300 mx-0.5" />

            {fields.filter(f => f && !f.readOnly).map(field => (
              <div key={`bulk_${field.id}`} className="flex items-center gap-1 bg-[#F2F1EB] border-2 border-[#141414] pl-1 pr-1 py-0.5">
                {field.type === 'list' ? (
                  <select
                    className="bg-transparent text-[10px] font-mono font-bold text-[#141414] outline-none max-w-[130px] cursor-pointer"
                    value={bulkEdits[field.id] || ""}
                    onChange={(e) => setBulkEdits({...bulkEdits, [field.id]: e.target.value})}
                  >
                    <option value="" disabled>Alterar {field.label || field.id}</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      type="text"
                      list={field.options && field.options.length > 0 ? `datalist_bulk_${field.id}` : undefined}
                      placeholder={`Novo ${field.label || field.id}`}
                      value={bulkEdits[field.id] || ""}
                      onChange={(e) => setBulkEdits({...bulkEdits, [field.id]: e.target.value})}
                      className="bg-white border border-[#141414] px-1 text-[10px] font-mono outline-none max-w-[130px]"
                    />
                    {field.options && field.options.length > 0 && (
                      <datalist id={`datalist_bulk_${field.id}`}>
                        {field.options.filter(o => o !== "-").map((opt, oIdx) => (
                          <option key={`bulk_opt_${opt}_${oIdx}`} value={opt} />
                        ))}
                      </datalist>
                    )}
                  </>
                )}
                <button
                  onClick={() => applyBulkEdit(field.id)}
                  className="bg-[#141414] text-white p-0.5 hover:bg-black transition-colors"
                  title="Aplicar aos selecionados"
                >
                  <CheckSquare size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table Area with Per-Column Filters */}
      <div className="flex-1 overflow-auto bg-white border-y-2 border-[#141414]">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-[#F2F1EB] text-[#141414] uppercase text-xs z-10 font-bold border-b-2 border-[#141414]">
            {/* Header Titles */}
            <tr>
              <th className="w-8 px-2 py-1.5 border-r border-[#141414]/40 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredAndSortedRecords.length && filteredAndSortedRecords.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded-none border-2 border-[#141414] text-[#141414] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                />
              </th>
              {/* Proposal Status Column Header */}
              <th
                className="px-2.5 py-1.5 cursor-pointer hover:bg-[#C5C4C0] border-r border-[#141414]/40 transition-colors min-w-[125px] w-[130px]"
                onClick={() => handleSort('_finalizada')}
              >
                <div className="flex items-center justify-between gap-1 font-extrabold tracking-wide">
                  <span>Status Proposta</span>
                  {sortField === '_finalizada' && <span>{sortOrder === "asc" ? "▲" : "▼"}</span>}
                </div>
              </th>
              {fields.map(field => (
                <th key={field.id} className={`px-2.5 py-1.5 cursor-pointer hover:bg-[#C5C4C0] border-r border-[#141414]/40 transition-colors ${getFieldWidthClass(field)}`} onClick={() => handleSort(field.id)}>
                  <div className="flex items-center justify-between gap-1 font-extrabold tracking-wide">
                    <span>{field.label || field.id}</span>
                    {sortField === field.id && <span>{sortOrder === "asc" ? "▲" : "▼"}</span>}
                  </div>
                </th>
              ))}
            </tr>

            {/* Per-Column Filter Input Row */}
            <tr className="bg-[#E4E3E0] border-t border-[#141414]/40">
              <th className="px-1.5 py-0.5 text-center border-r border-[#141414]/40">
                <Filter size={12} className="inline text-slate-600" />
              </th>
              {/* Proposal Status Filter Dropdown */}
              <th className="px-1.5 py-0.5 border-r border-[#141414]/40 min-w-[125px] w-[130px]">
                <select
                  value={columnFilters['_finalizada'] || "all"}
                  onChange={(e) => handleColumnFilterChange('_finalizada', e.target.value)}
                  className="w-full bg-white border border-[#141414] text-[10px] font-mono px-1 py-0.5 outline-none font-bold focus:border-[#141414] cursor-pointer"
                >
                  <option value="all">Todas</option>
                  <option value="active">Apenas Abertas</option>
                  <option value="finalized">Apenas Finalizadas</option>
                </select>
              </th>
              {fields.map(field => (
                <th key={`filter_${field.id}`} className={`px-1.5 py-0.5 border-r border-[#141414]/40 ${getFieldWidthClass(field)}`}>
                  <input
                    type="text"
                    placeholder={`Filtrar ${field.label || field.id}...`}
                    value={columnFilters[field.id] || ""}
                    onChange={(e) => handleColumnFilterChange(field.id, e.target.value)}
                    className="w-full bg-white border border-[#141414] text-xs font-mono px-1.5 py-0.5 outline-none font-normal focus:border-[#141414] focus:ring-1 focus:ring-[#141414]"
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#141414]/30 text-xs text-[#141414] bg-[#E4E3E0]">
            {paginatedRecords.length === 0 && (
              <tr key="empty-row">
                <td colSpan={fields.length + 2} className="px-6 py-8 text-center text-slate-600 bg-white/20">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase">Nenhum registro encontrado nesta base.</span>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="text-xs font-mono font-bold text-blue-900 underline hover:text-black"
                      >
                        Limpar filtros de busca
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {paginatedRecords.length > 0 && paginatedRecords.map((item) => (
              <tr
                key={`row_${item.id}`}
                className={getRowColorClass(item)}
              >
                <td className="px-2 py-1 border-r border-[#141414]/20 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded-none border-2 border-[#141414] text-[#141414] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                  />
                </td>
                
                {/* Proposal Status Cell */}
                <td className="px-2 py-1 border-r border-[#141414]/20 text-center min-w-[125px] w-[130px]">
                  {(() => {
                    const isFinal = isRecordFinalized(item, fields);
                    return (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => onUpdateRecord(item.id, { finalizada: isFinal ? "false" : "true" })}
                        className={`w-full flex items-center justify-center gap-1 px-1.5 py-0.5 border text-[10px] font-mono font-bold uppercase transition-all shadow-2xs ${
                          isFinal
                            ? "bg-rose-100 text-rose-900 border-rose-400 hover:bg-rose-200 cursor-pointer"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-black hover:border-slate-700 cursor-pointer"
                        } ${!canEdit ? "opacity-70 cursor-default" : ""}`}
                        title={
                          isFinal
                            ? "Proposta finalizada (desconsiderada do Resumo Executivo). Clique para reabrir."
                            : "Proposta em aberto. Clique para marcar como Finalizada."
                        }
                      >
                        {isFinal ? (
                          <>
                            <CheckCircle2 size={11} className="text-rose-700 shrink-0" />
                            <span>Finalizada</span>
                          </>
                        ) : (
                          <>
                            <Circle size={10} className="text-slate-400 shrink-0" />
                            <span>Aberta</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </td>

                {fields.map(field => {
                  const cellVal = getCellValue(item?.data || {}, field);
                  const isHighlight = field.id === 'nome' || field.id === 'cpf' || (field.label && field.label.toLowerCase().includes('nome')) || (field.label && field.label.toLowerCase().includes('cpf'));
                  return (
                    <td key={field.id} className={`px-2.5 py-1 border-r border-[#141414]/20 font-mono text-xs ${getFieldWidthClass(field)}`} title={cellVal}>
                      <div className="w-full text-xs" key={`cell_container_${field.id}_${item.id}`}>
                        {field.readOnly || !canEdit ? (
                          <span key={`span_${field.id}_${item.id}`} className={isHighlight ? 'font-bold text-[#141414]' : 'text-slate-800'}>
                            {cellVal}
                          </span>
                        ) : (
                          field.type === 'list' ? (
                            <select
                              key={`select_${field.id}_${item.id}`}
                              className="bg-transparent text-[#141414] outline-none font-bold cursor-pointer w-full text-xs py-0.5"
                              value={cellVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updatePayload: Record<string, string> = { [field.id]: val };
                                if (field.label && field.label !== field.id) {
                                  updatePayload[field.label] = val;
                                }

                                // Smart sync when setting Observação Final (never touches Status Proposta/finalizada)
                                const isObsField = field.id === 'observacaoFinal' || (field.label && field.label.toLowerCase().includes('observa'));
                                if (isObsField) {
                                  const currentStatus = item?.data?.status || item?.data?.Status || '-';
                                  
                                  if (val === 'Proposta finalizada/paga') {
                                    if (currentStatus === '-' || !currentStatus) {
                                      updatePayload.status = 'Com Sucesso';
                                      updatePayload.Status = 'Com Sucesso';
                                    }
                                  } else if (val === 'Proposta cancelada' || val === 'Proposta reprovada') {
                                    if (currentStatus === '-' || !currentStatus) {
                                      updatePayload.status = 'Sem Sucesso';
                                      updatePayload.Status = 'Sem Sucesso';
                                    }
                                  } else if (
                                    val === 'Link de formalização enviado/reenviado' ||
                                    val === 'Documentação apresentada' ||
                                    val === 'Dados corrigidos' ||
                                    val === 'Retorno à jornada' ||
                                    val === 'Proposta reapresentada' ||
                                    val === 'Sem interesse'
                                  ) {
                                    if (currentStatus === '-' || !currentStatus) {
                                      updatePayload.status = 'Com Sucesso';
                                      updatePayload.Status = 'Com Sucesso';
                                    }
                                  } else if (val === 'Contato sem sucesso') {
                                    if (currentStatus === '-' || !currentStatus) {
                                      updatePayload.status = 'Sem Sucesso';
                                      updatePayload.Status = 'Sem Sucesso';
                                    }
                                  } else if (val === 'Documentação pendente' || val === 'Aguardando') {
                                    if (currentStatus === '-' || !currentStatus) {
                                      updatePayload.status = 'Sem Resposta';
                                      updatePayload.Status = 'Sem Resposta';
                                    }
                                  }
                                }

                                onUpdateRecord(item.id, updatePayload);
                              }}
                            >
                              {(() => {
                                const optionsArray = ["-", ...(field.options || [])];
                                if (cellVal && cellVal !== "-" && !field.options?.includes(cellVal)) {
                                  optionsArray.push(cellVal);
                                }
                                return Array.from(new Set(optionsArray)).map((opt, oIdx) => (
                                  <option key={`${opt}_${oIdx}`} value={opt}>
                                    {opt}
                                  </option>
                                ));
                              })()}
                            </select>
                          ) : (
                            <EditableTextCell
                              key={`input_${field.id}_${item.id}`}
                              recordId={item.id}
                              fieldId={field.id}
                              fieldLabel={field.label}
                              initialValue={cellVal}
                              options={field.options}
                              onSave={(recId, updated) => {
                                const updatePayload = { ...updated };
                                if (field.label && field.label !== field.id && updated[field.id] !== undefined) {
                                  updatePayload[field.label] = updated[field.id];
                                }
                                onUpdateRecord(recId, updatePayload);
                              }}
                            />
                          )
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-t-2 border-[#141414] bg-[#F2F1EB] shrink-0">
        <span className="text-[10px] font-bold text-[#141414] uppercase tracking-wider">
          {filteredAndSortedRecords.length > 0 
            ? `Mostrando ${(currentPage - 1) * rowsPerPage + 1} a ${Math.min(currentPage * rowsPerPage, filteredAndSortedRecords.length)} de ${filteredAndSortedRecords.length}`
            : "Nenhum registro"
          }
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="px-2.5 py-0.5 bg-white border-2 border-[#141414] text-[#141414] text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#141414] hover:text-white transition-colors cursor-pointer"
          >
            Anterior
          </button>
          <div className="px-2.5 py-0.5 text-[11px] font-mono font-bold bg-[#141414] text-white border-2 border-[#141414]">
            {`${currentPage} / ${Math.max(1, totalPages)}`}
          </div>
          <button
            type="button"
            disabled={currentPage >= totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="px-2.5 py-0.5 bg-white border-2 border-[#141414] text-[#141414] text-[11px] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#141414] hover:text-white transition-colors cursor-pointer"
          >
            Próxima
          </button>
        </div>
      </div>

      {/* Modal for Status & Submotivo Configuration */}
      {isAdmin && (
        <StatusConfigModal
          isOpen={isStatusConfigOpen}
          onClose={() => setIsStatusConfigOpen(false)}
          statusConfigs={statusConfigs}
          onSave={handleSaveStatusConfigs}
        />
      )}

      {/* Modal for Deduplication */}
      {isAdmin && onDeduplicateGuide && (
        <DeduplicationModal
          isOpen={isDeduplicationOpen}
          onClose={() => setIsDeduplicationOpen(false)}
          schema={schema}
          records={records}
          onConfirmDeduplicate={(colId, colLabel, idsToDelete, removedRecs) => {
            onDeduplicateGuide(colId, colLabel, idsToDelete, removedRecs);
          }}
        />
      )}

      {/* Modal for Filtro de Tratativas (Admin Only) */}
      {isAdmin && isFiltroTratativasOpen && (
        <FiltroTratativasModal
          isOpen={isFiltroTratativasOpen}
          onClose={() => setIsFiltroTratativasOpen(false)}
          schema={schema}
          fields={fields}
          records={records}
          currentUser={currentUser || 'Admin'}
          onApplyGlobalSort={async (schemaId, config, reorderedRecordIds) => {
            if (onApplyGlobalSort) {
              await onApplyGlobalSort(schemaId, config, reorderedRecordIds);
            }
          }}
          showToast={showToast || ((msg) => console.log(msg))}
        />
      )}
    </div>
  );
}
