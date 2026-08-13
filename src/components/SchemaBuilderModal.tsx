import React, { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { ReportSchema, FieldDef, ensureFixedColumns, defaultStatusConfigs } from "../types";

interface SchemaBuilderModalProps {
  onClose: () => void;
  onSave: (schema: ReportSchema) => void;
  initialSchema?: ReportSchema;
}

export function SchemaBuilderModal({ onClose, onSave, initialSchema }: SchemaBuilderModalProps) {
  const [name, setName] = useState(initialSchema?.name || "");
  const [fields, setFields] = useState<FieldDef[]>(
    initialSchema?.fields || []
  );

  const addField = () => {
    setFields([
      ...fields,
      { id: `field_${Date.now()}`, label: "", type: "text", readOnly: false }
    ]);
  };

  const updateField = (index: number, updates: Partial<FieldDef>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Dê um nome ao relatório.");
      return;
    }
    if (fields.length === 0) {
      alert("Adicione pelo menos uma coluna.");
      return;
    }
    
    if (fields.some(f => !f.label.trim())) {
      alert("Todas as colunas devem ter um nome.");
      return;
    }

    onSave({
      id: initialSchema?.id || `report_${Date.now()}`,
      name,
      fields: ensureFixedColumns(fields),
      statusConfigs: initialSchema?.statusConfigs || defaultStatusConfigs
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#F2F1EB] w-full max-w-4xl flex flex-col shadow-2xl max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b-2 border-[#141414] bg-[#E4E3E0]">
          <h2 className="font-mono text-lg font-bold text-[#141414] uppercase tracking-tighter">
            {initialSchema ? "Editar Relatório" : "Novo Relatório (Layout Personalizado)"}
          </h2>
          <button onClick={onClose} className="text-[#141414] hover:bg-[#141414] hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="mb-6">
            <label className="text-xs font-bold uppercase mb-1 block text-[#141414]">Nome do Relatório / Guia</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border-2 border-[#141414] px-3 py-2 text-sm outline-none font-mono text-[#141414]"
              placeholder="Ex: Campanha Agosto"
            />
          </div>

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase text-[#141414]">Colunas do Relatório</h3>
            <button onClick={addField} className="flex items-center gap-1 bg-[#141414] text-white px-3 py-1.5 text-xs font-bold hover:bg-black transition-colors">
              <Plus size={14} /> Nova Coluna
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="flex flex-wrap gap-4 items-start bg-white border-2 border-[#141414] p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold uppercase block mb-1 text-[#141414]">Nome da Coluna</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    className="w-full border-b-2 border-[#141414] bg-transparent outline-none text-sm font-mono pb-1"
                    placeholder="Ex: CPF, Status..."
                  />
                </div>
                
                <div className="w-32">
                  <label className="text-[10px] font-bold uppercase block mb-1 text-[#141414]">Tipo de Dado</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateField(idx, { type: e.target.value as 'text' | 'list' })}
                    className="w-full border-b-2 border-[#141414] bg-transparent outline-none text-sm font-mono pb-1 cursor-pointer"
                  >
                    <option value="text">Texto Livre</option>
                    <option value="list">Lista (Menu)</option>
                  </select>
                </div>

                <div className="w-32">
                  <label className="text-[10px] font-bold uppercase block mb-1 text-[#141414]">Permissão</label>
                  <select
                    value={field.readOnly ? "true" : "false"}
                    onChange={(e) => updateField(idx, { readOnly: e.target.value === "true" })}
                    className="w-full border-b-2 border-[#141414] bg-transparent outline-none text-sm font-mono pb-1 cursor-pointer"
                  >
                    <option value="true">Fixo (Leitura)</option>
                    <option value="false">Editável</option>
                  </select>
                </div>

                {field.type === 'list' && (
                  <div className="w-full mt-2">
                    <label className="text-[10px] font-bold uppercase block mb-1 text-[#141414]">Opções (Separadas por vírgula)</label>
                    <input
                      type="text"
                      value={field.options?.join(", ") || ""}
                      onChange={(e) => updateField(idx, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      className="w-full border-b-2 border-[#141414] bg-[#F2F1EB] px-2 py-1 outline-none text-sm font-mono"
                      placeholder="Ex: Pendente, Concluído, Em Andamento"
                    />
                  </div>
                )}

                <div className="flex items-center pt-5 pl-2">
                  <button onClick={() => removeField(idx)} className="text-red-600 hover:text-white hover:bg-red-600 p-1.5 border-2 border-transparent hover:border-red-900 transition-colors" title="Remover coluna">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="border-2 border-dashed border-[#141414]/30 p-8 text-center text-[#141414]/60 font-mono text-sm">
                Nenhuma coluna configurada neste relatório.
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t-2 border-[#141414] bg-[#E4E3E0] flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 border-2 border-[#141414] text-[#141414] text-xs font-bold uppercase hover:bg-white transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-5 py-2 bg-[#141414] text-white border-2 border-[#141414] text-xs font-bold uppercase hover:bg-black transition-colors">
            Salvar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}
