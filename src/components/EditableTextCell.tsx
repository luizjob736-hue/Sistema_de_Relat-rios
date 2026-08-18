import React, { useState, useEffect, useRef } from "react";
import { formatCurrentDateTime } from "../utils";

interface EditableTextCellProps {
  key?: React.Key;
  recordId: string;
  fieldId: string;
  fieldLabel?: string;
  initialValue: string;
  options?: string[];
  readOnly?: boolean;
  onSave: (recordId: string, updatedData: Record<string, string>) => void;
  className?: string;
}

export function EditableTextCell({
  recordId,
  fieldId,
  fieldLabel = "",
  initialValue,
  options,
  readOnly = false,
  onSave,
  className = ""
}: EditableTextCellProps) {
  const displayVal = initialValue === "-" ? "" : initialValue;
  const [localVal, setLocalVal] = useState<string>(displayVal);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommittedRef = useRef<string>(displayVal);

  const isAttemptOrDateField = 
    fieldId.toLowerCase().includes("tentativa") || 
    fieldLabel.toLowerCase().includes("tentativa") ||
    fieldId.toLowerCase().includes("data") ||
    fieldLabel.toLowerCase().includes("data");

  // Keep local value in sync if changed from outside while user is not typing
  useEffect(() => {
    if (!isFocused && initialValue !== undefined) {
      const formatted = initialValue === "-" ? "" : initialValue;
      setLocalVal(formatted);
      lastCommittedRef.current = formatted;
    }
  }, [initialValue, isFocused]);

  const commitValue = (valueToCommit: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    let finalVal = valueToCommit;
    if (isAttemptOrDateField && finalVal.trim().toLowerCase() === "agora") {
      finalVal = formatCurrentDateTime();
      setLocalVal(finalVal);
    }

    if (finalVal !== lastCommittedRef.current) {
      lastCommittedRef.current = finalVal;
      onSave(recordId, { [fieldId]: finalVal || "-" });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      commitValue(newVal);
    }, 400);
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitValue(localVal);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  if (readOnly) {
    return <span className={className}>{initialValue || "-"}</span>;
  }

  const datalistId = options && options.length > 0 ? `datalist_${fieldId}_${recordId}` : undefined;

  return (
    <div className="relative w-full flex items-center group/cell">
      <input
        type="text"
        list={datalistId}
        value={localVal}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={isAttemptOrDateField ? "dd/mm/aaaa às hh:mm (ou 'agora')" : ""}
        className={`bg-transparent border-b border-transparent focus:border-[#141414] text-[#141414] outline-none font-bold w-full text-xs focus:bg-white transition-all px-1 py-0.5 ${className}`}
      />
      {datalistId && options && (
        <datalist id={datalistId}>
          {options.filter((o) => o !== "-").map((opt, oIdx) => (
            <option key={`${opt}_${oIdx}`} value={opt} />
          ))}
        </datalist>
      )}
      {isAttemptOrDateField && isFocused && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent blur
            const now = formatCurrentDateTime();
            setLocalVal(now);
            commitValue(now);
          }}
          className="absolute right-1 text-[9px] font-mono font-bold bg-[#141414] text-white px-1 py-0.2 rounded hover:bg-black uppercase cursor-pointer z-10"
          title="Inserir data e hora atual"
        >
          Agora
        </button>
      )}
    </div>
  );
}
