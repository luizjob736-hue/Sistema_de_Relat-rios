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
}

export interface DynamicRecord {
  id: string;
  reportId: string;
  data: Record<string, string>;
}

export const defaultSchema: ReportSchema = {
  id: 'default',
  name: 'Relatório Padrão',
  fields: [
    { id: 'nomeBase', label: 'Base', type: 'text', readOnly: true },
    { id: 'nome', label: 'Nome', type: 'text', readOnly: true },
    { id: 'cpf', label: 'CPF', type: 'text', readOnly: true },
    { id: 'email', label: 'E-mail', type: 'text', readOnly: true },
    { id: 'telefone', label: 'Telefone', type: 'text', readOnly: true },
    { id: 'valorSolicitado', label: 'Valor Solicitado', type: 'text', readOnly: true },
    { id: 'valorLiberado', label: 'Valor Liberado', type: 'text', readOnly: true },
    { id: 'tentativa1', label: 'Tentativa 1', type: 'text', readOnly: false },
    { id: 'status', label: 'Status', type: 'list', options: ['-', 'Com Sucesso', 'Sem Resposta', 'Sem Sucesso'], readOnly: false },
    { id: 'observacaoFinal', label: 'Observação final', type: 'list', options: ['-', 'Cliente informa que desconto foi realizado', 'Cliente informa que desconto não foi realizado', 'Sem contato com o cliente'], readOnly: false }
  ]
};
