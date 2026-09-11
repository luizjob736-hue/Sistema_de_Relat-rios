import React, { useEffect, useState } from "react";
import { Moon, MousePointerClick, RefreshCw, Zap, ShieldCheck } from "lucide-react";

interface IdleSessionModalProps {
  isOpen: boolean;
  username: string;
  idleSince: Date | null;
  onWakeUp: () => void;
}

export const IdleSessionModal: React.FC<IdleSessionModalProps> = ({
  isOpen,
  username,
  idleSince,
  onWakeUp
}) => {
  const [elapsedMinutes, setElapsedMinutes] = useState(15);

  useEffect(() => {
    if (!isOpen) return;

    const calculateElapsed = () => {
      if (!idleSince) {
        setElapsedMinutes(15);
        return;
      }
      const mins = Math.max(15, Math.floor((Date.now() - idleSince.getTime()) / 60000));
      setElapsedMinutes(mins);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 15000);
    return () => clearInterval(interval);
  }, [isOpen, idleSince]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={onWakeUp}
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer select-none animate-in fade-in duration-300"
      title="Clique em qualquer lugar para reativar"
    >
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onWakeUp();
        }}
        className="bg-white border-4 border-[#141414] shadow-[10px_10px_0px_#141414] max-w-md w-full p-6 text-[#141414] relative transition-transform transform active:scale-95"
      >
        {/* Header Icon Badge */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-100 border-2 border-[#141414] flex items-center justify-center shadow-[3px_3px_0px_#141414] text-amber-900">
              <Moon size={22} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141414] text-white px-2 py-0.5">
                Modo de Espera • 15 min
              </span>
              <h2 className="text-base font-black uppercase tracking-tight text-[#141414] mt-0.5">
                Sessão Inativa por Ausência
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="py-5 space-y-4">
          <div className="bg-[#F2F1EB] border-2 border-[#141414] p-3 text-xs font-mono space-y-1">
            <div className="flex justify-between items-center text-slate-600">
              <span>Usuário:</span>
              <span className="font-bold text-[#141414] bg-white px-1.5 py-0.5 border border-slate-300">{username}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Tempo sem interação:</span>
              <span className="font-bold text-amber-800">~{elapsedMinutes} minutos</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Estado da conexão:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                Em repouso (Econômico)
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            As sincronizações em segundo plano foram pausadas exclusivamente para <strong>{username}</strong> para economizar tráfego e recursos de rede. 
            Nenhuma informação ou alteração pendente foi perdida.
          </p>

          <div className="bg-emerald-50 border border-emerald-300 p-2.5 flex items-center gap-2 text-emerald-900 text-xs font-medium rounded-xs">
            <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
            <span>Ao clicar na tela, sua sessão reativa instantaneamente e sincroniza com o servidor.</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onWakeUp}
            className="w-full flex items-center justify-center gap-2 bg-[#141414] text-white py-3 px-4 font-black uppercase text-xs tracking-wider border-2 border-[#141414] shadow-[4px_4px_0px_#C5C4C0] hover:bg-black hover:shadow-[5px_5px_0px_#141414] transition-all cursor-pointer"
          >
            <MousePointerClick size={16} className="text-amber-400 animate-bounce" />
            <span>Clique Aqui Para Reativar Agora</span>
          </button>
          <p className="text-[10px] text-center font-mono text-slate-400 mt-2">
            Pressione qualquer tecla ou clique em qualquer ponto da tela
          </p>
        </div>
      </div>
    </div>
  );
};
