import React, { useState, useMemo } from "react";
import { CopySlash, AlertTriangle, Check, X, ShieldAlert, Layers, Sparkles, HelpCircle } from "lucide-react";
import { DynamicRecord, ReportSchema, FieldDef } from "../types";
import { normalizeForDeduplication } from "../utils";

interface DeduplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: ReportSchema;
  records: DynamicRecord[];
  onConfirmDeduplicate: (columnId: string, columnLabel: string, idsToDelete: string[], removedRecords: DynamicRecord[]) => void;
}

export const DeduplicationModal: React.FC<DeduplicationModalProps> = ({
  isOpen,
  onClose,
  schema,
  records,
  onConfirmDeduplicate
}) => {
  const guideRecords = useMemo(() => {
    return records.filter(r => r.reportId === schema.id);
  }, [records, schema.id]);

  // Available fields from schema
  const fields = useMemo(() => {
    return (schema.fields || []).filter(f => f && f.id !== '_order');
  }, [schema.fields]);

  // Initial column selection: prefer CPF, then Telefone, then Email, then first field
  const defaultField = useMemo(() => {
    const cpfField = fields.find(f => f.id.toLowerCase().includes('cpf') || f.label.toLowerCase().includes('cpf'));
    if (cpfField) return cpfField.id;
    const telField = fields.find(f => f.id.toLowerCase().includes('tel') || f.label.toLowerCase().includes('tel'));
    if (telField) return telField.id;
    const nameField = fields.find(f => f.id.toLowerCase().includes('nome') || f.label.toLowerCase().includes('nome'));
    if (nameField) return nameField.id;
    return fields[0]?.id || '';
  }, [fields]);

  const [selectedColumnId, setSelectedColumnId] = useState<string>(defaultField);
  const [keepStrategy, setKeepStrategy] = useState<'first' | 'last' | 'most_filled'>('first');
  const [ignoreEmpty, setIgnoreEmpty] = useState<boolean>(true);
  const [showPreviewList, setShowPreviewList] = useState<boolean>(false);

  const selectedField = useMemo(() => {
    return fields.find(f => f.id === selectedColumnId) || fields[0];
  }, [fields, selectedColumnId]);

  // Deduplication Analysis
  const analysis = useMemo(() => {
    if (!selectedField) {
      return {
        groups: new Map<string, DynamicRecord[]>(),
        duplicateCount: 0,
        uniqueCount: 0,
        idsToDelete: [] as string[],
        recordsToDelete: [] as DynamicRecord[],
        sampleDuplicates: [] as { key: string; kept: DynamicRecord; toRemove: DynamicRecord[] }[]
      };
    }

    const groups = new Map<string, DynamicRecord[]>();

    guideRecords.forEach(record => {
      const rawVal = record.data[selectedField.id] || record.data[selectedField.label] || '';
      const normalizedKey = normalizeForDeduplication(rawVal, selectedField.id, selectedField.label);

      if (ignoreEmpty && (!normalizedKey || normalizedKey === '-' || normalizedKey === '—')) {
        // Each empty is treated as unique/ignored from grouping
        return;
      }

      const key = normalizedKey || `__empty_${record.id}__`;
      const list = groups.get(key) || [];
      list.push(record);
      groups.set(key, list);
    });

    const idsToDelete: string[] = [];
    const recordsToDelete: DynamicRecord[] = [];
    const sampleDuplicates: { key: string; kept: DynamicRecord; toRemove: DynamicRecord[] }[] = [];

    groups.forEach((groupRecords, key) => {
      if (key.startsWith('__empty_') || groupRecords.length <= 1) {
        return;
      }

      // Determine which record to keep
      let keptIndex = 0;
      if (keepStrategy === 'last') {
        keptIndex = groupRecords.length - 1;
      } else if (keepStrategy === 'most_filled') {
        // Choose record with the highest number of non-empty data fields
        let maxFilled = -1;
        groupRecords.forEach((rec, idx) => {
          const filledCount = Object.entries(rec.data).filter(([k, v]) => {
            if (k.startsWith('_')) return false;
            return v && v !== '-' && v !== '—' && v.trim() !== '';
          }).length;
          if (filledCount > maxFilled) {
            maxFilled = filledCount;
            keptIndex = idx;
          }
        });
      }

      const kept = groupRecords[keptIndex];
      const toRemove = groupRecords.filter((_, idx) => idx !== keptIndex);

      toRemove.forEach(r => {
        idsToDelete.push(r.id);
        recordsToDelete.push(r);
      });

      sampleDuplicates.push({
        key,
        kept,
        toRemove
      });
    });

    const totalGuide = guideRecords.length;
    const duplicateCount = idsToDelete.length;
    const finalCount = totalGuide - duplicateCount;

    return {
      groups,
      duplicateCount,
      uniqueCount: groups.size,
      finalCount,
      idsToDelete,
      recordsToDelete,
      sampleDuplicates
    };
  }, [guideRecords, selectedField, keepStrategy, ignoreEmpty]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (analysis.duplicateCount === 0) {
      onClose();
      return;
    }
    onConfirmDeduplicate(
      selectedField.id,
      selectedField.label,
      analysis.idsToDelete,
      analysis.recordsToDelete
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-[#F2F1EB] border-4 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#141414] text-white p-3.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <CopySlash className="text-amber-400" size={20} />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider">
                Remover Duplicatas da Guia
              </h2>
              <span className="text-[10px] text-gray-300 font-mono">
                Guia selecionada: <strong className="text-amber-300">{schema.name}</strong> ({guideRecords.length} registros)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Column Selection Card */}
          <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <label className="block text-xs font-black uppercase text-[#141414] mb-1.5 flex items-center gap-1.5">
              <span>1. Escolha a coluna base para validação de duplicidade:</span>
            </label>
            <select
              value={selectedColumnId}
              onChange={(e) => setSelectedColumnId(e.target.value)}
              className="w-full bg-[#F2F1EB] border-2 border-[#141414] px-3 py-1.5 text-xs font-mono font-bold text-[#141414] focus:bg-white outline-none cursor-pointer"
            >
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label} {f.id.toLowerCase().includes('cpf') ? '(Recomendado para CPF)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-600 mt-1.5 font-sans">
              O sistema compara os registros da guia considerando a coluna selecionada (removendo pontuações e normalizando maiúsculas/minúsculas).
            </p>
          </div>

          {/* Strategy and Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <label className="block text-xs font-black uppercase text-[#141414] mb-1.5">
                2. Critério para manter o registro:
              </label>
              <div className="space-y-1.5 text-xs font-mono">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="keepStrategy"
                    value="first"
                    checked={keepStrategy === 'first'}
                    onChange={() => setKeepStrategy('first')}
                    className="accent-[#141414]"
                  />
                  <span>Manter 1ª ocorrência (Original)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="keepStrategy"
                    value="last"
                    checked={keepStrategy === 'last'}
                    onChange={() => setKeepStrategy('last')}
                    className="accent-[#141414]"
                  />
                  <span>Manter última ocorrência (Mais recente)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="keepStrategy"
                    value="most_filled"
                    checked={keepStrategy === 'most_filled'}
                    onChange={() => setKeepStrategy('most_filled')}
                    className="accent-[#141414]"
                  />
                  <span>Manter o registro mais completo</span>
                </label>
              </div>
            </div>

            <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
              <div>
                <label className="block text-xs font-black uppercase text-[#141414] mb-1.5">
                  3. Tratamento de vazios:
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-xs font-mono mt-1">
                  <input
                    type="checkbox"
                    checked={ignoreEmpty}
                    onChange={(e) => setIgnoreEmpty(e.target.checked)}
                    className="accent-[#141414] mt-0.5"
                  />
                  <span className="text-slate-800">
                    Ignorar registros com valor vazio ou "-" (não apagar como duplicatas entre si)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Analysis Summary Box */}
          <div className="bg-[#E4E3E0] border-2 border-[#141414] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#141414] flex items-center gap-1.5">
                <Layers size={14} /> Resultado da Análise
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#141414] text-white px-2 py-0.5">
                Coluna: {selectedField?.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="bg-white border border-[#141414] p-2">
                <span className="text-[10px] text-slate-600 block uppercase">Total Atual</span>
                <span className="text-base font-black text-[#141414]">{guideRecords.length}</span>
              </div>
              <div className="bg-rose-50 border-2 border-rose-900 p-2">
                <span className="text-[10px] text-rose-900 block font-bold uppercase">Duplicatas a Remover</span>
                <span className="text-base font-black text-rose-900">{analysis.duplicateCount}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-900 p-2">
                <span className="text-[10px] text-emerald-900 block font-bold uppercase">Total Final Restante</span>
                <span className="text-base font-black text-emerald-900">{analysis.finalCount}</span>
              </div>
            </div>

            {analysis.duplicateCount > 0 ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowPreviewList(!showPreviewList)}
                  className="text-[11px] font-mono font-bold text-slate-800 underline hover:text-black flex items-center gap-1 cursor-pointer"
                >
                  {showPreviewList ? "▲ Ocultar lista de duplicatas encontradas" : `▼ Ver ${analysis.sampleDuplicates.length} grupo(s) com duplicidade (${analysis.duplicateCount} registros)`}
                </button>

                {showPreviewList && (
                  <div className="mt-2 bg-white border border-[#141414] max-h-48 overflow-y-auto p-2 divide-y divide-gray-200 text-xs font-mono">
                    {analysis.sampleDuplicates.map((grp, gIdx) => (
                      <div key={`grp_${gIdx}`} className="py-1.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                          <span>Chave duplicada: <strong className="text-[#141414]">{grp.key}</strong></span>
                          <span className="text-rose-700 font-bold">1 mantido, {grp.toRemove.length} a excluir</span>
                        </div>
                        <div className="pl-2 border-l-2 border-emerald-600 text-[11px] text-emerald-950 font-semibold mb-0.5">
                          ✓ Mantido: {grp.kept.data.nome || grp.kept.data.cpf || grp.kept.id} {grp.kept.data.status ? `[${grp.kept.data.status}]` : ''}
                        </div>
                        {grp.toRemove.map((rm, rmIdx) => (
                          <div key={`rm_${rm.id}_${rmIdx}`} className="pl-2 border-l-2 border-rose-500 text-[10px] text-rose-800">
                            ✕ Excluir: {rm.data.nome || rm.data.cpf || rm.id} {rm.data.status ? `[${rm.data.status}]` : ''}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 text-center text-xs font-mono text-emerald-900 bg-emerald-100/70 p-2 border border-emerald-400">
                ✓ Nenhuma duplicata encontrada com base na coluna "{selectedField?.label}".
              </div>
            )}
          </div>

          {/* 30-Minute Undo Protection Alert */}
          <div className="bg-amber-50 border-2 border-amber-800 p-2.5 flex items-start gap-2 text-xs font-sans text-amber-950 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <ShieldAlert className="text-amber-800 shrink-0 mt-0.5" size={18} />
            <div>
              <strong className="block font-bold uppercase text-[11px] text-amber-900">
                Proteção de Desfazer (30 minutos):
              </strong>
              <span>
                Após a remoção, uma barra de recuperação permanecerá disponível no topo da tela por <strong>30 minutos</strong> com cronômetro regressivo para desfazer e restaurar instantaneamente todos os registros removidos.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#E4E3E0] p-3 border-t-2 border-[#141414] flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border-2 border-[#141414] text-xs font-bold uppercase text-[#141414] hover:bg-[#141414] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            disabled={analysis.duplicateCount === 0}
            onClick={handleConfirm}
            className={`flex items-center gap-1.5 px-4 py-1.5 border-2 text-xs font-black uppercase transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] ${
              analysis.duplicateCount > 0
                ? "bg-rose-600 text-white border-[#141414] hover:bg-rose-700 active:translate-y-0.5 cursor-pointer"
                : "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed shadow-none"
            }`}
          >
            <CopySlash size={14} />
            <span>Remover {analysis.duplicateCount} Duplicatas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
