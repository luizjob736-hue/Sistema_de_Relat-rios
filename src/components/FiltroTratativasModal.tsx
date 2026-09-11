import React, { useState, useMemo } from "react";
import { 
  ArrowUpDown, 
  Check, 
  X, 
  SlidersHorizontal, 
  Hash, 
  Type, 
  Calendar, 
  ShieldAlert, 
  Layers, 
  Trash2, 
  Sparkles,
  ArrowDownAZ,
  ArrowUpZA,
  ArrowDown01,
  ArrowUp10,
  HelpCircle,
  Eye
} from "lucide-react";
import { DynamicRecord, FieldDef, GlobalSortConfig, ReportSchema, SortDataType, SortDirection } from "../types";
import { autoDetectSortType, sortRecordsByCriteria } from "../utils/recordSorting";
import { getCellValue } from "../utils";

interface FiltroTratativasModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: ReportSchema;
  fields: FieldDef[];
  records: DynamicRecord[];
  currentUser: string | null;
  onApplyGlobalSort: (schemaId: string, config: GlobalSortConfig | null, reorderedRecordIds: string[]) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const FiltroTratativasModal: React.FC<FiltroTratativasModalProps> = ({
  isOpen,
  onClose,
  schema,
  fields,
  records,
  currentUser,
  onApplyGlobalSort,
  showToast
}) => {
  // Current active schema records
  const guideRecords = useMemo(() => {
    return records.filter(r => r.reportId === schema.id || (schema.id === 'default' && (!r.reportId || r.reportId === 'default' || r.reportId === '1')));
  }, [records, schema.id]);

  const existingConfig = schema.globalSortConfig;

  const [selectedFieldId, setSelectedFieldId] = useState<string>(() => {
    if (existingConfig?.fieldId) return existingConfig.fieldId;
    const defaultField = fields.find(f => f.id !== '_finalizada') || fields[0];
    return defaultField?.id || 'nome';
  });

  const selectedFieldDef = useMemo(() => {
    return fields.find(f => f && f.id === selectedFieldId);
  }, [fields, selectedFieldId]);

  // Detected or current sort data type
  const [sortDataType, setSortDataType] = useState<SortDataType>(() => {
    if (existingConfig?.sortType) return existingConfig.sortType;
    return autoDetectSortType(guideRecords, fields.find(f => f.id === (existingConfig?.fieldId || fields[0]?.id)), existingConfig?.fieldId || fields[0]?.id || 'nome');
  });

  const [sortOrder, setSortOrder] = useState<SortDirection>(() => {
    return existingConfig?.order || 'asc';
  });

  const [emptyPosition, setEmptyPosition] = useState<'last' | 'first'>(() => {
    return existingConfig?.emptyPosition || 'last';
  });

  const [isApplying, setIsApplying] = useState(false);

  // When field changes, auto-adjust sort data type if not previously set
  const handleFieldChange = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    const targetField = fields.find(f => f.id === fieldId);
    const detected = autoDetectSortType(guideRecords, targetField, fieldId);
    setSortDataType(detected);
  };

  // Preview sorted results
  const previewSortedRecords = useMemo(() => {
    if (!selectedFieldId || guideRecords.length === 0) return [];
    
    const tempConfig: GlobalSortConfig = {
      fieldId: selectedFieldId,
      order: sortOrder,
      sortType: sortDataType,
      emptyPosition
    };

    const sorted = sortRecordsByCriteria(guideRecords, fields, tempConfig);
    return sorted;
  }, [guideRecords, fields, selectedFieldId, sortOrder, sortDataType, emptyPosition]);

  if (!isOpen) return null;

  const handleSaveAndApply = async () => {
    if (!selectedFieldId) {
      showToast("Selecione uma coluna para ordenar.", "error");
      return;
    }

    setIsApplying(true);
    try {
      const configToSave: GlobalSortConfig = {
        fieldId: selectedFieldId,
        order: sortOrder,
        sortType: sortDataType,
        emptyPosition,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser || 'Admin',
        description: `Ordenado por ${selectedFieldDef?.label || selectedFieldId} (${sortOrder === 'asc' ? (sortDataType === 'number' ? '1 a 100' : 'A a Z') : (sortDataType === 'number' ? '100 a 1' : 'Z a A')})`
      };

      const reorderedIds = previewSortedRecords.map(r => r.id);
      await onApplyGlobalSort(schema.id, configToSave, reorderedIds);

      showToast(`Filtro de Tratativas aplicado globalmente! Ordem atualizada para todos os operadores.`);
      onClose();
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar filtro de tratativas.", "error");
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearGlobalSort = async () => {
    if (!confirm("Deseja remover o Filtro de Tratativas global e restaurar a ordem padrão original?")) {
      return;
    }

    setIsApplying(true);
    try {
      await onApplyGlobalSort(schema.id, null, []);
      showToast("Filtro de Tratativas removido. Ordem restaurada.");
      onClose();
    } catch (err) {
      showToast("Erro ao remover filtro de tratativas.", "error");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-4 border-[#141414] shadow-[10px_10px_0px_#141414] max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-[#141414] animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="bg-[#141414] text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-400 text-black flex items-center justify-center font-black">
              <ArrowUpDown size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  Filtro de Tratativas — Priorização Global
                </h2>
                <span className="text-[9px] font-mono font-bold bg-amber-400 text-black px-1.5 py-0.2">
                  ADM
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono">
                Guia: <strong className="text-white">"{schema.name}"</strong> • {guideRecords.length} registros
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 border-b-2 border-[#141414] p-3 text-xs text-amber-950 font-medium flex items-start gap-2.5 shrink-0">
          <Sparkles size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-snug">
            Defina a regra de ordenação para priorizar os atendimentos. Ao salvar, <strong>a ordem de todos os operadores conectados será alterada automaticamente</strong> para refletir a sua priorização.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-[#F9F8F6]">
          
          {/* Step 1: Select Column */}
          <div className="bg-white border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
                <Layers size={15} />
                <span>1. Escolha a Coluna para Ordenar</span>
              </label>
              <span className="text-[10px] font-mono text-slate-500">
                {fields.length} colunas disponíveis
              </span>
            </div>

            <select
              value={selectedFieldId}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full bg-[#F2F1EB] border-2 border-[#141414] p-2 text-xs font-bold text-[#141414] focus:outline-none focus:bg-white cursor-pointer"
            >
              <optgroup label="Colunas de Dados">
                {fields.filter(f => f.id !== 'status' && f.id !== 'observacaoFinal').map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.type === 'list' ? 'Lista' : 'Texto/Valor'})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Colunas de Tratativas & Status">
                <option value="status">Status (Motivos de Atendimento)</option>
                <option value="observacaoFinal">Observação final</option>
                <option value="_finalizada">Situação da Proposta (Em Aberto / Finalizada)</option>
              </optgroup>
            </select>
          </div>

          {/* Step 2: Choose Data Type & Order Direction */}
          <div className="bg-white border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
              <SlidersHorizontal size={15} />
              <span>2. Tipo de Dado & Sentido da Ordenação</span>
            </label>

            {/* Data Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSortDataType('text')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 border-2 border-[#141414] text-xs font-bold transition-all cursor-pointer ${
                  sortDataType === 'text'
                    ? 'bg-[#141414] text-white shadow-[2px_2px_0px_#C5C4C0]'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Type size={14} />
                <span>Texto (A - Z)</span>
              </button>

              <button
                type="button"
                onClick={() => setSortDataType('number')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 border-2 border-[#141414] text-xs font-bold transition-all cursor-pointer ${
                  sortDataType === 'number'
                    ? 'bg-[#141414] text-white shadow-[2px_2px_0px_#C5C4C0]'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
                title="Classifica números, valores monetários (R$) e datas"
              >
                <div className="flex items-center gap-1">
                  <Hash size={14} />
                  <Calendar size={13} />
                </div>
                <span>Numérico & Datas</span>
              </button>

              <button
                type="button"
                onClick={() => setSortDataType('date')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 border-2 border-[#141414] text-xs font-bold transition-all cursor-pointer ${
                  sortDataType === 'date'
                    ? 'bg-[#141414] text-white shadow-[2px_2px_0px_#C5C4C0]'
                    : 'bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Calendar size={14} />
                <span>Datas / Horas</span>
              </button>
            </div>

            {/* Direction Selection Cards */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Ascending */}
              <div
                onClick={() => setSortOrder('asc')}
                className={`border-2 border-[#141414] p-3 cursor-pointer transition-all flex flex-col justify-between ${
                  sortOrder === 'asc'
                    ? 'bg-amber-100 border-[#141414] shadow-[3px_3px_0px_#141414]'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    {sortDataType === 'number' || sortDataType === 'date' ? (
                      <ArrowDown01 size={18} className="text-amber-900" />
                    ) : (
                      <ArrowDownAZ size={18} className="text-amber-900" />
                    )}
                    <span className="font-black text-xs uppercase">
                      {sortDataType === 'number'
                        ? '1 a 100 / Mais Antigo'
                        : sortDataType === 'date'
                        ? 'Mais Antigo Primeiro'
                        : 'A a Z (Crescente)'}
                    </span>
                  </div>
                  {sortOrder === 'asc' && <Check size={16} className="text-amber-950 font-bold" />}
                </div>
                <p className="text-[10px] text-slate-600 font-mono">
                  {sortDataType === 'number' 
                    ? 'Menores números/valores ou datas mais antigas no topo (1 a 100).' 
                    : sortDataType === 'date' 
                    ? 'Fila cronológica: primeiros cadastrados no topo.' 
                    : 'Ordem alfabética de A a Z.'}
                </p>
              </div>

              {/* Descending */}
              <div
                onClick={() => setSortOrder('desc')}
                className={`border-2 border-[#141414] p-3 cursor-pointer transition-all flex flex-col justify-between ${
                  sortOrder === 'desc'
                    ? 'bg-amber-100 border-[#141414] shadow-[3px_3px_0px_#141414]'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    {sortDataType === 'number' || sortDataType === 'date' ? (
                      <ArrowUp10 size={18} className="text-amber-900" />
                    ) : (
                      <ArrowUpZA size={18} className="text-amber-900" />
                    )}
                    <span className="font-black text-xs uppercase">
                      {sortDataType === 'number'
                        ? '100 a 1 / Mais Recente'
                        : sortDataType === 'date'
                        ? 'Mais Recente Primeiro'
                        : 'Z a A (Inverso)'}
                    </span>
                  </div>
                  {sortOrder === 'desc' && <Check size={16} className="text-amber-950 font-bold" />}
                </div>
                <p className="text-[10px] text-slate-600 font-mono">
                  {sortDataType === 'number' 
                    ? 'Maiores valores ou datas mais recentes/atualizadas no topo (100 a 1).' 
                    : sortDataType === 'date' 
                    ? 'Últimos cadastrados ou atualizados no topo.' 
                    : 'Ordem alfabética invertida de Z a A.'}
                </p>
              </div>
            </div>

            {/* Empty Values Placement */}
            <div className="pt-2 flex items-center justify-between bg-[#F2F1EB] p-2.5 border border-[#141414]">
              <span className="text-[11px] font-bold text-slate-800">
                Posição de clientes sem preenchimento nesta coluna:
              </span>
              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setEmptyPosition('last')}
                  className={`px-2 py-0.5 border border-[#141414] font-bold text-[10px] ${
                    emptyPosition === 'last' ? 'bg-[#141414] text-white' : 'bg-white text-slate-700'
                  }`}
                >
                  No Final (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setEmptyPosition('first')}
                  className={`px-2 py-0.5 border border-[#141414] font-bold text-[10px] ${
                    emptyPosition === 'first' ? 'bg-[#141414] text-white' : 'bg-white text-slate-700'
                  }`}
                >
                  No Início
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Interactive Live Preview */}
          <div className="bg-white border-2 border-[#141414] p-4 shadow-[3px_3px_0px_#141414] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
                <Eye size={15} />
                <span>3. Prévia dos Primeiros Clientes na Nova Ordem</span>
              </label>
              <span className="text-[10px] font-mono font-bold bg-[#141414] text-white px-1.5 py-0.2">
                Top 5 de {previewSortedRecords.length}
              </span>
            </div>

            <div className="border border-[#141414] overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#E4E3E0] border-b border-[#141414] text-[10px] uppercase font-bold text-[#141414]">
                  <tr>
                    <th className="p-1.5 w-10 text-center border-r border-[#141414]">Pos.</th>
                    <th className="p-1.5 border-r border-[#141414]">Nome / Cliente</th>
                    <th className="p-1.5 bg-amber-200 text-amber-950 font-black border-r border-[#141414]">
                      {selectedFieldDef?.label || selectedFieldId} (Critério)
                    </th>
                    <th className="p-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {previewSortedRecords.slice(0, 5).map((rec, idx) => {
                    const clientName = rec.data?.nome || rec.data?.NOME || rec.data?.cliente || `Registro #${rec.id.substring(0, 5)}`;
                    const evalValue = selectedFieldDef ? getCellValue(rec.data, selectedFieldDef) : rec.data[selectedFieldId] || '-';
                    const statusVal = rec.data?.status || rec.data?.Status || '-';

                    return (
                      <tr key={rec.id} className="hover:bg-amber-50/50">
                        <td className="p-1.5 text-center font-bold border-r border-slate-200 text-slate-500">
                          {idx + 1}º
                        </td>
                        <td className="p-1.5 font-bold border-r border-slate-200 truncate max-w-[140px]">
                          {clientName}
                        </td>
                        <td className="p-1.5 bg-amber-50 font-bold text-amber-900 border-r border-slate-200 truncate max-w-[180px]">
                          {evalValue || <span className="text-slate-400 italic">(vazio)</span>}
                        </td>
                        <td className="p-1.5 text-slate-600 truncate max-w-[100px]">
                          {statusVal}
                        </td>
                      </tr>
                    );
                  })}
                  {previewSortedRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                        Nenhum registro encontrado nesta base.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Current Active Global Filter Status */}
          {existingConfig && (
            <div className="bg-slate-100 border border-slate-300 p-3 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Filtro Ativo Atualmente:</span>
                <span className="font-bold text-[#141414]">
                  {existingConfig.description || `Coluna: ${existingConfig.fieldId} (${existingConfig.order.toUpperCase()})`}
                </span>
                {existingConfig.updatedAt && (
                  <span className="text-[10px] text-slate-500 block">
                    Definido por {existingConfig.updatedBy || 'Admin'} em {new Date(existingConfig.updatedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClearGlobalSort}
                disabled={isApplying}
                className="flex items-center gap-1 bg-white border border-red-800 text-red-900 px-2.5 py-1 text-[10px] font-bold uppercase hover:bg-red-800 hover:text-white transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                Remover
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t-2 border-[#141414] p-4 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 bg-slate-200 border-2 border-[#141414] font-black uppercase text-xs hover:bg-slate-300 transition-all cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {existingConfig && (
              <button
                type="button"
                onClick={handleClearGlobalSort}
                disabled={isApplying}
                className="px-3 py-2 bg-red-100 border-2 border-red-900 text-red-900 font-black uppercase text-xs hover:bg-red-900 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Remover Filtro</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={isApplying}
              className="px-5 py-2.5 bg-[#141414] text-white border-2 border-[#141414] shadow-[4px_4px_0px_#C5C4C0] hover:bg-black font-black uppercase text-xs tracking-wider transition-all active:translate-y-0.5 cursor-pointer flex items-center gap-2"
            >
              <Check size={16} className="text-amber-400" />
              <span>{isApplying ? "Salvando..." : "Salvar e Aplicar Globalmente"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
