import { Users, CheckCircle2, HelpCircle, XCircle, Clock } from "lucide-react";
import { ClientRecord } from "../types";

interface KPIStatsProps {
  records: ClientRecord[];
}

export default function KPIStats({ records }: KPIStatsProps) {
  const total = records.length;
  const comSucesso = records.filter((r) => r.status === "Com Sucesso").length;
  const semResposta = records.filter((r) => r.status === "Sem Resposta").length;
  const semSucesso = records.filter((r) => r.status === "Sem Sucesso").length;
  const naoTentado = records.filter((r) => r.status === "-").length;

  const pctSucesso = total > 0 ? Math.round((comSucesso / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
      {/* Total Card */}
      <div className="bg-[#D9D8D4] border border-[#141414] rounded-none p-4 flex items-center justify-between shadow-none transition-colors hover:bg-[#C5C4C0]">
        <div>
          <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
            TOTAL DE CLIENTES
          </span>
          <span className="text-xl font-mono font-bold text-[#141414]">{total}</span>
        </div>
        <div className="bg-white/40 p-2 border border-[#141414] rounded-none text-[#141414]">
          <Users size={16} />
        </div>
      </div>

      {/* Com Sucesso Card */}
      <div className="bg-[#D9D8D4] border border-[#141414] rounded-none p-4 flex items-center justify-between shadow-none transition-colors hover:bg-[#C5C4C0]">
        <div>
          <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
            COM SUCESSO
          </span>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-xl font-bold text-emerald-800">{comSucesso}</span>
            {total > 0 && (
              <span className="text-[10px] font-extrabold text-emerald-800">
                ({pctSucesso}%)
              </span>
            )}
          </div>
        </div>
        <div className="bg-emerald-100 p-2 border border-emerald-900 rounded-none text-emerald-900">
          <CheckCircle2 size={16} />
        </div>
      </div>

      {/* Sem Resposta Card */}
      <div className="bg-[#D9D8D4] border border-[#141414] rounded-none p-4 flex items-center justify-between shadow-none transition-colors hover:bg-[#C5C4C0]">
        <div>
          <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
            SEM RESPOSTA
          </span>
          <span className="text-xl font-mono font-bold text-amber-800">{semResposta}</span>
        </div>
        <div className="bg-amber-100 p-2 border border-amber-900 rounded-none text-amber-900">
          <HelpCircle size={16} />
        </div>
      </div>

      {/* Sem Sucesso Card */}
      <div className="bg-[#D9D8D4] border border-[#141414] rounded-none p-4 flex items-center justify-between shadow-none transition-colors hover:bg-[#C5C4C0]">
        <div>
          <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
            SEM SUCESSO
          </span>
          <span className="text-xl font-mono font-bold text-rose-800">{semSucesso}</span>
        </div>
        <div className="bg-rose-100 p-2 border border-rose-900 rounded-none text-rose-900">
          <XCircle size={16} />
        </div>
      </div>

      {/* Não Tentados Card */}
      <div className="bg-[#D9D8D4] border border-[#141414] rounded-none p-4 flex items-center justify-between shadow-none transition-colors hover:bg-[#C5C4C0]">
        <div>
          <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
            NÃO INICIADO
          </span>
          <span className="text-xl font-mono font-bold text-[#141414]">{naoTentado}</span>
        </div>
        <div className="bg-white/40 p-2 border border-[#141414] rounded-none text-slate-700">
          <Clock size={16} />
        </div>
      </div>
    </div>
  );
}
