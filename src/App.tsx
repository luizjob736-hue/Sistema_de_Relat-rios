import React, { useState, useEffect } from "react";
import { Users, Upload, LayoutGrid, Plus, Copy, Trash2, LogOut, Shield, Sparkles } from "lucide-react";
import { ImportModal } from "./components/ImportModal";
import { ClientTable } from "./components/ClientTable";
import { SchemaBuilderModal } from "./components/SchemaBuilderModal";
import { LoginScreen } from "./components/LoginScreen";
import { UserManagementModal } from "./components/UserManagementModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DynamicRecord, ReportSchema, UserRole, defaultSchema } from "./types";

function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return sessionStorage.getItem("crm_current_user");
  });
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    return sessionStorage.getItem("crm_user_role") as (UserRole | null);
  });

  const [schemas, setSchemas] = useState<ReportSchema[]>([]);
  const [activeSchemaId, setActiveSchemaId] = useState<string>('');
  const [records, setRecords] = useState<DynamicRecord[]>([]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<ReportSchema | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // Toasts
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleLogin = (username: string, role: UserRole) => {
    setCurrentUser(username);
    setUserRole(role);
    sessionStorage.setItem("crm_current_user", username);
    sessionStorage.setItem("crm_user_role", role);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserRole(null);
    sessionStorage.removeItem("crm_current_user");
    sessionStorage.removeItem("crm_user_role");
  };

  useEffect(() => {
    if (records && records.length > 0) {
      try {
        const backupRecords = records.slice(0, 100);
        localStorage.setItem("crm_records_backup", JSON.stringify(backupRecords));
      } catch (e) {
        console.error("localStorage backup error", e);
      }
    }
  }, [records]);

  useEffect(() => {
    if (schemas && schemas.length > 0) {
      try {
        localStorage.setItem("crm_schemas_backup", JSON.stringify(schemas));
      } catch (e) {
        console.error("localStorage schemas backup error", e);
      }
    }
  }, [schemas]);

  useEffect(() => {
    if (activeSchemaId) {
      localStorage.setItem("crm_active_tab", activeSchemaId);
    }
  }, [activeSchemaId]);

  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    let isSubscribed = true;

    const fetchData = async (isBackground = false) => {
      try {
        const [schemasRes, recordsRes] = await Promise.all([
          fetch("/api/schemas"),
          fetch("/api/records")
        ]);
        
        if (!isSubscribed) return;

        let s: ReportSchema[] = schemasRes.ok ? await schemasRes.json() : [];
        let r: DynamicRecord[] = recordsRes.ok ? await recordsRes.json() : [];

        // Deduplicate schemas by ID and normalized Name
        const cleanSchemas: ReportSchema[] = [];
        const seenIds = new Set<string>();
        const seenNames = new Map<string, string>(); // normName -> canonicalId
        const idRemap: Record<string, string> = {}; // oldId -> canonicalId

        (s || []).forEach((sch) => {
          if (!sch || !sch.name) return;
          let sId = sch.id === '1' ? 'default' : sch.id;
          const normName = sch.name.trim().toLowerCase();

          if (seenNames.has(normName)) {
            const canonicalId = seenNames.get(normName)!;
            idRemap[sch.id] = canonicalId;
            return;
          }

          if (seenIds.has(sId)) {
            return;
          }

          const canonicalSchema = { ...sch, id: sId };
          cleanSchemas.push(canonicalSchema);
          seenIds.add(sId);
          if (sch.id !== sId) {
            idRemap[sch.id] = sId;
          }
          if (normName) {
            seenNames.set(normName, sId);
          }
        });

        if (cleanSchemas.length === 0) {
        }

        setSchemas(cleanSchemas);
        try {
          localStorage.setItem("crm_schemas_backup", JSON.stringify(cleanSchemas));
        } catch (e) {}

        const savedActiveTab = localStorage.getItem("crm_active_tab");
        const canonicalActiveTab = savedActiveTab && idRemap[savedActiveTab] ? idRemap[savedActiveTab] : savedActiveTab;
        if (canonicalActiveTab && cleanSchemas.some((sch: ReportSchema) => sch.id === canonicalActiveTab)) {
          setActiveSchemaId(canonicalActiveTab);
        } else if (!isBackground) {
          setActiveSchemaId(cleanSchemas[0]?.id || '');
        }

        // 2. Set server records as authoritative and sync local backup
        const recordMap = new Map<string, DynamicRecord>();
        (r || []).forEach((rec) => {
          if (rec && rec.id) {
            let recReportId = rec.reportId || 'default';
            if (idRemap[recReportId]) {
              recReportId = idRemap[recReportId];
            }
            recordMap.set(rec.id, { ...rec, reportId: recReportId });
          }
        });

        let finalRecords = Array.from(recordMap.values());

        setRecords(finalRecords);
        try {
          const backupRecords = finalRecords.slice(0, 100);
          localStorage.setItem("crm_records_backup", JSON.stringify(backupRecords));
        } catch (e) {}
      } catch (err) {
        if (!isBackground) {
          console.error("Failed to load data", err);
          const localBackup = localStorage.getItem("crm_records_backup");
          if (localBackup) {
            try {
              setRecords(JSON.parse(localBackup));
            } catch (e) {}
          }
        }
      } finally {
        if (!isBackground && isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    fetchData(false);

    // Auto-polling every 1 hour for background updates across browsers/tabs
    const pollInterval = setInterval(() => {
      fetchData(true);
    }, 3600000);

    const handleFocus = () => {
      fetchData(true);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUser]);

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const activeSchema = schemas.find(s => s.id === activeSchemaId) || schemas[0];

  const handleSaveSchema = async (schema: ReportSchema) => {
    if (userRole !== 'admin') {
      showToast("Acesso negado: Apenas administradores podem gerenciar guias.");
      return;
    }
    try {
      const normName = schema.name.trim().toLowerCase();
      // Check if schema exists by ID or by Name
      const existing = schemas.find(s => s.id === schema.id || s.name.trim().toLowerCase() === normName);
      const targetId = existing ? existing.id : schema.id;
      const finalSchema = { ...schema, id: targetId };

      await fetch("/api/schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalSchema),
      });

      if (existing) {
        const updatedSchemas = schemas.map(s => s.id === existing.id ? finalSchema : s);
        setSchemas(updatedSchemas);
        try {
          localStorage.setItem("crm_schemas_backup", JSON.stringify(updatedSchemas));
        } catch (e) {}
        showToast(`Relatório "${finalSchema.name}" atualizado.`);
      } else {
        const updatedSchemas = [...schemas, finalSchema];
        setSchemas(updatedSchemas);
        try {
          localStorage.setItem("crm_schemas_backup", JSON.stringify(updatedSchemas));
        } catch (e) {}
        setActiveSchemaId(finalSchema.id);
        showToast(`Relatório "${finalSchema.name}" criado.`);
      }
      setIsSchemaModalOpen(false);
      setEditingSchema(undefined);
    } catch (err) {
      showToast("Erro ao salvar relatório.");
    }
  };

  const handleUpdateRecord = async (id: string, updatedData: Record<string, string>) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const newRecord = { ...record, data: { ...record.data, ...updatedData } };
    
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? newRecord : r))
    );

    try {
      await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });
    } catch (err) {
      showToast("Erro ao atualizar registro.");
    }
  };

  const handleUpdateRecordsBulk = async (ids: string[], updatedData: Record<string, string>) => {
    const idsSet = new Set(ids);
    setRecords((prev) =>
      prev.map((r) => {
        if (idsSet.has(r.id)) {
          return { ...r, data: { ...r.data, ...updatedData } };
        }
        return r;
      })
    );

    try {
      await fetch("/api/records/bulk-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, updatedData }),
      });
      showToast(`${ids.length} registros atualizados.`);
    } catch (err) {
      showToast("Erro ao atualizar registros.");
    }
  };

  const handleDeleteRecords = async (idsToDelete: string[]) => {
    setRecords((prev) => prev.filter((r) => !idsToDelete.includes(r.id)));
    
    try {
      const response = await fetch("/api/records/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (!response.ok) throw new Error("Failed to delete records");
      showToast(`${idsToDelete.length} registros excluídos.`);
    } catch (err) {
      showToast("Erro ao excluir.");
    }
  };

  const handleImport = async (newRecords: DynamicRecord[], mode: "append" | "overwrite") => {
    if (!activeSchema) return;
    if (userRole !== 'admin') {
      showToast("Acesso negado: Apenas administradores podem importar dados.");
      return;
    }
    const isOverwrite = mode === "overwrite";
    let finalRecordsToSave: DynamicRecord[] = [];
    let updatedRecordsState: DynamicRecord[] = [];
    let updatedCount = 0;
    let addedCount = 0;
    
    if (isOverwrite) {
      const remaining = records.filter(r => r.reportId !== activeSchema.id);
      const mappedNewRecords = newRecords.map((rec, idx) => ({
        ...rec,
        data: {
          ...rec.data,
          _order: String(idx + 1)
        }
      }));
      updatedRecordsState = [...remaining, ...mappedNewRecords];
      finalRecordsToSave = mappedNewRecords;
    } else {
      const updated = [...records];
      const activeRecords = records.filter(r => r.reportId === activeSchema.id);
      
      // Find maximum existing order index to prevent duplication of sequence positions
      let maxOrder = 0;
      activeRecords.forEach(r => {
        const o = r.data && r.data._order ? Number(r.data._order) : 0;
        if (o > maxOrder) maxOrder = o;
      });
      
      newRecords.forEach((newRec) => {
        const cpfField = activeSchema.fields.find(f => f.label.toLowerCase().includes('cpf') || f.id.toLowerCase().includes('cpf'))?.id;
        const nomeField = activeSchema.fields.find(f => f.label.toLowerCase().includes('nome') && !f.label.toLowerCase().includes('base'))?.id;

        const existingIndex = updated.findIndex((r) => {
          if (r.reportId !== activeSchema.id) return false;
          let match = false;
          if (cpfField && r.data[cpfField] && r.data[cpfField] !== "-") {
            match = r.data[cpfField] === newRec.data[cpfField];
          } else if (nomeField && r.data[nomeField] && r.data[nomeField] !== "-") {
            match = r.data[nomeField].toLowerCase() === newRec.data[nomeField].toLowerCase();
          }
          return match;
        });

        if (existingIndex !== -1) {
          const existingData = updated[existingIndex].data;
          const mergedData = { ...existingData };
          
          Object.keys(newRec.data).forEach(k => {
            const incomingValue = newRec.data[k];
            if (
              incomingValue !== undefined &&
              incomingValue !== null &&
              incomingValue.trim() !== "" &&
              incomingValue.trim() !== "-"
            ) {
              mergedData[k] = incomingValue;
            }
          });

          if (!mergedData._order) {
            maxOrder++;
            mergedData._order = String(maxOrder);
          }

          updated[existingIndex] = {
            ...updated[existingIndex],
            data: mergedData
          };
          finalRecordsToSave.push(updated[existingIndex]);
          updatedCount++;
        } else {
          maxOrder++;
          const recWithOrder = {
            ...newRec,
            data: {
              ...newRec.data,
              _order: String(maxOrder)
            }
          };
          updated.push(recWithOrder);
          finalRecordsToSave.push(recWithOrder);
          addedCount++;
        }
      });

      updatedRecordsState = updated;
    }

    setRecords(updatedRecordsState);

    try {
      const response = await fetch("/api/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: finalRecordsToSave,
          mode: isOverwrite ? "overwrite" : "append",
          reportId: activeSchema.id
        }),
      });

      if (!response.ok) {
        throw new Error("Falha HTTP " + response.status);
      }

      if (isOverwrite) {
        showToast(`${newRecords.length} registros importados e salvos permanentemente no banco!`);
      } else {
        showToast(`${addedCount} novos registros e ${updatedCount} atualizações salvas permanentemente no banco!`);
      }

      // Re-fetch deduplicated clean state from server
      const refreshRes = await fetch("/api/records");
      if (refreshRes.ok) {
        const cleanRecs = await refreshRes.json();
        setRecords(cleanRecs);
        try {
          localStorage.setItem("crm_records_backup", JSON.stringify(cleanRecs));
        } catch (e) {}
      }
    } catch (err) {
      console.error("Erro na persistência dos dados:", err);
      showToast("Erro ao salvar base no banco de dados.");
    }
    
    setIsImportModalOpen(false);
  };

  const handleDeduplicate = async () => {
    try {
      showToast("Validando duplicidades de Nome e CPF nas guias...");
      const res = await fetch("/api/records/deduplicate", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const recordsRes = await fetch("/api/records");
        if (recordsRes.ok) {
          const cleanRecs = await recordsRes.json();
          setRecords(cleanRecs);
          try {
            localStorage.setItem("crm_records_backup", JSON.stringify(cleanRecs));
          } catch (e) {}
        }
        if (data.deletedCount > 0) {
          showToast(`Removidos ${data.deletedCount} registros antigos duplicados! Mantida apenas a última importação.`);
        } else {
          showToast("Nenhum registro duplicado foi encontrado nas guias.");
        }
      } else {
        showToast("Erro ao processar remoção de duplicados.");
      }
    } catch (err) {
      console.error(err);
      showToast("Erro de conexão ao comunicar com o servidor.");
    }
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#F2F1EB] text-[#141414] font-mono font-bold uppercase tracking-widest text-sm">Carregando Banco de Dados...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F2F1EB] text-[#141414] font-sans flex flex-col h-screen overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#141414] text-white px-4 py-3 border-2 border-white shadow-[4px_4px_0px_rgba(255,255,255,0.5)] font-mono text-xs uppercase font-bold animate-in fade-in slide-in-from-top-5">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="border-b-4 border-[#141414] bg-white shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141414] flex items-center justify-center text-white shadow-[4px_4px_0px_#C5C4C0]">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black uppercase tracking-tighter">Sistema de Relatórios</h1>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border border-[#141414] uppercase ${
                  userRole === 'admin' ? 'bg-[#141414] text-white' : userRole === 'viewer' ? 'bg-blue-100 text-blue-900 border-blue-950' : 'bg-slate-200 text-slate-800'
                }`}>
                  {userRole === 'admin' ? 'Admin' : userRole === 'viewer' ? 'Visualização' : 'Operador'} : {currentUser}
                </span>
              </div>
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                Gestão Dinâmica Multibases
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => setIsUserManagementOpen(true)}
                  className="flex items-center gap-2 bg-[#F2F1EB] border-2 border-[#141414] px-4 py-2 text-xs font-bold uppercase hover:bg-[#E4E3E0] transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none"
                >
                  <Shield size={16} /> Acessos
                </button>
                <button
                  onClick={() => {
                    setEditingSchema(activeSchema);
                    setIsSchemaModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-[#F2F1EB] border-2 border-[#141414] px-4 py-2 text-xs font-bold uppercase hover:bg-[#E4E3E0] transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none"
                >
                  <LayoutGrid size={16} /> Configurar Guia Atual
                </button>
                <button
                  onClick={handleDeduplicate}
                  className="flex items-center gap-2 bg-[#F2F1EB] border-2 border-[#141414] px-4 py-2 text-xs font-bold uppercase hover:bg-[#E4E3E0] transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none"
                  title="Verificar e remover registros antigos duplicados por Nome ou CPF"
                >
                  <Sparkles size={16} /> Limpar Duplicados
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-2 bg-[#141414] text-white border-2 border-[#141414] px-4 py-2 text-xs font-bold uppercase hover:bg-black transition-all shadow-[4px_4px_0px_#C5C4C0] active:translate-y-1 active:translate-x-1 active:shadow-none"
                >
                  <Upload size={16} /> Importar Dados
                </button>
                <button
                  onClick={async () => {
                    if (!activeSchema) return;
                    if (confirm(`Tem certeza que deseja apagar todos os registros da base "${activeSchema.name}"?`)) {
                      try {
                        showToast(`Apagando base "${activeSchema.name}"... aguarde.`);

                        const res = await fetch(`/api/records/report/${activeSchema.id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error("Erro no servidor ao apagar base");

                        // Clear records for this schema locally
                        setRecords(prev => prev.filter(r => r.reportId !== activeSchema.id));
                        localStorage.setItem("crm_records_backup", JSON.stringify(records.filter(r => r.reportId !== activeSchema.id)));
                        
                        showToast(`Base "${activeSchema.name}" limpa com sucesso.`);
                      } catch (err) {
                        showToast("Erro ao limpar base. Tente novamente.");
                        console.error(err);
                      }
                    }
                  }}
                  className="flex items-center gap-2 bg-red-100 border-2 border-[#141414] text-red-800 px-4 py-2 text-xs font-bold uppercase hover:bg-red-200 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none"
                  title="Apagar todos os registros desta base"
                >
                  <Trash2 size={16} /> Apagar Base
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="flex items-center gap-2 bg-red-100 border-2 border-[#141414] text-red-700 px-3 py-2 text-xs font-bold uppercase hover:bg-red-200 transition-all shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="px-6 flex items-center gap-2 bg-[#E4E3E0] pt-2 overflow-x-auto hide-scrollbar border-t-2 border-[#141414]">
          {schemas.map(schema => (
            <div key={schema.id} className={`flex items-center border-2 border-b-0 border-[#141414] rounded-t-sm whitespace-nowrap transition-colors
                  ${activeSchemaId === schema.id 
                    ? "bg-white text-[#141414] shadow-[0px_-2px_0px_rgba(0,0,0,1)] z-10 -mb-[2px] pt-3" 
                    : "bg-[#C5C4C0] text-[#141414]/60 hover:bg-[#D1D0CC]"}`}>
              <button
                onClick={() => setActiveSchemaId(schema.id)}
                className="pl-4 pr-1 py-2 text-[10px] font-black uppercase tracking-wider"
              >
                {schema.name}
              </button>
              
              {userRole === 'admin' && (
                <div className="flex gap-1 pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const defaultNewName = `${schema.name} (Cópia)`;
                      const name = prompt("Novo nome para a cópia da guia:", defaultNewName);
                      if (name && name.trim()) {
                        const newSchema = { ...schema, id: `report_${Date.now()}`, name: name.trim() };
                        handleSaveSchema(newSchema);
                      }
                    }}
                    title="Duplicar Guia"
                    className="hover:text-black transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Tem certeza que deseja apagar a guia "${schema.name}"? Todas as planilhas dentro dela serão apagadas.`)) {
                        try {
                          const response = await fetch(`/api/schemas/${schema.id}`, { method: 'DELETE' });
                          if (!response.ok) throw new Error("Failed to delete schema on server");
                          
                          // Server-side deleted, now update local state
                          setSchemas(schemas.filter(s => s.id !== schema.id));
                          if (activeSchemaId === schema.id) {
                            const remainingSchemas = schemas.filter(s => s.id !== schema.id);
                            setActiveSchemaId(remainingSchemas.length > 0 ? remainingSchemas[0].id : '');
                          }
                          // Also remove associated records from local state
                          setRecords(prev => prev.filter(r => r.reportId !== schema.id));
                          
                          showToast(`Guia "${schema.name}" removida.`);
                        } catch (err) {
                          showToast("Erro ao excluir guia.");
                        }
                      }
                    }}
                    title="Apagar Guia"
                    className="hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {userRole === 'admin' && (
            <button
              onClick={() => {
                setEditingSchema(undefined);
                setIsSchemaModalOpen(true);
              }}
              className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#141414] border-2 border-transparent hover:border-[#141414] transition-colors rounded-t-sm mb-[2px] flex items-center gap-1"
            >
              <Plus size={14} /> Nova Guia
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6">
        <section className="h-full bg-white border-4 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col relative z-0">
          {activeSchema ? (
            <ErrorBoundary key={activeSchemaId}>
              <ClientTable
                schema={activeSchema}
                records={records}
                userRole={userRole || 'viewer'}
                onUpdateRecord={handleUpdateRecord}
                onUpdateRecordsBulk={handleUpdateRecordsBulk}
                onDeleteRecords={userRole === 'admin' ? handleDeleteRecords : undefined}
                onUpdateSchema={handleSaveSchema}
              />
            </ErrorBoundary>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
              <div className="w-16 h-16 bg-[#F2F1EB] border-2 border-[#141414] flex items-center justify-center shadow-[4px_4px_0px_rgba(0,0,0,1)]">
                <LayoutGrid className="text-[#141414]" size={32} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">Nenhuma guia encontrada</h2>
              <p className="text-sm text-slate-600 font-mono">
                Para começar, crie uma nova guia no botão acima ou importe dados para visualizar seus relatórios.
              </p>
            </div>
          )}
        </section>
      </main>

      {isImportModalOpen && activeSchema && userRole === 'admin' && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImport}
          schema={activeSchema}
        />
      )}

      {isSchemaModalOpen && userRole === 'admin' && (
        <SchemaBuilderModal
          onClose={() => setIsSchemaModalOpen(false)}
          onSave={handleSaveSchema}
          initialSchema={editingSchema}
        />
      )}

      {isUserManagementOpen && userRole === 'admin' && (
        <UserManagementModal
          isOpen={isUserManagementOpen}
          onClose={() => setIsUserManagementOpen(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

export default App;
