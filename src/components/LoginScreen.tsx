import React, { useState } from "react";
import { Lock, User, ShieldCheck } from "lucide-react";

interface LoginScreenProps {
  onLogin: (username: string, role: 'admin' | 'editor') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLogin(data.username, data.role);
      } else {
        setError(data.error || "Usuário ou senha inválidos.");
      }
    } catch (err) {
      setError("Erro de conexão ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F1EB] flex items-center justify-center p-4">
      <div className="bg-white border-4 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-[#141414] text-white flex items-center justify-center rounded-none shadow-[4px_4px_0px_#C5C4C0] mb-3">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#141414]">Acesso ao Sistema</h1>
          <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mt-1">
            Gestão de Relatórios & Operações
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border-2 border-red-600 text-red-700 px-4 py-2 text-xs font-mono font-bold uppercase">
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#141414]">
              Usuário
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User size={16} />
              </span>
              <input
                type="text"
                required
                placeholder="Ex: Admin ou Operador 1"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm font-medium focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider mb-1 text-[#141414]">
              Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                placeholder="••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F2F1EB] border-2 border-[#141414] text-sm font-medium focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#141414] text-white font-black uppercase tracking-widest py-3 border-2 border-[#141414] shadow-[4px_4px_0px_#C5C4C0] hover:bg-black active:translate-y-1 active:translate-x-1 active:shadow-none transition-all text-xs disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar no Sistema"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center text-[10px] font-mono text-slate-500 uppercase">
          <div>Admin: Admin / Proativa_*2026</div>
          <div className="mt-1">Editores: Operador 1 a 15 / 123456</div>
        </div>
      </div>
    </div>
  );
};
