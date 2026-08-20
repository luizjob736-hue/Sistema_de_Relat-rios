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

export function ensureFixedColumns(fields: FieldDef[], statusOptions: string[] = ["-", "Com Sucesso", "Sem Sucesso", "Sem Resposta"]): FieldDef[] {
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

  const fixedObservacao: FieldDef = {
    id: 'observacaoFinal',
    label: 'Observação final',
    type: 'text',
    options: [
      "Cliente informa que desconto foi realizado",
      "Cliente informa que desconto não foi realizado",
      "Sem contato com o cliente",
      "Proposta Cancelada/Reprovada"
    ],
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

