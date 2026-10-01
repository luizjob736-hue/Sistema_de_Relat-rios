import React, { useState } from "react";
import { 
  Wrench, 
  ShieldAlert, 
  Clock, 
  RotateCw, 
  Lock, 
  User, 
  ShieldCheck, 
  AlertTriangle,
  Server,
  Unlock,
  CheckCircle2
} from "lucide-react";
import { UserRole } from "../types";

interface MaintenanceScreenProps {
  message?: string;
  enabledAt?: string | null;
  onRefreshStatus: () => void;
  onAdminBypassLogin: (username: string, role: UserRole, blockedGuides?: string[]) => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  message = "O sistema está temporariamente indisponível devido a uma manutenção programada. Por favor, tente novamente em breve.",
  enabledAt,
  onRefreshStatus,
  onAdminBypassLogin
}) => {
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState("Admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const formattedDate = enabledAt ? (() => {
    try {
      const d = new Date(enabledAt);
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return null;
    }
  })() : null;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.role === 'admin') {
          onAdminBypassLogin(data.username, data.role, data.blockedGuides || []);
        } else {
          setLoginError("Apenas o perfil Administrador pode acessar durante o modo de manutenção.");
        }
      } else {
        setLoginError(data.error || "Credenciais de Administrador inválidas.");
      }
    } catch (err) {
      setLoginError("Erro de conexão ao autenticar.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCheckNow = async () => {
    setIsCheckingStatus(true);
    await onRefreshStatus();
    setTimeout(() => setIsCheckingStatus(false), 600);
  };

  return (
    <div className="min-h-screen bg-[#F2F1EB] flex items-center justify-center p-4 select-none font-sans text-[#141414]">
      <div className="bg-white border-4 border-[#141414] shadow-[12px_12px_0px_#141414] max-w-lg w-full p-8 relative animate-in fade-in duration-300">
        
        {/* Top Warning Badge Header */}
        <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b-4 border-[#141414]">
          <div className="w-20 h-20 bg-amber-400 border-4 border-[#141414] flex items-center justify-center shadow-[4px_4px_0px_#141414] text-[#141414] mb-1 relative">
            <Wrench size={40} className="animate-pulse" />
            <span className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full border-2 border-[#141414]">
              <Lock size={14} />
            </span>
          </div>

          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-950 px-3 py-1 border-2 border-[#141414] font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_#141414]">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
            <span>Sistema em Manutenção</span>
          </div>

          <h1 className="text-2xl font-black uppercase tracking-tight text-[#141414] leading-tight">
            Acesso Temporariamente Suspenso
          </h1>
          <p className="text-xs font-mono text-slate-600 max-w-sm">
            O sistema está passando por ajustes e melhorias na infraestrutura no momento.
          </p>
        </div>

        {/* Message Content Box */}
        <div className="py-6 space-y-4">
          <div className="bg-[#F2F1EB] border-2 border-[#141414] p-4 space-y-3 shadow-[3px_3px_0px_#141414]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-800 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed text-[#141414]">
                {message}
              </p>
            </div>

            {formattedDate && (
              <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-[10px] font-mono text-slate-600">
                <span>Início da manutenção:</span>
                <span className="font-bold text-[#141414] bg-white px-1.5 py-0.5 border border-slate-300">
                  {formattedDate}
                </span>
              </div>
            )}
          </div>

          {/* Key Security Guarantees */}
          <div className="bg-emerald-50 border-2 border-emerald-700 p-3 text-emerald-950 text-xs font-medium space-y-1">
            <div className="flex items-center gap-2 font-bold uppercase text-[10px] text-emerald-900 tracking-wider">
              <ShieldCheck size={14} className="text-emerald-700" />
              <span>Integridade dos Dados Mantida</span>
            </div>
            <p className="text-[11px] leading-snug">
              Todas as suas propostas e planilhas cadastradas estão salvas com segurança. Nenhuma informação foi alterada ou removida.
            </p>
          </div>
        </div>

        {/* Control Action Buttons */}
        <div className="space-y-3 pt-2 border-t-2 border-slate-200">
          <button
            type="button"
            onClick={handleCheckNow}
            disabled={isCheckingStatus}
            className="w-full flex items-center justify-center gap-2 bg-[#141414] text-white py-3.5 px-4 font-black uppercase text-xs tracking-wider border-2 border-[#141414] shadow-[4px_4px_0px_#C5C4C0] hover:bg-black hover:shadow-[5px_5px_0px_#141414] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCw size={15} className={isCheckingStatus ? "animate-spin text-amber-400" : "text-amber-400"} />
            <span>{isCheckingStatus ? "Verificando Servidor..." : "Verificar se a Manutenção Terminou"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdminLoginModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#F2F1EB] text-[#141414] py-2.5 px-4 font-black uppercase text-xs tracking-wider border-2 border-[#141414] shadow-[3px_3px_0px_#141414] hover:bg-white active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <Unlock size={14} className="text-amber-800" />
            <span>Acesso Restrito do Administrador (Bypass)</span>
          </button>
        </div>

        <div className="mt-6 text-center text-[10px] font-mono text-slate-500 uppercase">
          <span>Obrigado pela compreensão • Proativa Mídia 2026</span>
        </div>
      </div>

      {/* Admin Bypass Login Modal */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-4 border-[#141414] shadow-[10px_10px_0px_#141414] max-w-md w-full p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#141414]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#141414] text-amber-400 flex items-center justify-center font-black border border-[#141414]">
                  <Lock size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-[#141414]">Login de Administrador</h3>
                  <p className="text-[10px] font-mono text-slate-500">Desbloquear acesso ou desligar manutenção</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdminLoginModal(false)}
                className="bg-[#141414] text-white px-2.5 py-1 text-xs font-black uppercase border border-[#141414] hover:bg-red-700"
              >
                X
              </button>
            </div>

            {loginError && (
              <div className="bg-red-100 border-2 border-red-600 text-red-800 p-2.5 text-xs font-mono font-bold uppercase">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider mb-1 text-[#141414]">
                  Usuário Administrador
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <User size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-[#F2F1EB] border-2 border-[#141414] text-xs font-bold focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider mb-1 text-[#141414]">
                  Senha do Administrador
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-[#F2F1EB] border-2 border-[#141414] text-xs font-bold focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="w-1/3 bg-slate-200 text-slate-800 border-2 border-[#141414] py-2 text-xs font-bold uppercase hover:bg-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-2/3 bg-[#141414] text-white border-2 border-[#141414] py-2 text-xs font-black uppercase shadow-[3px_3px_0px_#C5C4C0] hover:bg-black active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? "Autenticando..." : "Acessar Sistema"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceScreen;
