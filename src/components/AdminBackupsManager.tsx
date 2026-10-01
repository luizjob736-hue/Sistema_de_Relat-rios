import React, { useState, useEffect } from "react";
import { 
  Database, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HardDrive, 
  FileJson, 
  FileSpreadsheet, 
  RotateCcw,
  Layers,
  ArrowDownToLine,
  Server,
  Copy,
  Terminal,
  FileCode
} from "lucide-react";
import { DatabaseBackupItem, ReportSchema } from "../types";

interface LocalNeonStatus {
  hasLocalJson: boolean;
  hasSqlDump: boolean;
  lastCopiedAt: string | null;
  summary: {
    usersCount: number;
    schemasCount: number;
    recordsCount: number;
    tratativasCount: number;
    backupsCount: number;
  } | null;
  jsonSizeBytes: number;
  sqlSizeBytes: number;
}

interface AdminBackupsManagerProps {
  schemas: ReportSchema[];
  onDataRestored?: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function AdminBackupsManager({ schemas, onDataRestored, showToast }: AdminBackupsManagerProps) {
  const [backups, setBackups] = useState<DatabaseBackupItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [backupToRestore, setBackupToRestore] = useState<DatabaseBackupItem | null>(null);

  // Local Neon Copy state
  const [localNeonStatus, setLocalNeonStatus] = useState<LocalNeonStatus | null>(null);
  const [isCopyingNeon, setIsCopyingNeon] = useState<boolean>(false);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/backups");
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch (err) {
      console.error("Erro ao listar backups:", err);
      showToast("Erro ao carregar lista de backups", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocalNeonStatus = async () => {
    try {
      const res = await fetch("/api/admin/local-neon-status");
      if (res.ok) {
        const data = await res.json();
        setLocalNeonStatus(data);
      }
    } catch (err) {
      console.error("Erro ao verificar status da cópia local:", err);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchLocalNeonStatus();
  }, []);

  const handleCopyNeonToLocal = async () => {
    setIsCopyingNeon(true);
    try {
      const res = await fetch("/api/admin/copy-neon-to-local", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "Cópia do Neon para banco local concluída!", "success");
        await fetchLocalNeonStatus();
      } else {
        throw new Error("Falha ao copiar banco Neon");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao copiar dados do Neon para banco local", "error");
    } finally {
      setIsCopyingNeon(false);
    }
  };

  const handleCreateManualBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const res = await fetch("/api/backups/create", { method: "POST" });
      if (res.ok) {
        showToast("Backup completo criado com sucesso!", "success");
        await fetchBackups();
      } else {
        throw new Error("Falha ao criar backup");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao executar backup manual", "error");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (id: string) => {
    setIsRestoring(true);
    try {
      const res = await fetch(`/api/backups/${id}/restore`, { method: "POST" });
      if (res.ok) {
        showToast("Base de dados restaurada com sucesso!", "success");
        setBackupToRestore(null);
        if (onDataRestored) {
          onDataRestored();
        }
      } else {
        throw new Error("Falha na restauração");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro ao restaurar backup selecionado", "error");
    } finally {
      setIsRestoring(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const latestBackup = backups.length > 0 ? backups[0] : null;

  return (
    <div className="space-y-6">
      {/* Top Banner: Status do Backup Automatizado */}
      <div className="bg-[#D9D8D4] border border-[#141414] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-800 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 flex items-center gap-1">
                <ShieldCheck size={12} />
                ROTINA ATIVA
              </span>
              <span className="text-xs font-bold text-slate-800">
                Backup Diário Automatizado Configurado
              </span>
            </div>
            <h2 className="text-lg font-bold text-[#141414] font-mono flex items-center gap-2">
              <Database size={20} />
              Central de Segurança & Backups Automáticos
            </h2>
            <p className="text-xs text-slate-700 max-w-2xl">
              O sistema realiza <strong>backups automáticos diários</strong> de todas as bases, cadastros de operadores e histórico de tratativas. Você também pode disparar backups manuais a qualquer momento ou exportar o banco completo consolidado em Excel.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCreateManualBackup}
              disabled={isCreatingBackup}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-wider border border-[#141414] shadow-none transition-colors"
            >
              <HardDrive size={14} className={isCreatingBackup ? "animate-spin" : ""} />
              {isCreatingBackup ? "Gerando Backup..." : "Fazer Backup Completo Agora"}
            </button>

            <a
              href="/api/export/all-bases.xlsx"
              download
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider border border-[#141414] shadow-none transition-colors"
            >
              <FileSpreadsheet size={14} />
              Baixar Todas as Bases (.XLSX)
            </a>

            <button
              onClick={fetchBackups}
              disabled={isLoading}
              className="p-2 bg-[#EBEAE5] text-[#141414] hover:bg-[#C5C4C0] border border-[#141414] transition-colors"
              title="Recarregar lista"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Quick Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#141414]">
          <div className="bg-[#EBEAE5] p-3 border border-[#141414]">
            <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest block">
              ÚLTIMO BACKUP REALIZADO
            </span>
            <span className="text-sm font-mono font-bold text-[#141414] block mt-0.5">
              {latestBackup ? new Date(latestBackup.createdAt).toLocaleString('pt-BR') : "Nenhum ainda"}
            </span>
            <span className="text-[10px] text-slate-600">
              {latestBackup ? `${latestBackup.totalRecords} registros em ${latestBackup.totalSchemas} bases` : "-"}
            </span>
          </div>

          <div className="bg-[#EBEAE5] p-3 border border-[#141414]">
            <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest block">
              FREQUÊNCIA AUTOMÁTICA
            </span>
            <span className="text-sm font-mono font-bold text-emerald-900 block mt-0.5">
              1x ao Dia (Diário Único)
            </span>
            <span className="text-[10px] text-slate-600">
              Armazenado no PostgreSQL e em disco
            </span>
          </div>

          <div className="bg-[#EBEAE5] p-3 border border-[#141414]">
            <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest block">
              PONTOS DE RECUPERAÇÃO DISPONÍVEIS
            </span>
            <span className="text-sm font-mono font-bold text-[#141414] block mt-0.5">
              {backups.length} snapshots salvos
            </span>
            <span className="text-[10px] text-slate-600">
              Pronto para download ou restauração
            </span>
          </div>
        </div>
      </div>

      {/* NEW: Card de Cópia Neon para Banco Local */}
      <div className="bg-[#EBEAE5] border-2 border-[#141414] p-5 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#141414]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-900 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 flex items-center gap-1">
                <Server size={12} />
                SINCRONIZAÇÃO NEON -&gt; BANCO LOCAL
              </span>
              <span className="text-xs font-bold text-slate-800">
                Cópia de Segurança do Neon para Banco de Dados Local
              </span>
            </div>
            <h3 className="text-base font-bold text-[#141414] font-mono flex items-center gap-2">
              <Copy size={18} />
              Cópia do Banco Neon para Banco Local (Dump SQL &amp; JSON)
            </h3>
            <p className="text-xs text-slate-700 max-w-2xl">
              Copia <strong>100% das tabelas e dados do Neon PostgreSQL</strong> (Usuários, Schemas, Registros de Clientes, Histórico de Tratativas e Backups) para arquivos locais de banco de dados e script DDL/DML SQL para importação em bancos locais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyNeonToLocal}
              disabled={isCopyingNeon}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold uppercase tracking-wider border border-[#141414] transition-colors"
            >
              <Copy size={14} className={isCopyingNeon ? "animate-spin" : ""} />
              {isCopyingNeon ? "Copiando Dados do Neon..." : "Copiar Neon para Banco Local Agora"}
            </button>

            {localNeonStatus?.hasSqlDump && (
              <a
                href="/api/admin/download-local-sql"
                download
                className="flex items-center gap-1.5 px-3 py-2.5 bg-[#D9D8D4] hover:bg-[#C5C4C0] text-[#141414] text-xs font-bold uppercase border border-[#141414] transition-colors"
                title="Baixar arquivo .SQL pronto para importação local"
              >
                <FileCode size={14} />
                Baixar Script .SQL ({formatBytes(localNeonStatus.sqlSizeBytes)})
              </a>
            )}

            {localNeonStatus?.hasLocalJson && (
              <a
                href="/api/admin/download-local-json"
                download
                className="flex items-center gap-1.5 px-3 py-2.5 bg-[#D9D8D4] hover:bg-[#C5C4C0] text-[#141414] text-xs font-bold uppercase border border-[#141414] transition-colors"
                title="Baixar cópia estruturada em JSON"
              >
                <FileJson size={14} />
                Baixar JSON ({formatBytes(localNeonStatus.jsonSizeBytes)})
              </a>
            )}
          </div>
        </div>

        {/* Status details & stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-xs font-mono">
          <div className="bg-[#D9D8D4] p-2.5 border border-[#141414]">
            <span className="text-[9px] font-sans font-bold text-slate-700 uppercase block">ÚLTIMA CÓPIA</span>
            <span className="font-bold text-[#141414] block mt-0.5">
              {localNeonStatus?.lastCopiedAt ? new Date(localNeonStatus.lastCopiedAt).toLocaleString('pt-BR') : 'Nenhuma realizada'}
            </span>
          </div>

          <div className="bg-[#D9D8D4] p-2.5 border border-[#141414]">
            <span className="text-[9px] font-sans font-bold text-slate-700 uppercase block">REGISTROS COPIADOS</span>
            <span className="font-bold text-[#141414] block mt-0.5">
              {localNeonStatus?.summary ? `${localNeonStatus.summary.recordsCount} registros` : '-'}
            </span>
          </div>

          <div className="bg-[#D9D8D4] p-2.5 border border-[#141414]">
            <span className="text-[9px] font-sans font-bold text-slate-700 uppercase block">BASES / SCHEMAS</span>
            <span className="font-bold text-[#141414] block mt-0.5">
              {localNeonStatus?.summary ? `${localNeonStatus.summary.schemasCount} bases` : '-'}
            </span>
          </div>

          <div className="bg-[#D9D8D4] p-2.5 border border-[#141414]">
            <span className="text-[9px] font-sans font-bold text-slate-700 uppercase block">HISTÓRICO TRATATIVAS</span>
            <span className="font-bold text-[#141414] block mt-0.5">
              {localNeonStatus?.summary ? `${localNeonStatus.summary.tratativasCount} registros` : '-'}
            </span>
          </div>

          <div className="bg-[#D9D8D4] p-2.5 border border-[#141414] col-span-2 md:col-span-1">
            <span className="text-[9px] font-sans font-bold text-slate-700 uppercase block">COMANDO DE TERMINAL</span>
            <span className="text-[10px] font-bold text-blue-900 block mt-0.5 flex items-center gap-1">
              <Terminal size={11} />
              npm run copy-local
            </span>
          </div>
        </div>
      </div>

      {/* Backups History Table */}
      <div className="bg-[#EBEAE5] border border-[#141414] overflow-hidden">
        <div className="p-3 bg-[#D9D8D4] border-b border-[#141414] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#141414] flex items-center gap-2">
            <Clock size={14} />
            Histórico de Snapshots de Backup ({backups.length})
          </span>
          <span className="text-[10px] font-mono text-slate-600">
            Retenção automática dos últimos 50 pontos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#141414] text-white uppercase text-[10px] tracking-wider">
                <th className="p-2.5 border-r border-slate-700 w-12 text-center">#</th>
                <th className="p-2.5 border-r border-slate-700">Data e Hora</th>
                <th className="p-2.5 border-r border-slate-700 text-center">Tipo</th>
                <th className="p-2.5 border-r border-slate-700 text-center font-mono">Bases Salvas</th>
                <th className="p-2.5 border-r border-slate-700 text-center font-mono">Total de Registros</th>
                <th className="p-2.5 border-r border-slate-700 text-center font-mono">Tamanho</th>
                <th className="p-2.5 border-r border-slate-700 text-center">Status</th>
                <th className="p-2.5 text-center">Downloads & Restauração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-600 italic">
                    Nenhum snapshot de backup registrado ainda. Clique em "Fazer Backup Completo Agora" acima para gerar o primeiro.
                  </td>
                </tr>
              ) : (
                backups.map((b, idx) => (
                  <tr key={b.id} className="hover:bg-[#D9D8D4] transition-colors">
                    <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-slate-700">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 border-r border-[#141414] font-mono font-bold text-[#141414]">
                      {new Date(b.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-2.5 border-r border-[#141414] text-center">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase ${
                        b.backupType === 'AUTOMATIC_DAILY'
                          ? 'bg-blue-100 text-blue-900 border border-blue-800'
                          : 'bg-purple-100 text-purple-900 border border-purple-800'
                      }`}>
                        {b.backupType === 'AUTOMATIC_DAILY' ? 'Automático Diário' : 'Manual'}
                      </span>
                    </td>
                    <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold">
                      {b.totalSchemas}
                    </td>
                    <td className="p-2.5 border-r border-[#141414] text-center font-mono font-bold text-base text-[#141414]">
                      {b.totalRecords}
                    </td>
                    <td className="p-2.5 border-r border-[#141414] text-center font-mono text-[11px] text-slate-700">
                      {formatBytes(b.fileSizeBytes)}
                    </td>
                    <td className="p-2.5 border-r border-[#141414] text-center">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-800 flex items-center justify-center gap-1 w-fit mx-auto">
                        <CheckCircle2 size={10} />
                        Sucesso
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`/api/backups/${b.id}/download-xlsx`}
                          download
                          className="flex items-center gap-1 px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold uppercase border border-[#141414] transition-colors"
                          title="Baixar em formato Excel com abas"
                        >
                          <FileSpreadsheet size={12} />
                          Excel (.xlsx)
                        </a>

                        <a
                          href={`/api/backups/${b.id}/download`}
                          download
                          className="flex items-center gap-1 px-2 py-1 bg-[#D9D8D4] hover:bg-[#C5C4C0] text-[#141414] text-[10px] font-bold uppercase border border-[#141414] transition-colors"
                          title="Baixar JSON estruturado"
                        >
                          <FileJson size={12} />
                          JSON
                        </a>

                        <button
                          onClick={() => setBackupToRestore(b)}
                          className="flex items-center gap-1 px-2 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold uppercase border border-[#141414] transition-colors"
                          title="Restaurar base para este momento"
                        >
                          <RotateCcw size={12} />
                          Restaurar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Restoration */}
      {backupToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#EBEAE5] border-2 border-[#141414] max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-700 mb-3">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold uppercase tracking-wider text-[#141414]">
                Confirmar Restauração de Base
              </h3>
            </div>

            <p className="text-xs text-slate-800 mb-4 leading-relaxed">
              Você está prestes a restaurar a base para o snapshot de:
              <br />
              <strong className="text-sm font-mono block mt-1 text-[#141414]">
                {new Date(backupToRestore.createdAt).toLocaleString('pt-BR')} ({backupToRestore.totalRecords} registros)
              </strong>
            </p>

            <div className="bg-amber-100 border border-amber-800 p-3 mb-5 text-[11px] text-amber-950 font-medium">
              ⚠️ <strong>Atenção:</strong> Esta ação sincronizará as bases atuais com o conteúdo salvo neste snapshot. Recomendamos gerar um backup manual do momento atual antes de prosseguir.
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setBackupToRestore(null)}
                disabled={isRestoring}
                className="px-4 py-2 bg-[#D9D8D4] hover:bg-[#C5C4C0] text-[#141414] text-xs font-bold uppercase border border-[#141414] transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={() => handleRestoreBackup(backupToRestore.id)}
                disabled={isRestoring}
                className="flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold uppercase border border-[#141414] transition-colors"
              >
                <RotateCcw size={14} className={isRestoring ? "animate-spin" : ""} />
                {isRestoring ? "Restaurando..." : "Confirmar e Restaurar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
