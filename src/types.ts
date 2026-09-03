export type UserRole = 'admin' | 'editor' | 'viewer';

export type SubMotivo = 'Sucesso' | 'Sem Sucesso' | 'Sem Resposta';

export interface StatusConfigItem {
  motivo: string;
  subMotivo: SubMotivo;
}

export const defaultStatusConfigs: StatusConfigItem[] = [
  { motivo: "Com Sucesso", subMotivo: "Sucesso" },
  { motivo: "Sem Sucesso", subMotivo: "Sem Sucesso" },
  { motivo: "Sem Resposta", subMotivo: "Sem Resposta" }
];

export interface FieldDef {
  id: string;
  label: string;
  type: 'text' | 'list';
  options?: string[]; // for list type
  readOnly: boolean;
}

export interface ReportSchema {
  id: string;
  name: string;
  fields: FieldDef[];
  statusConfigs?: StatusConfigItem[];
}

export interface DynamicRecord {
  id: string;
  reportId: string;
  data: Record<string, string>;
}

export const STANDARD_OBSERVACAO_OPTIONS = [
  "-",
  "Link de formalização enviado/reenviado",
  "Contato sem sucesso",
  "Proposta finalizada/paga",
  "Proposta cancelada",
  "Proposta reprovada",
  "Proposta reapresentada",
  "Documentação pendente",
  "Documentação apresentada",
  "Dados corrigidos",
  "Aguardando",
  "Sem interesse",
  "Retorno à jornada"
];

export function ensureFixedColumns(fields: FieldDef[], statusOptions: string[] = ["-", "Com Sucesso", "Sem Sucesso", "Sem Resposta"]): FieldDef[] {
  // Find any existing observacao field options if previously defined
  const existingObs = (fields || []).find(f => {
    if (!f) return false;
    const labelLower = (f.label || "").toLowerCase().trim();
    const idLower = (f.id || "").toLowerCase().trim();
    return labelLower.includes('observa') || idLower.includes('observa');
  });

  // Filter out any existing 'status' or 'observacaoFinal' fields so we can append them at the end
  const userFields = (fields || []).filter(f => {
    if (!f) return false;
    const labelLower = (f.label || "").toLowerCase().trim();
    const idLower = (f.id || "").toLowerCase().trim();
    return !(
      labelLower === 'status' || idLower === 'status' ||
      labelLower.includes('observa') || idLower.includes('observa')
    );
  });

  const fixedStatus: FieldDef = {
    id: 'status',
    label: 'Status',
    type: 'list',
    options: statusOptions.includes("-") ? statusOptions : ["-", ...statusOptions],
    readOnly: false
  };

  const obsOptions = (existingObs?.options && existingObs.options.length > 0)
    ? (existingObs.options.includes("-") ? existingObs.options : ["-", ...existingObs.options])
    : STANDARD_OBSERVACAO_OPTIONS;

  const fixedObservacao: FieldDef = {
    id: 'observacaoFinal',
    label: 'Observação final',
    type: 'list',
    options: Array.from(new Set(obsOptions)),
    readOnly: false
  };

  return [...userFields, fixedStatus, fixedObservacao];
}

export const defaultSchema: ReportSchema = {
  id: 'default',
  name: 'Relatório Padrão',
  fields: ensureFixedColumns([
    { id: 'nomeBase', label: 'Base', type: 'text', readOnly: true },
    { id: 'nome', label: 'Nome', type: 'text', readOnly: true },
    { id: 'cpf', label: 'CPF', type: 'text', readOnly: true },
    { id: 'email', label: 'E-mail', type: 'text', readOnly: true },
    { id: 'telefone', label: 'Telefone', type: 'text', readOnly: true },
    { id: 'valorSolicitado', label: 'Valor Solicitado', type: 'text', readOnly: true },
    { id: 'valorLiberado', label: 'Valor Liberado', type: 'text', readOnly: true },
    { id: 'tentativa1', label: 'Tentativa 1', type: 'text', readOnly: false }
  ]),
  statusConfigs: defaultStatusConfigs
};

export interface DeduplicationSession {
  id: string;
  schemaId: string;
  schemaName: string;
  columnId: string;
  columnLabel: string;
  removedRecords: DynamicRecord[];
  createdAt: number;
  expiresAt: number; // 30 minutes after createdAt
}

