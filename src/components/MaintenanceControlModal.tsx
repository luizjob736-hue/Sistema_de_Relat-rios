import React, { useState } from "react";
import { Wrench, Lock, Unlock, AlertTriangle, CheckCircle2, RotateCw } from "lucide-react";

interface MaintenanceControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMaintenanceActive: boolean;
  currentMessage: string;
  onToggleMaintenance: (enabled: boolean, message: string) => Promise<void>;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const MaintenanceControlModal: React.FC<MaintenanceControlModalProps> = ({
  isOpen,
  onClose,
  isMaintenanceActive,
  currentMessage,
  onToggleMaintenance,
  showToast
}) => {
  const [enabledState, setEnabledState] = useState(isMaintenanceActive);
  const [messageInput, setMessageInput] = useState(currentMessage || "O sistema está temporariamente indisponível devido a uma manutenção programada. Por favor, tente novamente em breve.");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onToggleMaintenance(enabledState, messageInput);
      showToast(
        enabledState 
          ? "MODO DE MANUTENÇÃO ATIVADO: Acesso aos operadores foi suspenso." 
          : "SISTEMA LIBERADO: Modo de manutenção desativado com sucesso!",
        enabledState ? 'warning' : 'success'
      );
      onClose();
    } catch (e) {
      showToast("Erro ao atualizar modo de manutenção.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border-4 border-[#141414] shadow-[10px_10px_0px_#141414] max-w-lg w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-400 border-2 border-[#141414] flex items-center justify-center shadow-[2px_2px_0px_#141414] text-[#141414]">
              <Wrench size={22} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-[#141414]">
                Gerenciar Modo de Manutenção
              </h3>
              <p className="text-[10px] font-mono text-slate-600">
                Ativar ou desativar aviso de bloqueio para operadores
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-[#141414] text-white px-2.5 py-1 text-xs font-black uppercase hover:bg-red-700"
          >
            X
          </button>
        </div>

        {/* Toggle Switch Box */}
        <div className={`p-4 border-2 border-[#141414] flex items-center justify-between shadow-[3px_3px_0px_#141414] transition-colors ${
          enabledState ? 'bg-amber-100 border-amber-800' : 'bg-emerald-50 border-emerald-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 flex items-center justify-center border-2 border-[#141414] ${
              enabledState ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
            }`}>
              {enabledState ? <Lock size={16} /> : <Unlock size={16} />}
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider block text-[#141414]">
                Status do Sistema: {enabledState ? 'EM MANUTENÇÃO (BLOQUEADO)' : 'SISTEMA OPERACIONAL (LIBERADO)'}
              </span>
              <span className="text-[10px] font-mono text-slate-600 block">
                {enabledState ? 'Operadores não conseguem acessar o site' : 'Todos os operadores conseguem usar normalmente'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEnabledState(!enabledState)}
            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-[#141414] shadow-[2px_2px_0px_#141414] transition-all cursor-pointer ${
              enabledState ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-amber-400 text-amber-950 hover:bg-amber-500'
            }`}
          >
            {enabledState ? 'Liberar Sistema' : 'Ativar Manutenção'}
          </button>
        </div>

        {/* Custom Message Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#141414] block">
            Mensagem de Manutenção (Exibida na tela)
          </label>
          <textarea
            rows={3}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="w-full bg-[#F2F1EB] border-2 border-[#141414] p-2.5 text-xs font-bold text-[#141414] focus:outline-none focus:bg-white resize-none"
            placeholder="Escreva o aviso de manutenção aqui..."
          />
          <p className="text-[10px] font-mono text-slate-500">
            Esta mensagem será visualizada por qualquer operador que tentar acessar o sistema durante a manutenção.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t-2 border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 text-slate-800 px-4 py-2 border-2 border-[#141414] text-xs font-bold uppercase hover:bg-slate-300"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#141414] text-white px-5 py-2 border-2 border-[#141414] text-xs font-black uppercase shadow-[3px_3px_0px_#C5C4C0] hover:bg-black cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving && <RotateCw size={13} className="animate-spin text-amber-400" />}
            <span>{isSaving ? 'Salvando...' : 'Salvar Configuração'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceControlModal;
