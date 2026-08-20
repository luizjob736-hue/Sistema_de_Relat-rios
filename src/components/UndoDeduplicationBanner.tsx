import React, { useState, useEffect } from "react";
import { RotateCcw, Clock, Trash2, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { DeduplicationSession } from "../types";

interface UndoDeduplicationBannerProps {
  session: DeduplicationSession | null;
  onUndo: (session: DeduplicationSession) => void;
  onDismiss: (sessionId: string) => void;
}

export const UndoDeduplicationBanner: React.FC<UndoDeduplicationBannerProps> = ({
  session,
  onUndo,
  onDismiss
}) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= session.expiresAt) {
        onDismiss(session.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, onDismiss]);

  if (!session) return null;

  const timeLeftMs = Math.max(0, session.expiresAt - now);
  if (timeLeftMs <= 0) return null;

  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = minutes < 5;

  return (
    <div className="bg-amber-100 border-b-2 border-[#141414] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shadow-[0_2px_0_rgba(0,0,0,0.1)] animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 text-amber-950">
        <div className="bg-amber-300 border border-[#141414] p-1 shadow-2xs">
          <RotateCcw size={14} className="text-[#141414]" />
        </div>
        <div>
          <span className="font-bold uppercase tracking-wider text-[#141414]">
            Duplicatas removidas na guia "{session.schemaName}":
          </span>{" "}
          <span className="text-slate-800">
            <strong>{session.removedRecords.length}</strong> registro(s) excluídos com base na coluna <strong>"{session.columnLabel}"</strong>.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Countdown Timer */}
        <div className={`flex items-center gap-1 px-2 py-0.5 border font-bold text-[11px] ${
          isUrgent
            ? "bg-rose-100 border-rose-600 text-rose-900 animate-pulse"
            : "bg-white border-[#141414] text-[#141414]"
        }`}>
          <Clock size={12} className={isUrgent ? "text-rose-700" : "text-slate-600"} />
          <span>Desfazer disponível: <strong className="font-mono">{timeFormatted}</strong></span>
        </div>

        {/* Undo Action Button */}
        <button
          type="button"
          onClick={() => onUndo(session)}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#141414] text-white border-2 border-[#141414] text-[11px] font-black uppercase hover:bg-emerald-700 hover:border-emerald-900 transition-all active:translate-y-0.5 shadow-[2px_2px_0px_rgba(0,0,0,0.8)] cursor-pointer"
          title="Restaurar todos os registros que foram removidos nesta operação"
        >
          <RotateCcw size={12} />
          <span>Desfazer Remoção ({session.removedRecords.length})</span>
        </button>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={() => onDismiss(session.id)}
          className="text-slate-600 hover:text-red-700 transition-colors p-0.5"
          title="Descartar backup e confirmar exclusão definitiva"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
