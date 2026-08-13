import React, { useState } from "react";
import { X, Plus, Trash2, Settings2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { StatusConfigItem, SubMotivo, defaultStatusConfigs } from "../types";

interface StatusConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusConfigs: StatusConfigItem[];
  onSave: (newConfigs: StatusConfigItem[]) => void;
}

export function StatusConfigModal({ isOpen, onClose, statusConfigs, onSave }: StatusConfigModalProps) {
  const [configs, setConfigs] = useState<StatusConfigItem[]>(
    statusConfigs && statusConfigs.length > 0 ? statusConfigs : defaultStatusConfigs
  );
  const [newMotivo, setNewMotivo] = useState("");
  const [newSubMotivo, setNewSubMotivo] = useState<SubMotivo>("Sucesso");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleAddMotivo = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmed = newMotivo.trim();
    if (!trimmed) {
      setErrorMsg("Digite o nome do motivo.");
      return;
    }

    if (trimmed === "-") {
      setErrorMsg("O símbolo '-' é reservado para pendências sem resposta.");
      return;
    }

    if (configs.some(c => c.motivo.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg("Este motivo já está cadastrado.");
      return;
    }

    setConfigs([...configs, { motivo: trimmed, subMotivo: newSubMotivo }]);
    setNewMotivo("");
  };

  const handleRemove = (index: number) => {
    setConfigs(configs.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (configs.length === 0) {
      setErrorMsg("Deve haver pelo menos um motivo de status cadastrado.");
      return;
    }
    onSave(configs);
    onClose();
  };

  const getSubMotivoBadge = (sub: SubMotivo) => {
    switch (sub) {
      case "Sucesso":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 border border-emerald-900 text-emerald-900 text-[10px] font-bold uppercase font-mono">
            <CheckCircle2 size={12} /> Sucesso
          </span>
        );
      case "Sem Sucesso":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 border border-rose-900 text-rose-900 text-[10px] font-bold uppercase font-mono">
            <XCircle size={12} /> Sem Sucesso
          </span>
        );
      case "Sem Resposta":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-900 text-amber-900 text-[10px] font-bold uppercase font-mono">
            <HelpCircle size={12} /> Sem Resposta
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#F2F1EB] w-full max-w-2xl flex flex-col shadow-2xl max-h-[90vh] border-4 border-[#141414]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#141414] bg-[#E4E3E0]">
          <h2 className="font-mono text-base font-bold text-[#141414] uppercase tracking-tighter flex items-center gap-2">
            <Settings2 size={18} /> Configuração de Motivos e Submotivos de Status
          </h2>
          <button onClick={onClose} className="text-[#141414] hover:bg-[#141414] hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <p className="text-xs text-slate-700 font-mono">
            Cadastre ou altere os motivos disponíveis para seleção na coluna <strong>Status</strong>. Cada motivo deve ser atrelado obrigatoriamente a um dos 3 submotivos principais (<strong>Sucesso</strong>, <strong>Sem Sucesso</strong> ou <strong>Sem Resposta</strong>) para alimentar o cálculo do Resumo Executivo.
          </p>

          {/* Add Motivo Form */}
          <form onSubmit={handleAddMotivo} className="bg-white p-4 border-2 border-[#141414] shadow-[2px_2px_0px_rgba(0,0,0,1)] space-y-3">
            <h3 className="text-xs font-black uppercase text-[#141414]">Adicionar Novo Motivo</h3>
            <div className="flex flex-wrap sm:flex-nowrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold uppercase text-[#141414] block mb-1">
                  Nome do Motivo / Status
                </label>
                <input
                  type="text"
                  value={newMotivo}
                  onChange={(e) => setNewMotivo(e.target.value)}
                  placeholder="Ex: Acordo Fechado, Caixa Postal..."
                  className="w-full bg-[#F2F1EB] border-2 border-[#141414] px-3 py-1.5 text-xs font-mono text-[#141414] outline-none"
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="text-[10px] font-bold uppercase text-[#141414] block mb-1">
                  Submotivo Atrelado
                </label>
                <select
                  value={newSubMotivo}
                  onChange={(e) => setNewSubMotivo(e.target.value as SubMotivo)}
                  className="w-full bg-[#F2F1EB] border-2 border-[#141414] px-2 py-1.5 text-xs font-mono font-bold text-[#141414] outline-none cursor-pointer"
                >
                  <option value="Sucesso">Sucesso</option>
                  <option value="Sem Sucesso">Sem Sucesso</option>
                  <option value="Sem Resposta">Sem Resposta</option>
                </select>
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-1 px-4 py-2 bg-[#141414] text-white text-xs font-bold uppercase hover:bg-black transition-colors shrink-0"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {errorMsg && (
              <p className="text-red-700 font-mono text-[11px] font-bold">{errorMsg}</p>
            )}
          </form>

          {/* Table of Motivos */}
          <div className="bg-white border-2 border-[#141414] shadow-[2px_2px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="bg-[#E4E3E0] px-3 py-2 border-b-2 border-[#141414] flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-wider text-[#141414]">
                Motivos Cadastrados ({configs.length})
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="bg-[#F2F1EB] text-[10px] uppercase font-bold border-b border-[#141414] sticky top-0">
                  <tr>
                    <th className="px-3 py-2 border-r border-[#141414]">Motivo / Opção</th>
                    <th className="px-3 py-2 border-r border-[#141414]">Submotivo Mapeado</th>
                    <th className="px-3 py-2 text-center w-16">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {configs.map((item, idx) => (
                    <tr key={`${item.motivo}_${idx}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-bold text-[#141414]">{item.motivo}</td>
                      <td className="px-3 py-2">{getSubMotivoBadge(item.subMotivo)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemove(idx)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 transition-colors"
                          title="Remover motivo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {configs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-slate-500 italic">
                        Nenhum motivo cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[#141414] bg-[#E4E3E0] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border-2 border-[#141414] bg-white text-[#141414] text-xs font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-[#141414] text-white border-2 border-[#141414] text-xs font-bold uppercase hover:bg-black transition-colors"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
