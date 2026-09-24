import React, { useEffect, useState } from "react";
import { 
  Leaf, 
  MousePointerClick, 
  Clock, 
  WifiOff, 
  ShieldCheck, 
  AlertTriangle,
  Zap,
  Activity
} from "lucide-react";

interface IdleSessionModalProps {
  isOpen: boolean;
  username: string;
  idleSince: Date | null;
  remainingSecondsToLogout: number;
  onWakeUp: () => void;
}

export const IdleSessionModal: React.FC<IdleSessionModalProps> = ({
  isOpen,
  username,
  idleSince,
  remainingSecondsToLogout,
  onWakeUp
}) => {
  const [elapsedMinutes, setElapsedMinutes] = useState(7);

  useEffect(() => {
    if (!isOpen) return;

    const calculateElapsed = () => {
      if (!idleSince) {
        setElapsedMinutes(7);
        return;
      }
      const mins = Math.max(7, Math.floor((Date.now() - idleSince.getTime()) / 60000));
      setElapsedMinutes(mins);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 10000);
    return () => clearInterval(interval);
  }, [isOpen, idleSince]);

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSecondsToLogout / 60);
  const seconds = remainingSecondsToLogout % 60;
  const formattedCountdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isUrgent = remainingSecondsToLogout <= 120; // Last 2 minutes

  // Calculate percentage of the 8-minute data saver window (from 7min to 15min = 480 seconds total)
  const totalWindowSeconds = 8 * 60; // 480s
  const elapsedInSaverWindow = Math.max(0, totalWindowSeconds - remainingSecondsToLogout);
  const progressPercent = Math.min(100, Math.max(0, (elapsedInSaverWindow / totalWindowSeconds) * 100));

  return (
    <div 
      onClick={onWakeUp}
      className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer select-none animate-in fade-in duration-300"
      title="Clique em qualquer lugar para reativar"
    >
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onWakeUp();
        }}
        className="bg-white border-4 border-[#141414] shadow-[10px_10px_0px_#141414] max-w-lg w-full p-6 text-[#141414] relative transition-transform transform active:scale-[0.99]"
      >
        {/* Header Tag & Title */}
        <div className="flex items-start justify-between pb-4 border-b-2 border-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-300 border-2 border-[#141414] flex items-center justify-center shadow-[3px_3px_0px_#141414] text-[#141414]">
              <Leaf size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141414] text-amber-300 px-2 py-0.5">
                  Modo Economia de Dados
                </span>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5">
                  7min - 15min
                </span>
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight text-[#141414] mt-1">
                Sessão em Espera Econômica
              </h2>
            </div>
          </div>
        </div>

        {/* Countdown Box */}
        <div className="mt-4 p-4 border-2 border-[#141414] bg-[#F2F1EB] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock size={15} className="text-[#141414]" />
              Desconexão Automática em:
            </span>
            <span className={`font-mono text-xl font-black px-2.5 py-0.5 border-2 border-[#141414] ${
              isUrgent ? 'bg-rose-500 text-white animate-bounce' : 'bg-[#141414] text-amber-300'
            }`}>
              {formattedCountdown}
            </span>
          </div>

          {/* Progress Bar from 7min to 15min */}
          <div className="w-full bg-slate-300 h-2.5 border border-[#141414] overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                isUrgent ? 'bg-rose-600' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 font-bold">
            <span>7 min (Início economia)</span>
            <span>15 min (Logout)</span>
          </div>
        </div>

        {/* Info Content */}
        <div className="py-4 space-y-3">
          <div className="bg-white border-2 border-slate-300 p-3 text-xs font-mono space-y-1.5">
            <div className="flex justify-between items-center text-slate-600">
              <span>Usuário Conectado:</span>
              <span className="font-bold text-[#141414] bg-slate-100 px-1.5 py-0.5 border border-slate-300">
                {username}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Tempo sem interação:</span>
              <span className="font-bold text-amber-900">~{elapsedMinutes} minutos</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Status de rede:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <WifiOff size={13} className="text-amber-600" />
                Sincronizações contínuas pausadas
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed font-sans">
            Você está inativo há mais de <strong>7 minutos</strong>. O sistema entrou no <strong>Modo de Economia de Dados</strong> para poupar consumo de rede e recursos do servidor.
          </p>

          <div className="bg-emerald-50 border border-emerald-300 p-2.5 flex items-start gap-2.5 text-emerald-950 text-xs font-medium">
            <ShieldCheck size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Seus dados estão 100% seguros.</strong> Nenhuma alteração foi perdida. Se não houver interação até atingir 15 minutos, você será deslogado com segurança.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t-2 border-slate-200">
          <button
            type="button"
            onClick={onWakeUp}
            className="w-full flex items-center justify-center gap-2 bg-[#141414] text-white py-3.5 px-4 font-black uppercase text-xs tracking-wider border-2 border-[#141414] shadow-[4px_4px_0px_#C5C4C0] hover:bg-black hover:shadow-[5px_5px_0px_#141414] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <MousePointerClick size={16} className="text-amber-300 animate-bounce" />
            <span>Continuar Conectado / Reativar Sessão</span>
          </button>
          <p className="text-[10px] text-center font-mono text-slate-500 mt-2">
            Pressione qualquer tecla ou clique em qualquer ponto da tela
          </p>
        </div>
      </div>
    </div>
  );
};
