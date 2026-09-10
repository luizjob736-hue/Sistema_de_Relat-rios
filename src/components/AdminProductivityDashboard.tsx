import React, { useState, useEffect } from "react";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Calendar, 
  RefreshCw, 
  Download, 
  Search, 
  Filter, 
  Clock, 
  Activity, 
  Award, 
  TrendingUp,
  FileSpreadsheet,
  Layers,
  UserCheck
} from "lucide-react";
import { DailyTratativasSummary, TratativaLog, ReportSchema } from "../types";
import * as xlsx from "xlsx";

interface AdminProductivityDashboardProps {
  schemas: ReportSchema[];
  onRefreshTrigger?: () => void;
}

export default function AdminProductivityDashboard({ schemas, onRefreshTrigger }: AdminProductivityDashboardProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<DailyTratativasSummary | null>(null);
  const [logs, setLogs] = useState<TratativaLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [reportFilter, setReportFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'logs'>('overview');

  const fetchStats = async (dateStr: string) => {
    setIsLoading(true);
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch(`/api/tratativas/stats?date=${dateStr}`),
        fetch(`/api/tratativas?date=${dateStr}&limit=500`)
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setSummary(data);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas de tratativas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(selectedDate);
  }, [selectedDate]);

  // Quick Date Helpers
  const setQuickDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    if (userFilter !== "ALL" && log.username !== userFilter) return false;
    if (reportFilter !== "ALL" && log.reportId !== reportFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchClient = (log.clientName || "").toLowerCase().includes(s);
      const matchCpf = (log.clientCpf || "").toLowerCase().includes(s);
      const matchUser = (log.username || "").toLowerCase().includes(s);
      const matchAction = (log.actionType || "").toLowerCase().includes(s);
      if (!matchClient && !matchCpf && !matchUser && !matchAction) return false;
    }
    return true;
  });

  // Export Daily Productivity to Excel
  const handleExportProductivityExcel = () => {
    if (!summary) return;

    const wb = xlsx.utils.book_new();

    // Sheet 1: Produtividade por Usuário
    const userRows = summary.userStats.map((u, index) => {
      const pct = u.totalTratativas > 0 ? Math.round((u.comSucesso / u.totalTratativas) * 100) : 0;
      return {
        "Posição": index + 1,
        "Usuário / Operador": u.username,
        "Função": u.userRole === 'admin' ? 'Administrador' : u.userRole === 'viewer' ? 'Visualizador' : 'Operador',
        "Total de Tratativas": u.totalTratativas,
        "Com Sucesso": u.comSucesso,
        "Taxa de Sucesso (%)": `${pct}%`,
        "Sem Sucesso": u.semSucesso,
        "Sem Resposta": u.semResposta,
        "Outras Modificações": u.outras,
        "Última Atividade": u.lastActivityTime ? new Date(u.lastActivityTime).toLocaleTimeString('pt-BR') : "-",
        "Bases Trabalhadas": u.reportsWorked.join(", ") || "-"
      };
    });
    const wsUsers = xlsx.utils.json_to_sheet(userRows.length > 0 ? userRows : [{ "Aviso": "Sem tratativas" }]);
    xlsx.utils.book_append_sheet(wb, wsUsers, "Produtividade por Operador");

    // Sheet 2: Logs Detalhados
    const logRows = logs.map(l => ({
      "Data/Hora": new Date(l.createdAt).toLocaleString('pt-BR'),
      "Operador": l.username,
      "Base (ID)": l.reportId,
      "Cliente": l.clientName || "-",
      "CPF": l.clientCpf || "-",
      "Tipo": l.actionType,
      "Detalhes": JSON.stringify(l.details || {})
    }));
    const wsLogs = xlsx.utils.json_to_sheet(logRows.length > 0 ? logRows : [{ "Aviso": "Nenhum log gravado" }]);
    xlsx.utils.book_append_sheet(wb, wsLogs, "Logs de Tratativas");

    xlsx.writeFile(wb, `relatorio_produtividade_tratativas_${selectedDate}.xlsx`);
  };

  const topPerformer = summary?.userStats && summary.userStats.length > 0 && summary.userStats[0].totalTratativas > 0 
    ? summary.userStats[0] 
    : null;

  return (
    <div className="space-y-6">
      {/* Header & Date Controls */}
      <div className="bg-[#D9D8D4] border border-[#141414] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-[#141414] text-white px-2 py-0.5">
              PAINEL ADMINISTRATIVO
            </span>
            <span className="text-xs font-bold text-slate-700">Controle de Produtividade Diária</span>
          </div>
          <h2 className="text-lg font-bold text-[#141414] mt-1 flex items-center gap-2 font-mono">
            <Activity size={18} className="text-[#141414]" />
            Relatório de Tratativas por Operador
          </h2>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#EBEAE5] border border-[#141414] px-2 py-1">
            <Calendar size={14} className="text-slate-700" />
            <span className="text-xs font-bold uppercase text-slate-700 mr-1">Data:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-[#141414] outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setQuickDate(0)}
            className={`px-2.5 py-1 text-xs font-bold uppercase transition-colors border border-[#141414] ${
              selectedDate === new Date().toISOString().split('T')[0]
                ? 'bg-[#141414] text-white'
                : 'bg-[#EBEAE5] text-[#141414] hover:bg-[#C5C4C0]'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setQuickDate(1)}
            className="px-2.5 py-1 text-xs font-bold uppercase bg-[#EBEAE5] text-[#141414] hover:bg-[#C5C4C0] transition-colors border border-[#141414]"
          >
            Ontem
          </button>

          <button
            onClick={() => fetchStats(selectedDate)}
            disabled={isLoading}
            className="p-1.5 bg-[#EBEAE5] text-[#141414] hover:bg-[#C5C4C0] border border-[#141414] transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={handleExportProductivityExcel}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase border border-[#141414] shadow-none transition-colors"
          >
            <Download size={14} />
            Exportar (.XLSX)
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* Total Tratativas no Dia */}
        <div className="bg-[#D9D8D4] border border-[#141414] p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
              TRATATIVAS NO DIA
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-[#141414]">
                {summary?.totalToday || 0}
              </span>
              <span className="text-[10px] font-bold text-slate-600">ações</span>
            </div>
          </div>
          <div className="bg-white/50 p-2 border border-[#141414] text-[#141414]">
            <TrendingUp size={16} />
          </div>
        </div>

        {/* Com Sucesso */}
        <div className="bg-[#D9D8D4] border border-[#141414] p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
              COM SUCESSO
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-emerald-800">
                {summary?.comSucessoToday || 0}
              </span>
              {summary && summary.totalToday > 0 && (
                <span className="text-[11px] font-bold text-emerald-800">
                  ({Math.round((summary.comSucessoToday / summary.totalToday) * 100)}%)
                </span>
              )}
            </div>
          </div>
          <div className="bg-emerald-100 p-2 border border-emerald-900 text-emerald-900">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* Sem Sucesso */}
        <div className="bg-[#D9D8D4] border border-[#141414] p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
              SEM SUCESSO
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-rose-800">
                {summary?.semSucessoToday || 0}
              </span>
            </div>
          </div>
          <div className="bg-rose-100 p-2 border border-rose-900 text-rose-900">
            <XCircle size={16} />
          </div>
        </div>

        {/* Sem Resposta */}
        <div className="bg-[#D9D8D4] border border-[#141414] p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
              SEM RESPOSTA
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-amber-800">
                {summary?.semRespostaToday || 0}
              </span>
            </div>
          </div>
          <div className="bg-amber-100 p-2 border border-amber-900 text-amber-900">
            <HelpCircle size={16} />
          </div>
        </div>

        {/* Outras Ações / Sem Status */}
        <div className="bg-[#D9D8D4] border border-[#141414] p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5" title="Ações ou edições realizadas em registros que não possuem status definido">
              SEM STATUS / OUTRAS
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-2xl font-bold text-slate-700">
                {summary?.outrasToday || 0}
              </span>
            </div>
          </div>
          <div className="bg-slate-200 p-2 border border-slate-700 text-slate-800">
            <Layers size={16} />
          </div>
        </div>

        {/* Operadores Ativos & Destaque */}
        <div className="bg-[#D9D8D4] border border-[#141414] p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest block mb-0.5">
              OPERADORES ATIVOS
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-[#141414]">
                {summary?.activeUsersCount || 0}
              </span>
              <span className="text-[10px] font-bold text-slate-600">
                de {summary?.userStats?.length || 0}
              </span>
            </div>
            {topPerformer && (
              <span className="text-[9px] font-bold text-amber-900 truncate block max-w-[110px]">
                ★ Top: {topPerformer.username} ({topPerformer.totalTratativas})
              </span>
            )}
          </div>
          <div className="bg-amber-200/80 p-2 border border-amber-900 text-amber-950">
            <Award size={16} />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Switch */}
      <div className="flex border-b border-[#141414] gap-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-t border-l border-r border-[#141414] ${
            activeSubTab === 'overview'
              ? 'bg-[#EBEAE5] text-[#141414] border-b-2 border-b-[#EBEAE5] font-extrabold'
              : 'bg-[#D9D8D4] text-slate-700 hover:bg-[#C5C4C0]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users size={14} />
            <span>Tabela de Produtividade por Operador</span>
          </div>
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-t border-l border-r border-[#141414] ${
            activeSubTab === 'logs'
              ? 'bg-[#EBEAE5] text-[#141414] border-b-2 border-b-[#EBEAE5] font-extrabold'
              : 'bg-[#D9D8D4] text-slate-700 hover:bg-[#C5C4C0]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>Log Detalhado de Tratativas ({logs.length})</span>
          </div>
        </button>
      </div>

      {/* SUB-TAB 1: USER PRODUCTIVITY TABLE */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Table Container */}
          <div className="bg-[#EBEAE5] border border-[#141414] overflow-hidden">
            <div className="p-3 bg-[#D9D8D4] border-b border-[#141414] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#141414]">
                Acompanhamento Individual por Usuário ({summary?.userStats?.length || 0} cadastrados)
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-600">
                Data de referência: {selectedDate.split('-').reverse().join('/')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#141414] text-white uppercase text-[10px] tracking-wider">
                    <th className="p-2.5 border-r border-slate-700 text-center w-12">#</th>
                    <th className="p-2.5 border-r border-slate-700">Operador / Usuário</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">Função</th>
                    <th className="p-2.5 border-r border-slate-700 text-center font-mono">Total Tratativas</th>
                    <th className="p-2.5 border-r border-slate-700 text-center text-emerald-300 font-mono">Com Sucesso</th>
                    <th className="p-2.5 border-r border-slate-700 text-center text-rose-300 font-mono">Sem Sucesso</th>
                    <th className="p-2.5 border-r border-slate-700 text-center text-amber-300 font-mono">Sem Resposta</th>
                    <th className="p-2.5 border-r border-slate-700 text-center text-slate-300 font-mono" title="Ações/Edições em registros que ainda não tiveram status definido">Sem Status</th>
                    <th className="p-2.5 border-r border-slate-700 text-center font-mono">Taxa de Sucesso</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">Último Horário</th>
                    <th className="p-2.5">Bases Trabalhadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]">
                  {(!summary?.userStats || summary.userStats.length === 0) ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-600 italic">
                        Nenhum dado de produtividade encontrado para esta data.
                      </td>
                    </tr>
                  ) : (
                    summary.userStats.map((u, idx) => {
                      const pct = u.totalTratativas > 0 ? Math.round((u.comSucesso / u.totalTratativas) * 100) : 0;
                      const isActive = u.totalTratativas > 0;
                      const isWinner = idx === 0 && u.totalTratativas > 0;

                      return (
                        <tr 
                          key={u.username} 
                          className={`hover:bg-[#D9D8D4] transition-colors ${
                            isWinner ? 'bg-amber-50/60 font-semibold' : ''
                          }`}
                        >
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-slate-700">
                            {isWinner ? "👑 1" : idx + 1}
                          </td>
                          <td className="p-2.5 border-r border-[#141414]">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                              <span className="font-bold text-[#141414]">{u.username}</span>
                            </div>
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${
                              u.userRole === 'admin' 
                                ? 'bg-purple-200 text-purple-900 border border-purple-800' 
                                : u.userRole === 'viewer'
                                ? 'bg-slate-200 text-slate-800 border border-slate-700'
                                : 'bg-blue-100 text-blue-900 border border-blue-800'
                            }`}>
                              {u.userRole === 'admin' ? 'Admin' : u.userRole === 'viewer' ? 'Visualizador' : 'Operador'}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-base text-[#141414]">
                            {u.totalTratativas}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-emerald-800">
                            {u.comSucesso}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-rose-800">
                            {u.semSucesso}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-amber-800">
                            {u.semResposta}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-slate-600">
                            {u.outras}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-16 bg-slate-300 h-2 border border-[#141414] overflow-hidden">
                                <div 
                                  className="bg-emerald-700 h-full" 
                                  style={{ width: `${Math.min(100, pct)}%` }} 
                                />
                              </div>
                              <span className="font-bold text-[11px]">{pct}%</span>
                            </div>
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-center font-mono text-[11px] text-slate-700">
                            {u.lastActivityTime ? (
                              <span className="flex items-center justify-center gap-1">
                                <Clock size={12} />
                                {new Date(u.lastActivityTime).toLocaleTimeString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-2.5 text-[11px] text-slate-700">
                            {u.reportsWorked && u.reportsWorked.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {u.reportsWorked.map((baseName, bIdx) => (
                                  <span key={bIdx} className="bg-[#D9D8D4] border border-[#141414] px-1.5 py-0.5 text-[9px] font-bold">
                                    {baseName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">Nenhuma base</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hourly Distribution Timeline */}
          {summary?.hourlyDistribution && summary.hourlyDistribution.length > 0 && (
            <div className="bg-[#EBEAE5] border border-[#141414] p-4">
              <div className="flex items-center justify-between mb-3 border-b border-[#141414] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#141414] flex items-center gap-2">
                  <Clock size={14} />
                  Ritmo de Produção por Hora do Dia
                </span>
                <span className="text-[10px] font-mono text-slate-600">Volume de tratativas por faixa de horário</span>
              </div>

              <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-2">
                {summary.hourlyDistribution.map((item) => {
                  const maxCount = Math.max(...summary.hourlyDistribution.map(h => h.count), 1);
                  const heightPct = Math.max(10, Math.round((item.count / maxCount) * 100));

                  return (
                    <div key={item.hour} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono font-bold text-[#141414]">
                        {item.count > 0 ? item.count : "-"}
                      </span>
                      <div className="w-full bg-[#D9D8D4] border border-[#141414] h-20 flex items-end p-0.5">
                        <div 
                          className="w-full bg-[#141414] transition-all"
                          style={{ height: item.count > 0 ? `${heightPct}%` : '2px' }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-700 font-bold">
                        {item.hour.split(':')[0]}h
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: DETAILED LOGS */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#D9D8D4] border border-[#141414] p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex items-center gap-1.5 bg-[#EBEAE5] border border-[#141414] px-2.5 py-1">
                <Search size={14} className="text-slate-700" />
                <input
                  type="text"
                  placeholder="Buscar Cliente / CPF / Ação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-xs font-medium text-[#141414] outline-none w-48"
                />
              </div>

              {/* User filter */}
              <div className="flex items-center gap-1 bg-[#EBEAE5] border border-[#141414] px-2 py-1">
                <Filter size={12} className="text-slate-700" />
                <span className="text-[10px] font-bold uppercase text-slate-700">Operador:</span>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#141414] outline-none cursor-pointer"
                >
                  <option value="ALL">Todos os Operadores</option>
                  {summary?.userStats?.map(u => (
                    <option key={u.username} value={u.username}>{u.username}</option>
                  ))}
                </select>
              </div>

              {/* Base filter */}
              <div className="flex items-center gap-1 bg-[#EBEAE5] border border-[#141414] px-2 py-1">
                <Layers size={12} className="text-slate-700" />
                <span className="text-[10px] font-bold uppercase text-slate-700">Base:</span>
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#141414] outline-none cursor-pointer"
                >
                  <option value="ALL">Todas as Bases</option>
                  {schemas.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-[#141414]">
              Exibindo {filteredLogs.length} de {logs.length} registros
            </span>
          </div>

          {/* Logs Table */}
          <div className="bg-[#EBEAE5] border border-[#141414] overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#141414] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-2.5 border-r border-slate-700 w-24">Horário</th>
                    <th className="p-2.5 border-r border-slate-700">Operador</th>
                    <th className="p-2.5 border-r border-slate-700">Base / Guia</th>
                    <th className="p-2.5 border-r border-slate-700">Cliente</th>
                    <th className="p-2.5 border-r border-slate-700">CPF</th>
                    <th className="p-2.5 border-r border-slate-700">Tipo de Ação</th>
                    <th className="p-2.5">Alteração Realizada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-600 italic">
                        Nenhum registro de tratativa encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const schemaName = schemas.find(s => s.id === log.reportId)?.name || log.reportId;
                      const changes = log.details?.changes || {};
                      const statusVal = changes.status || changes.Status;
                      const obsVal = changes.observacaoFinal || changes['Observação final'];

                      return (
                        <tr key={log.id} className="hover:bg-[#D9D8D4] transition-colors">
                          <td className="p-2.5 border-r border-[#141414] font-mono font-bold text-[11px] text-slate-800 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] font-bold text-[#141414] whitespace-nowrap">
                            {log.username}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] text-[11px] text-slate-700 whitespace-nowrap">
                            <span className="bg-[#D9D8D4] border border-[#141414] px-1.5 py-0.5 font-semibold">
                              {schemaName}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-[#141414] font-semibold text-[#141414]">
                            {log.clientName || "-"}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] font-mono text-[11px] text-slate-700">
                            {log.clientCpf || "-"}
                          </td>
                          <td className="p-2.5 border-r border-[#141414] whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                              log.actionType === 'STATUS_CHANGE'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-800'
                                : log.actionType === 'OBSERVACAO_CHANGE'
                                ? 'bg-blue-100 text-blue-900 border-blue-800'
                                : log.actionType === 'BULK_UPDATE'
                                ? 'bg-purple-100 text-purple-900 border-purple-800'
                                : 'bg-[#D9D8D4] text-[#141414] border-[#141414]'
                            }`}>
                              {log.actionType}
                            </span>
                          </td>
                          <td className="p-2.5 text-[11px]">
                            {statusVal && (
                              <div className="font-semibold text-emerald-900">
                                Status: <span className="font-bold">{statusVal}</span>
                              </div>
                            )}
                            {obsVal && (
                              <div className="text-slate-800 font-medium">
                                Obs: {obsVal}
                              </div>
                            )}
                            {!statusVal && !obsVal && (
                              <div className="text-slate-600 font-mono text-[10px] truncate max-w-md">
                                {JSON.stringify(changes)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
