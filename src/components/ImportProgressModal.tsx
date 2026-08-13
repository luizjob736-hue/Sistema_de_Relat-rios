import React from "react";
import { CheckCircle2, Loader2, AlertTriangle, FileSpreadsheet, Database, RefreshCw, Sparkles, X } from "lucide-react";

export interface ImportProgressState {
  isImporting: boolean;
  total: number;
  current: number;
  step: 'validating' | 'uploading' | 'syncing' | 'completed' | 'error';
  errorMessage?: string;
  reportName: string;
}

interface ImportProgressModalProps {
  progress: ImportProgressState;
  onClose: () => void;
}

export function ImportProgressModal({ progress, onClose }: ImportProgressModalProps) {
  if (!progress.isImporting && progress.step === 'validating' && progress.current === 0) {
    return null;
  }

  const percentage = progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : (progress.step === 'completed' ? 100 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#F2F1EB] w-full max-w-lg border-2 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#141414] text-white border-b-2 border-[#141414]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-amber-400" size={20} />
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
              Progresso de Importação
            </h3>
          </div>
          {progress.step === 'completed' || progress.step === 'error' ? (
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-400 text-black font-mono text-[10px] font-bold uppercase">
              <Loader2 size={12} className="animate-spin" />
              <span>Processando</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Target Info */}
          <div className="bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)] flex justify-between items-center">
            <div>
              <span className="text-[10px] font-mono uppercase font-black text-slate-500 block">Guia de Destino</span>
              <span className="text-sm font-bold text-[#141414]">{progress.reportName || "Relatório"}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase font-black text-slate-500 block">Total de Registros</span>
              <span className="text-sm font-mono font-black text-[#141414]">{progress.total.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex justify-between items-end font-mono">
              <span className="text-xs font-bold text-[#141414]">
                {progress.step === 'completed'
                  ? "Importação concluída com sucesso!"
                  : progress.step === 'error'
                  ? "Ocorreu um erro no processo"
                  : `Enviando registros: ${progress.current.toLocaleString('pt-BR')} / ${progress.total.toLocaleString('pt-BR')}`}
              </span>
              <span className="text-lg font-black text-[#141414]">{percentage}%</span>
            </div>

            <div className="w-full bg-white border-2 border-[#141414] h-6 p-0.5 relative overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out flex items-center justify-end pr-2 font-mono text-[10px] font-bold text-white
                  ${progress.step === 'error' ? 'bg-red-600' : progress.step === 'completed' ? 'bg-emerald-600' : 'bg-[#141414]'}`}
                style={{ width: `${percentage}%` }}
              >
                {percentage > 10 && `${percentage}%`}
              </div>
            </div>
          </div>

          {/* Step List */}
          <div className="bg-white border-2 border-[#141414] divide-y divide-[#141414]">
            {/* Step 1 */}
            <div className="p-3 flex items-center gap-3">
              {progress.step === 'validating' ? (
                <Loader2 size={18} className="animate-spin text-amber-600 shrink-0" />
              ) : (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-xs font-bold text-[#141414]">1. Validação da Estrutura CSV</p>
                <p className="text-[10px] font-mono text-slate-500">Formato, colunas fixas e valores validados</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-3 flex items-center gap-3">
              {progress.step === 'uploading' ? (
                <Loader2 size={18} className="animate-spin text-blue-600 shrink-0" />
              ) : progress.step === 'syncing' || progress.step === 'completed' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <Database size={18} className="text-slate-300 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-xs font-bold text-[#141414]">2. Gravação no Banco de Dados</p>
                <p className="text-[10px] font-mono text-slate-500">Transmissão em lote e indexação</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-3 flex items-center gap-3">
              {progress.step === 'syncing' ? (
                <RefreshCw size={18} className="animate-spin text-purple-600 shrink-0" />
              ) : progress.step === 'completed' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <Sparkles size={18} className="text-slate-300 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-xs font-bold text-[#141414]">3. Sincronização & Cache</p>
                <p className="text-[10px] font-mono text-slate-500">Atualização de índices e contagens de status</p>
              </div>
            </div>
          </div>

          {/* Error Details if any */}
          {progress.step === 'error' && (
            <div className="bg-red-50 border-2 border-red-900 p-3 text-red-950 text-xs font-mono flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 text-red-700 mt-0.5" />
              <div>
                <span className="font-bold block">Falha na Importação:</span>
                <span>{progress.errorMessage || "Ocorreu um erro ao comunicar com o servidor."}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#E4E3E0] border-t-2 border-[#141414] flex justify-end">
          {progress.step === 'completed' && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-700 text-white border-2 border-[#141414] text-xs font-bold uppercase tracking-wider hover:bg-emerald-800 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:translate-x-0.5"
            >
              Concluir e Ver Tabela
            </button>
          )}

          {progress.step === 'error' && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-red-700 text-white border-2 border-[#141414] text-xs font-bold uppercase tracking-wider hover:bg-red-800 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)]"
            >
              Fechar
            </button>
          )}

          {(progress.step === 'validating' || progress.step === 'uploading' || progress.step === 'syncing') && (
            <div className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[#141414]" />
              <span>Aguarde, gravando registros... Por favor não feche a janela.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
