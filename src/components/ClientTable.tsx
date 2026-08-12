import React, { useState, useMemo } from "react";
import { Search, Download, Trash2, CheckSquare, ClipboardCopy, BarChart3 } from "lucide-react";
import { DynamicRecord, ReportSchema, UserRole } from "../types";
import { exportDynamicCSV, formatCurrentDateTime } from "../utils";

interface ClientTableProps {
  schema: ReportSchema;
  records: DynamicRecord[];
  userRole?: UserRole;
  onUpdateRecord: (id: string, updatedData: Record<string, string>) => void;
  onUpdateRecordsBulk: (ids: string[], updatedData: Record<string, string>) => void;
  onDeleteRecords?: (ids: string[]) => void;
}

export function ClientTable({
  schema,
  records,
  userRole = 'editor',
  onUpdateRecord,
  onUpdateRecordsBulk,
  onDeleteRecords,
}: ClientTableProps) {
  const canEdit = userRole === 'admin' || userRole === 'editor';

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [copyFeedback, setCopyFeedback] = useState("");
  const rowsPerPage = 50;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [schema.id, searchTerm]);

  const [bulkEdits, setBulkEdits] = useState<Record<string, string>>({});

  const handleSort = (fieldId: string) => {
    if (sortField === fieldId) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(fieldId);
      setSortOrder("asc");
    }
  };

  const filteredAndSortedRecords = useMemo(() => {
    let result = records.filter(r => r.reportId === schema.id);

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(record => 
        Object.values(record.data).some(val => val && val.toLowerCase().includes(lowerSearch))
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        const valA = (a.data[sortField] || "").toLowerCase();
        const valB = (b.data[sortField] || "").toLowerCase();
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [records, searchTerm, sortField, sortOrder, schema.id]);

  const reportStats = useMemo(() => {
    const allReportRecords = records.filter(r => r.reportId === schema.id);
    const totalBase = allReportRecords.length;

    const tentativaField = schema.fields.find(f => f.id.toLowerCase().includes('tentativa') || f.label.toLowerCase().includes('tentativa'));
    const statusField = schema.fields.find(f => f.id.toLowerCase().includes('status') || f.label.toLowerCase().includes('status'));
    const obsField = schema.fields.find(f => f.id.toLowerCase().includes('observa') || f.label.toLowerCase().includes('observa'));

    let baseTrabalhada = 0;
    let contatoEfetivo = 0;
    let semContatoEfetivo = 0;

    allReportRecords.forEach(r => {
      const hasTentativa = tentativaField && r.data[tentativaField.id] && r.data[tentativaField.id] !== '-' && r.data[tentativaField.id].trim() !== '';
      const hasStatus = statusField && r.data[statusField.id] && r.data[statusField.id] !== '-' && r.data[statusField.id].trim() !== '';
      const hasObs = obsField && r.data[obsField.id] && r.data[obsField.id] !== '-' && r.data[obsField.id].trim() !== '';
      
      if (hasTentativa || hasStatus || hasObs) {
        baseTrabalhada++;
        
        const obsValue = hasObs ? r.data[obsField.id].toLowerCase() : '';
        const statusValue = hasStatus ? r.data[statusField.id].toLowerCase() : '';
        
        let isContato = false;
        
        // Contato efetivo: positive progress outcomes or explicit success status
        const positiveKeywords = [
          "com sucesso",
          "desconto foi realizado",
          "finalizada/paga",
          "documentação apresentada",
          "link de formalização reenviado",
          "dados bancários corrigidos",
          "orientado voltar na jornada"
        ];

        if (positiveKeywords.some(kw => obsValue.includes(kw) || statusValue.includes(kw))) {
           isContato = true;
        }
        
        if (isContato) {
           contatoEfetivo++;
        } else {
           semContatoEfetivo++;
        }
      }
    });

    const pendenciasDiscagem = totalBase - baseTrabalhada;

    return {
      totalBase,
      baseTrabalhada,
      contatoEfetivo,
      semContatoEfetivo,
      pendenciasDiscagem
    };
  }, [records, schema]);

  const observacaoBreakdown = useMemo(() => {
    const allReportRecords = records.filter(r => r.reportId === schema.id);
    const obsField = schema.fields.find(f => f.id.toLowerCase().includes('observa') || f.label.toLowerCase().includes('observa'));
    
    if (!obsField) return { counts: [], total: 0 };

    const counts: Record<string, number> = {};
    let total = 0;
    
    allReportRecords.forEach(r => {
      let val = r.data[obsField.id];
      if (!val || val === '-' || val.trim() === '') {
        return;
      }
      val = val.trim();
      counts[val] = (counts[val] || 0) + 1;
      total++;
    });

    const sortedCounts = Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    return { counts: sortedCounts, total };
  }, [records, schema]);

  const formatPct = (val: number, total: number) => {
    if (total === 0) return "0,00%";
    return ((val / total) * 100).toFixed(2).replace('.', ',') + "%";
  };

  const copySummary = () => {
    const text = `Resumo Executivo (${schema.name})
• Total da base: ${reportStats.totalBase.toLocaleString('pt-BR')} clientes
• Base trabalhada: ${reportStats.baseTrabalhada.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.baseTrabalhada, reportStats.totalBase)})
• Contato efetivo: ${reportStats.contatoEfetivo.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.contatoEfetivo, reportStats.baseTrabalhada)})
• Sem contato efetivo: ${reportStats.semContatoEfetivo.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.semContatoEfetivo, reportStats.baseTrabalhada)})
• Pendências de discagem: ${reportStats.pendenciasDiscagem.toLocaleString('pt-BR')} clientes (${formatPct(reportStats.pendenciasDiscagem, reportStats.totalBase)})`;

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback("Copiado!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
  };

  const copyObsTable = () => {
    let text = `Contagem (Observação Final - ${schema.name})\nObservação Final\tQtd.\n`;
    observacaoBreakdown.counts.forEach(c => text += `${c.label}\t${c.count}\n`);
    text += `Total Geral\t${observacaoBreakdown.total}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback("Copiado!");
      setTimeout(() => setCopyFeedback(""), 2000);
    });
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
    
    const csvContent = exportDynamicCSV(toExport, schema);
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
      {/* Resumo Executivo & Contagens (Calculado Automaticamente) */}
      <div className="bg-white border-b-2 border-[#141414] p-4 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Métricas Principais */}
          <div className="bg-[#F2F1EB] p-3 border-2 border-[#141414] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#141414]">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#141414] flex items-center gap-2">
                <BarChart3 size={16} /> Resumo Executivo: {schema.name}
              </h3>
              <button
                onClick={copySummary}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#141414] text-[#141414] text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-all active:translate-y-0.5"
              >
                <ClipboardCopy size={12} />
                {copyFeedback || "Copiar Resumo"}
              </button>
            </div>
            <ul className="text-[11px] font-mono text-slate-700 space-y-1.5">
              <li className="flex justify-between border-b border-gray-200 pb-0.5">
                <span className="font-bold text-[#141414]">Total da base:</span>
                <span className="font-bold font-mono">{reportStats.totalBase.toLocaleString('pt-BR')} clientes</span>
              </li>
              <li className="flex justify-between border-b border-gray-200 pb-0.5">
                <span className="font-bold text-[#141414]">Base trabalhada:</span>
                <span><strong className="font-mono">{reportStats.baseTrabalhada.toLocaleString('pt-BR')}</strong> <span className="text-slate-500 font-mono">({formatPct(reportStats.baseTrabalhada, reportStats.totalBase)})</span></span>
              </li>
              <li className="flex justify-between border-b border-gray-200 pb-0.5">
                <span className="font-bold text-emerald-900">Contato efetivo:</span>
                <span><strong className="font-mono text-emerald-900">{reportStats.contatoEfetivo.toLocaleString('pt-BR')}</strong> <span className="text-slate-500 font-mono">({formatPct(reportStats.contatoEfetivo, reportStats.baseTrabalhada)})</span></span>
              </li>
              <li className="flex justify-between border-b border-gray-200 pb-0.5">
                <span className="font-bold text-amber-900">Sem contato efetivo:</span>
                <span><strong className="font-mono text-amber-900">{reportStats.semContatoEfetivo.toLocaleString('pt-BR')}</strong> <span className="text-slate-500 font-mono">({formatPct(reportStats.semContatoEfetivo, reportStats.baseTrabalhada)})</span></span>
              </li>
              <li className="flex justify-between">
                <span className="font-bold text-[#141414]">Pendências de discagem:</span>
                <span><strong className="font-mono">{reportStats.pendenciasDiscagem.toLocaleString('pt-BR')}</strong> <span className="text-slate-500 font-mono">({formatPct(reportStats.pendenciasDiscagem, reportStats.totalBase)})</span></span>
              </li>
            </ul>
          </div>

          {/* Tabela de Observação Final */}
          <div className="bg-[#F2F1EB] p-3 border-2 border-[#141414] shadow-[2px_2px_0px_rgba(0,0,0,1)] max-h-48 overflow-y-auto">
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#141414] sticky top-0 bg-[#F2F1EB] z-10">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#141414]">
                Contagem (Observação Final)
              </h3>
              <button
                onClick={copyObsTable}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#141414] text-[#141414] text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-all active:translate-y-0.5"
              >
                <ClipboardCopy size={12} />
                Copiar Tabela
              </button>
            </div>
            <table className="w-full text-xs text-left font-sans">
              <thead className="bg-[#E4E3E0] text-[#141414] text-[10px] uppercase font-bold border-b border-[#141414]">
                <tr>
                  <th className="px-2 py-1 border-r border-[#141414]">Observação Final</th>
                  <th className="px-2 py-1 w-20 text-right">Qtd.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-[11px]">
                {observacaoBreakdown.counts.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/60">
                    <td className="px-2 py-1 font-medium text-slate-800">{item.label}</td>
                    <td className="px-2 py-1 text-right font-mono font-bold text-slate-900">{item.count}</td>
                  </tr>
                ))}
                {observacaoBreakdown.counts.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-2 py-3 text-center text-slate-500 italic text-[10px]">Nenhuma observação preenchida.</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-[#E4E3E0] font-bold border-t border-[#141414] text-[11px]">
                <tr>
                  <td className="px-2 py-1 border-r border-[#141414]">Total Geral</td>
                  <td className="px-2 py-1 text-right font-mono">{observacaoBreakdown.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Top Controls */}
      <div className="p-4 border-b-2 border-[#141414] bg-[#F2F1EB] shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={`Buscar em ${schema.name}...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 border-2 border-[#141414] bg-white text-sm font-mono text-[#141414] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportSelected}
              className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-[#141414] text-[#141414] text-xs font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors"
            >
              <Download size={14} />
              Exportar
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Tem certeza que deseja excluir os registros selecionados?")) {
                    onDeleteRecords(selectedIds);
                    setSelectedIds([]);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 bg-red-100 border-2 border-red-900 text-red-900 text-xs font-bold uppercase hover:bg-red-900 hover:text-white transition-colors"
              >
                <Trash2 size={14} />
                Excluir ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 p-2 bg-white border-2 border-[#141414] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#141414]">
              Ação em Massa ({selectedIds.length}):
            </span>
            {schema.fields.filter(f => !f.readOnly).map(field => (
              <div key={`bulk_${field.id}`} className="flex items-center gap-1 bg-[#F2F1EB] border-2 border-[#141414] pl-1 pr-1 py-1">
                {field.type === 'list' ? (
                  <select
                    className="bg-transparent text-[10px] font-mono font-bold text-[#141414] outline-none max-w-[150px] cursor-pointer"
                    value={bulkEdits[field.id] || ""}
                    onChange={(e) => setBulkEdits({...bulkEdits, [field.id]: e.target.value})}
                  >
                    <option value="" disabled>Alterar {field.label}</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder={`Novo ${field.label} (ou 'agora')`}
                    value={bulkEdits[field.id] || ""}
                    onChange={(e) => setBulkEdits({...bulkEdits, [field.id]: e.target.value})}
                    className="bg-white border border-[#141414] px-1 text-[10px] font-mono outline-none max-w-[150px]"
                  />
                )}
                <button
                  onClick={() => applyBulkEdit(field.id)}
                  className="bg-[#141414] text-white p-1 hover:bg-black transition-colors"
                  title="Aplicar aos selecionados"
                >
                  <CheckSquare size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-white border-y-2 border-[#141414]">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 bg-[#F2F1EB] text-[#141414] uppercase text-[10px] z-10 font-bold border-b-2 border-[#141414]">
            <tr>
              <th className="w-10 px-3 py-2 border-r border-[#141414]/40 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredAndSortedRecords.length && filteredAndSortedRecords.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded-none border-2 border-[#141414] text-[#141414] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                />
              </th>
              {schema.fields.map(field => (
                <th key={field.id} className="px-3 py-2 cursor-pointer hover:bg-[#C5C4C0] border-r border-[#141414]/40 transition-colors" onClick={() => handleSort(field.id)}>
                  <div className="flex items-center gap-1 font-extrabold">
                    <span>{field.label}</span>
                    {sortField === field.id && (sortOrder === "asc" ? "▲" : "▼")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]/30 text-xs text-[#141414] bg-[#E4E3E0]">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={schema.fields.length + 1} className="px-6 py-12 text-center text-slate-600 bg-white/20">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase">Nenhum registro encontrado nesta base.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRecords.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-white/60 transition-colors ${selectedIds.includes(item.id) ? "bg-[#D1EED5]" : ""}`}
                >
                  <td className="px-3 py-1.5 border-r border-[#141414]/20 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded-none border-2 border-[#141414] text-[#141414] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                    />
                  </td>
                  
                  {schema.fields.map(field => (
                    <td key={field.id} className="px-3 py-1.5 border-r border-[#141414]/20 font-mono text-[10px] max-w-[160px] truncate" title={item.data[field.id]}>
                      {field.readOnly ? (
                        <span className={field.id === 'nome' || field.id === 'cpf' ? 'font-bold text-[#141414]' : 'text-slate-700'}>
                          {item.data[field.id] || "-"}
                        </span>
                      ) : (
                        field.type === 'list' ? (
                          <select
                            className="bg-transparent text-[#141414] outline-none font-bold cursor-pointer w-full"
                            value={item.data[field.id] || "-"}
                            onChange={(e) => onUpdateRecord(item.id, { [field.id]: e.target.value })}
                          >
                            <option value="-">-</option>
                            {field.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="bg-transparent border-b border-transparent focus:border-[#141414] text-[#141414] outline-none font-bold w-full focus:bg-white transition-all px-1"
                            value={item.data[field.id] || ""}
                            onChange={(e) => onUpdateRecord(item.id, { [field.id]: e.target.value })}
                          />
                        )
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-3 border-t-2 border-[#141414] bg-[#F2F1EB] shrink-0">
        <span className="text-[10px] font-bold text-[#141414] uppercase tracking-wider">
          {filteredAndSortedRecords.length > 0 ? (
            <>Mostrando {(currentPage - 1) * rowsPerPage + 1} a {Math.min(currentPage * rowsPerPage, filteredAndSortedRecords.length)} de {filteredAndSortedRecords.length}</>
          ) : (
            <>Nenhum registro</>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="px-3 py-1 bg-white border-2 border-[#141414] text-[#141414] text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#141414] hover:text-white transition-colors cursor-pointer"
          >
            Anterior
          </button>
          <div className="px-3 py-1 text-xs font-mono font-bold bg-[#141414] text-white border-2 border-[#141414]">
            {currentPage} / {Math.max(1, totalPages)}
          </div>
          <button
            type="button"
            disabled={currentPage >= totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="px-3 py-1 bg-white border-2 border-[#141414] text-[#141414] text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#141414] hover:text-white transition-colors cursor-pointer"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
