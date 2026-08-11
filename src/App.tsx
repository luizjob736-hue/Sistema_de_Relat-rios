import React, { useState, useEffect } from "react";
import { Users, Upload, LayoutGrid, Plus, Copy, Trash2 } from "lucide-react";
import { ImportModal } from "./components/ImportModal";
import { ClientTable } from "./components/ClientTable";
import { SchemaBuilderModal } from "./components/SchemaBuilderModal";
import { DynamicRecord, ReportSchema, defaultSchema } from "./types";
import { getFallbackRecords } from "./utils";

function App() {
  const [schemas, setSchemas] = useState<ReportSchema[]>([]);
  const [activeSchemaId, setActiveSchemaId] = useState<string>('');
  const [records, setRecords] = useState<DynamicRecord[]>([]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<ReportSchema | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // Toasts
  const [toastMessage, setToastMessage] = useState("");
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schemasRes, recordsRes] = await Promise.all([
          fetch("/api/schemas"),
          fetch("/api/records")
        ]);
        const s = await schemasRes.json();
        const r = await recordsRes.json();

        if (s.length === 0) {
          await fetch("/api/schemas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(defaultSchema),
          });
          setSchemas([defaultSchema]);
          setActiveSchemaId(defaultSchema.id);
        } else {
          setSchemas(s);
          setActiveSchemaId(s[0].id);
        }

        if (r.length === 0 && s.length === 0) {
           const fallbacks = getFallbackRecords();
           setRecords(fallbacks);
           if (fallbacks.length > 0) {
             await fetch("/api/records/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ records: fallbacks, mode: "append", reportId: defaultSchema.id })
             });
           }
        } else {
          setRecords(r);
        }
      } catch (err) {
        console.error("Failed to load data", err);
        showToast("Erro de conexão com o banco de dados.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeSchema = schemas.find(s => s.id === activeSchemaId) || schemas[0];

  const handleSaveSchema = async (schema: ReportSchema) => {
    try {
      await fetch("/api/schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schema),
      });

      const isUpdate = schemas.some(s => s.id === schema.id);
      if (isUpdate) {
        setSchemas(schemas.map(s => s.id === schema.id ? schema : s));
        showToast(`Relatório "${schema.name}" atualizado.`);
      } else {
        setSchemas([...schemas, schema]);
        setActiveSchemaId(schema.id);
        showToast(`Relatório "${schema.name}" criado.`);
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
      await fetch("/api/records/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      showToast(`${idsToDelete.length} registros excluídos.`);
    } catch (err) {
      showToast("Erro ao excluir.");
    }
  };

  const handleImport = async (newRecords: DynamicRecord[], overwrite: boolean) => {
    let finalRecordsToSave: DynamicRecord[] = [];
    
    if (overwrite) {
      const remaining = records.filter(r => r.reportId !== activeSchema.id);
      setRecords([...remaining, ...newRecords]);
      finalRecordsToSave = newRecords;
    } else {
      let updatedCount = 0;
      let addedCount = 0;
      
      setRecords((prev) => {
        const updated = [...prev];
        
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

            updated[existingIndex] = {
              ...updated[existingIndex],
              data: mergedData
            };
            finalRecordsToSave.push(updated[existingIndex]);
            updatedCount++;
          } else {
            updated.push(newRec);
            finalRecordsToSave.push(newRec);
            addedCount++;
          }
        });
        
        showToast(`${addedCount} novos registros, ${updatedCount} atualizados com sucesso!`);
        return updated;
      });
    }

    try {
      await fetch("/api/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: finalRecordsToSave, mode: overwrite ? "overwrite" : "append", reportId: activeSchema.id }),
      });
      if (overwrite) showToast(`${newRecords.length} registros importados. Banco substituído!`);
    } catch (err) {
      showToast("Erro de conexão ao salvar base importada.");
    }
    
    setIsImportModalOpen(false);
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
              <h1 className="text-xl font-black uppercase tracking-tighter">Sistema de Relatórios</h1>
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                Gestão Dinâmica Multibases
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 bg-[#141414] text-white border-2 border-[#141414] px-4 py-2 text-xs font-bold uppercase hover:bg-black transition-all shadow-[4px_4px_0px_#C5C4C0] active:translate-y-1 active:translate-x-1 active:shadow-none"
            >
              <Upload size={16} /> Importar Dados
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
              
              <div className="flex gap-1 pr-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const name = prompt("Novo nome da guia:");
                    if (name) {
                      const newSchema = { ...schema, id: Date.now().toString(), name };
                      handleSaveSchema(newSchema);
                    }
                  }}
                  className="hover:text-black transition-colors"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Tem certeza que deseja apagar a guia "${schema.name}"? Todas as planilhas dentro dela serão apagadas.`)) {
                      try {
                        await fetch(`/api/schemas/${schema.id}`, { method: 'DELETE' });
                        setSchemas(schemas.filter(s => s.id !== schema.id));
                        if (activeSchemaId === schema.id) {
                          const remainingSchemas = schemas.filter(s => s.id !== schema.id);
                          setActiveSchemaId(remainingSchemas.length > 0 ? remainingSchemas[0].id : '');
                        }
                        showToast(`Guia "${schema.name}" removida.`);
                      } catch (err) {
                        showToast("Erro ao excluir guia.");
                      }
                    }
                  }}
                  className="hover:text-red-600 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              setEditingSchema(undefined);
              setIsSchemaModalOpen(true);
            }}
            className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#141414] border-2 border-transparent hover:border-[#141414] transition-colors rounded-t-sm mb-[2px] flex items-center gap-1"
          >
            <Plus size={14} /> Nova Guia
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6">
        <section className="h-full bg-white border-4 border-[#141414] shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col relative z-0">
          {activeSchema && (
            <ClientTable
              schema={activeSchema}
              records={records}
              onUpdateRecord={handleUpdateRecord}
              onUpdateRecordsBulk={handleUpdateRecordsBulk}
              onDeleteRecords={handleDeleteRecords}
            />
          )}
        </section>
      </main>

      {isImportModalOpen && activeSchema && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImport}
          schema={activeSchema}
        />
      )}

      {isSchemaModalOpen && (
        <SchemaBuilderModal
          onClose={() => setIsSchemaModalOpen(false)}
          onSave={handleSaveSchema}
          initialSchema={editingSchema}
        />
      )}
    </div>
  );
}

export default App;
