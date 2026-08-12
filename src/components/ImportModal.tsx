import React, { useState, useRef } from "react";
import { UploadCloud, Check, AlertCircle, X, Download } from "lucide-react";
import { DynamicRecord, ReportSchema } from "../types";
import { parseDynamicCSV } from "../utils";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newRecords: DynamicRecord[], mode: "append" | "overwrite") => void;
  schema: ReportSchema;
}

export function ImportModal({ isOpen, onClose, onImport, schema }: ImportModalProps) {
  const [pastedText, setPastedText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileContentName] = useState("");
  const [parsedPreview, setParsedPreview] = useState<DynamicRecord[]>([]);
  const [importMode, setImportMode] = useState<"append" | "overwrite">("append");
  const [nomeBase, setNomeBase] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (parseTimeoutRef.current) clearTimeout(parseTimeoutRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleProcessText = (text: string) => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }
    try {
      const parsed = parseDynamicCSV(text, schema);
      if (parsed.length === 0) {
        setErrorMsg("Nenhum registro com dados válidos foi encontrado no arquivo.");
        setParsedPreview([]);
        return;
      }
      setParsedPreview(parsed);
      setSuccessMsg(`${parsed.length} registros validados com sucesso.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao processar os dados. Verifique o formato.");
      setParsedPreview([]);
    }
  };

  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPastedText(val);

    if (parseTimeoutRef.current) clearTimeout(parseTimeoutRef.current);
    parseTimeoutRef.current = setTimeout(() => {
      handleProcessText(val);
    }, 250);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (file: File) => {
    setFileContentName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPastedText(text);
      handleProcessText(text);
    };
    reader.readAsText(file);
  };

  const executeImport = () => {
    if (parsedPreview.length === 0) return;

    // Inject Base name if the schema contains a column named 'Base'
    const baseField = (schema?.fields || []).find(f => f && ((f.label && f.label.toLowerCase().includes('base')) || (f.id && f.id.toLowerCase().includes('base'))));
    
    const recordsToImport = parsedPreview.map(item => {
      if (nomeBase.trim() && baseField) {
        return {
          ...item,
          data: {
            ...item.data,
            [baseField.id]: nomeBase.trim()
          }
        };
      }
      return item;
    });

    onImport(recordsToImport, importMode);

    setPastedText("");
    setParsedPreview([]);
    setFileContentName("");
    setSuccessMsg("");
    setErrorMsg("");
    setNomeBase("");
  };

  const exampleRow = schema.fields.map(f => f.label).join(";") + "\n" + schema.fields.map(f => "Dado").join(";");

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + exampleRow], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `modelo_importacao_${schema.name.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#F2F1EB] w-full max-w-4xl flex flex-col shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#141414] bg-[#E4E3E0]">
          <h2 className="font-mono text-lg font-bold text-[#141414] uppercase tracking-tighter">
            Importar: {schema.name}
          </h2>
          <button onClick={onClose} className="text-[#141414] hover:bg-[#141414] hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          
          <div className="flex justify-between items-center bg-[#E4E3E0] border-2 border-[#141414] p-3 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            <div className="text-[10px] font-mono font-bold text-[#141414] uppercase tracking-wider">
              Baixe o modelo em CSV para garantir o formato correto.
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-[#141414] text-[#141414] text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors active:translate-y-0.5 active:translate-x-0.5"
            >
              <Download size={14} />
              Modelo CSV
            </button>
          </div>

          {schema.fields.some(f => f.label.toLowerCase().includes('base') || f.id.toLowerCase().includes('base')) && (
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-[10px] font-bold text-[#141414] uppercase tracking-wider">
                Nome da Base (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Campanha Agosto"
                value={nomeBase}
                onChange={(e) => setNomeBase(e.target.value)}
                className="bg-white border-2 border-[#141414] text-[#141414] text-xs font-mono font-medium px-3 py-2 outline-none focus:ring-1 focus:ring-offset-2 focus:ring-[#141414] transition-all"
              />
            </div>
          )}

          {successMsg && (
            <div className="bg-[#D1EED5] border border-emerald-950 text-emerald-950 text-[11px] font-mono font-bold px-3 py-2 flex items-center gap-2">
              <Check size={14} />
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-100 border border-red-950 text-red-950 text-[11px] font-mono font-bold px-3 py-2 flex items-start gap-2 whitespace-pre-line">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          <div className="flex gap-4">
            <div
              className={`flex-1 border-2 border-dashed ${dragActive ? "border-[#141414] bg-[#E4E3E0]" : "border-[#141414]/40 bg-white"} p-8 flex flex-col items-center justify-center transition-all cursor-pointer hover:bg-[#E4E3E0] relative group`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".csv,.txt"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
              />
              <UploadCloud size={32} className="text-[#141414] mb-3 group-hover:scale-110 transition-transform" />
              <p className="font-mono text-sm font-bold text-[#141414] mb-1">
                {fileName || "Arraste um CSV aqui"}
              </p>
              <p className="text-xs text-[#141414]/60 font-mono">ou clique para selecionar</p>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="text-[10px] font-bold text-[#141414] uppercase tracking-wider mb-2">
                Ou cole os dados aqui
              </label>
              <textarea
                value={pastedText}
                onChange={handlePasteChange}
                placeholder={exampleRow}
                className="flex-1 bg-white border-2 border-[#141414] text-[#141414] text-[10px] font-mono p-3 outline-none focus:ring-1 focus:ring-offset-2 focus:ring-[#141414] resize-none whitespace-pre overflow-x-auto"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[#141414] bg-[#E4E3E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-[#141414] cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="importMode"
                  value="append"
                  checked={importMode === "append"}
                  onChange={() => setImportMode("append")}
                  className="peer sr-only"
                />
                <div className="w-4 h-4 border-2 border-[#141414] rounded-full peer-checked:bg-[#141414] shrink-0"></div>
                <div className="absolute w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100"></div>
              </div>
              <div className="flex flex-col group-hover:opacity-70 transition-opacity">
                <span>Atualizar / Adicionar</span>
                <span className="text-[9px] font-mono font-medium text-slate-500 uppercase tracking-tighter">
                  Células em branco no CSV NÃO apagam dados existentes
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-[#141414] cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="radio"
                  name="importMode"
                  value="overwrite"
                  checked={importMode === "overwrite"}
                  onChange={() => setImportMode("overwrite")}
                  className="peer sr-only"
                />
                <div className="w-4 h-4 border-2 border-[#141414] rounded-full peer-checked:bg-[#141414]"></div>
                <div className="absolute w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100"></div>
              </div>
              <span className="group-hover:opacity-70 transition-opacity">Substituir Base Atual</span>
            </label>
          </div>

          <button
            onClick={executeImport}
            disabled={parsedPreview.length === 0}
            className={`px-6 py-2 border-2 border-[#141414] text-xs font-bold uppercase tracking-wider transition-all
              ${parsedPreview.length > 0
                ? "bg-[#141414] text-white hover:bg-black hover:shadow-[4px_4px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:translate-x-1 active:shadow-none"
                : "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
              }`}
          >
            Confirmar Importação
          </button>
        </div>
      </div>
    </div>
  );
}
