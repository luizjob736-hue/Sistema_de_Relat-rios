import React, { useState } from "react";
import { 
  ArrowLeft, 
  Activity, 
  Database, 
  RotateCw, 
  LogOut, 
  ShieldAlert,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  CloudOff,
  LayoutGrid,
  Shield
} from "lucide-react";
import { ReportSchema, UserRole } from "../types";
import AdminProductivityDashboard from "./AdminProductivityDashboard";
import AdminBackupsManager from "./AdminBackupsManager";

interface AdminManagementPageProps {
  currentUser: string;
  userRole: UserRole;
  schemas: ReportSchema[];
  todayTratativasCount: number;
  syncStatus: 'saved' | 'saving' | 'pending';
  pendingCount: number;
  isManualRefreshing: boolean;
  onRefresh: () => void;
  onFlushPendingQueue: () => void;
  onBackToBases: () => void;
  onLogout: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenUserManagement?: () => void;
  initialTab?: 'tratativas' | 'backups';
}

export const AdminManagementPage: React.FC<AdminManagementPageProps> = ({
  currentUser,
  userRole,
  schemas,
  todayTratativasCount,
  syncStatus,
  pendingCount,
  isManualRefreshing,
  onRefresh,
  onFlushPendingQueue,
  onBackToBases,
  onLogout,
  showToast,
  onOpenUserManagement,
  initialTab = 'tratativas'
}) => {
  const [activeTab, setActiveTab] = useState<'tratativas' | 'backups'>(initialTab);

  if (userRole !== 'admin') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#F2F1EB] p-6 text-center">
        <div className="w-16 h-16 bg-red-100 border-2 border-red-600 flex items-center justify-center mb-4 text-red-700 shadow-[4px_4px_0px_#141414]">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-black uppercase text-red-900">Acesso Restrito ao Administrador</h2>
        <p className="text-sm font-mono text-slate-600 mt-2 mb-6 max-w-md">
          Apenas usuários com permissão de Administrador têm acesso à central de produtividade e backups.
        </p>
        <button
          onClick={onBackToBases}
          className="flex items-center gap-2 bg-[#141414] text-white px-5 py-2.5 font-bold uppercase text-xs border-2 border-[#141414] shadow-[3px_3px_0px_rgba(0,0,0,0.3)] hover:bg-black transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> Voltar para as Bases
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F1EB] text-[#141414] font-sans flex flex-col h-screen overflow-hidden">
      {/* Top Header */}
      <header className="border-b-2 border-[#141414] bg-white shrink-0 shadow-xs z-20">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back Button to CRM */}
            <button
              onClick={onBackToBases}
              title="Voltar para a tela principal de bases e planilhas"
              className="flex items-center gap-2 bg-[#141414] text-white px-3.5 py-1.5 text-xs font-black uppercase hover:bg-black transition-all border-2 border-[#141414] shadow-[3px_3px_0px_#C5C4C0] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Voltar para as Bases</span>
            </button>

            <div className="h-6 w-[2px] bg-slate-200 hidden sm:block"></div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-black uppercase tracking-tight">
                  Painel de Gestão & Auditoria
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 border border-[#141414] uppercase bg-[#141414] text-white">
                  Admin: {currentUser}
                </span>

                {/* Cloud Sync Status Indicator */}
                {syncStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-300 rounded shadow-xs" title="Sincronizado com o banco de dados.">
                    <CheckCircle2 size={11} className="text-emerald-600" /> Salvo
                  </span>
                )}
                {syncStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-300 rounded animate-pulse">
                    <Loader2 size={11} className="animate-spin text-amber-600" /> Salvando...
                  </span>
                )}
                {syncStatus === 'pending' && (
                  <span 
                    onClick={onFlushPendingQueue}
                    className="flex items-center gap-1 text-[9px] font-mono font-bold text-orange-800 bg-orange-50 px-2 py-0.5 border border-orange-300 rounded cursor-pointer hover:bg-orange-100" 
                    title="Tentando sincronizar. Clique para forçar."
                  >
                    <CloudOff size={11} className="text-orange-600" /> {pendingCount} pendente(s)
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                Controle de Produtividade Diária & Rotina de Backups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenUserManagement && (
              <button
                onClick={onOpenUserManagement}
                title="Gerenciar usuários e bloquear ou liberar acesso às guias"
                className="flex items-center gap-1.5 bg-[#141414] text-white border-2 border-[#141414] px-3 py-1.5 text-xs font-black uppercase hover:bg-black transition-all shadow-[2px_2px_0px_#C5C4C0] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer"
              >
                <Shield size={14} className="text-amber-400" />
                <span>Bloqueios & Acessos</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isManualRefreshing}
              title="Atualizar dados do servidor"
              className="flex items-center gap-1.5 bg-[#F2F1EB] border-2 border-[#141414] px-3 py-1.5 text-xs font-bold uppercase hover:bg-[#E4E3E0] transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={13} className={isManualRefreshing ? "animate-spin text-blue-600" : "text-[#141414]"} />
              <span>{isManualRefreshing ? "Atualizando..." : "Atualizar Dados"}</span>
            </button>

            <button
              onClick={onLogout}
              title="Sair do sistema"
              className="flex items-center gap-1.5 bg-red-100 border-2 border-[#141414] text-red-700 px-3 py-1.5 text-xs font-bold uppercase hover:bg-red-200 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none cursor-pointer"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>

        {/* Dedicated Admin Sub-navigation Tabs */}
        <div className="px-5 flex items-center gap-2 bg-[#E4E3E0] pt-1.5 border-t-2 border-[#141414]">
          <button
            onClick={() => setActiveTab('tratativas')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-b-0 border-[#141414] rounded-t-sm transition-all cursor-pointer ${
              activeTab === 'tratativas'
                ? "bg-white text-amber-950 shadow-[0px_-2px_0px_rgba(0,0,0,1)] z-10 -mb-[2px] font-black"
                : "bg-[#D1D0CC] text-[#141414]/70 hover:bg-[#DDDCD7] hover:text-[#141414]"
            }`}
          >
            <Activity size={15} className={activeTab === 'tratativas' ? "text-amber-800" : "text-slate-600"} />
            <span>Tratativas Diárias dos Operadores</span>
            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
              activeTab === 'tratativas' ? 'bg-amber-800 text-white' : 'bg-slate-300 text-slate-800'
            }`}>
              {todayTratativasCount} hoje
            </span>
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-b-0 border-[#141414] rounded-t-sm transition-all cursor-pointer ${
              activeTab === 'backups'
                ? "bg-white text-emerald-950 shadow-[0px_-2px_0px_rgba(0,0,0,1)] z-10 -mb-[2px] font-black"
                : "bg-[#D1D0CC] text-[#141414]/70 hover:bg-[#DDDCD7] hover:text-[#141414]"
            }`}
          >
            <Database size={15} className={activeTab === 'backups' ? "text-emerald-800" : "text-slate-600"} />
            <span>Backups Automáticos & Download de Bases</span>
          </button>
        </div>
      </header>

      {/* Main Dedicated Content View */}
      <main className="flex-1 overflow-hidden p-6">
        <section className="h-full bg-white border-4 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col relative z-0 overflow-y-auto">
          {activeTab === 'tratativas' ? (
            <div className="p-6">
              <AdminProductivityDashboard 
                schemas={schemas} 
                onRefreshTrigger={onRefresh} 
              />
            </div>
          ) : (
            <div className="p-6">
              <AdminBackupsManager 
                schemas={schemas} 
                onDataRestored={onRefresh} 
                showToast={showToast} 
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
