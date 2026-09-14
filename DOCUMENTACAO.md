# Documentação do Sistema — CRM & Gestão de Tratativas (Proativa)

---

## 1. Visão Geral do Sistema

O **Sistema de Gestão de Tratativas & CRM Proativa** é uma plataforma full-stack desenvolvida para centralizar, auditar e acelerar a operação de tratamento de propostas e clientes.

O sistema opera com esquemas de dados dinâmicos (guias/bases personalizadas), permitindo o upload de arquivos CSV de diferentes layouts, edição em tempo real com controle de concorrência, auditoria individual de ações por operador e exportação compatível com Microsoft Excel e Google Sheets.

---

## 2. Perfis de Usuário e Níveis de Acesso

O sistema dispõe de controle de acesso baseado em funções (**RBAC**):

| Perfil | Nível | Permissões e Acessos |
| :--- | :--- | :--- |
| **Administrador (`admin`)** | Total | Acesso irrestrito: importação e exclusão de guias, edição de campos e colunas, configuração de motivos/sub-motivos de status, filtros temporais no quadro de contagem, deduplicação de bases, auditoria completa e gerenciamento de backups. |
| **Operador (`editor`)** | Operacional | Edição de dados dos clientes (célula por célula ou em lote), preenchimento de tentativas, alteração de status e observações. Não possui acesso a exclusão de bases ou reconfiguração de esquemas. |
| **Visualizador (`viewer`)** | Somente Leitura | Consulta aos dados, tabelas de contagem, resumo executivo e painéis analíticos, sem permissão para editar ou alterar registros. |

### Usuários Pré-configurados:
- **Admin**: Usuário `Admin` | Senha: `Proativa_*2026`
- **Visualizador**: Usuário `Visualizador` | Senha: `Visua@prt06`
- **Operadores**: Usuários `Operador 1` a `Operador 15` | Senha padrão: `123456`

---

## 3. Módulos e Funcionalidades

### 3.1. Tabela Dinâmica de Clientes & Tratativas
- **Edição Direta (Inline)**: Clique duplo ou foco em qualquer célula para editar texto, selecionar opções suspensas ou preencher datas. O sistema grava automaticamente a alteração com preservação de todas as colunas.
- **Edição em Massa com Múltiplos Campos**:
  - Seleção por checkbox individual ou botão *"Selecionar Todos"*.
  - Preenchimento simultâneo de múltiplos campos na barra de lote (*Responsável*, *Tentativa*, *Status*, *Observação Final*, etc.).
  - Pressionar a tecla **`Enter`** ou clicar no botão **"Salvar Todas (X)"** aplica todas as alterações aos registros selecionados de forma atômica.
  - O atalho `"agora"` ou `"now"` em campos de tentativa converte automaticamente para o formato padrão de data e hora (`DD/MM/AAAA às HH:mm`).
- **Coluna "Status Proposta"**:
  - Coluna de controle manual e **informativo** (*Aberta* / *Finalizada*).
  - Permite alternar o estado do cliente sem interferir nos cálculos estatísticos da base trabalhada.
- **Ordenação Inteligente**:
  - Ordenação por colunas de texto, números ou datas (`DD/MM/AAAA` e formatos ISO).
  - Ordenação prioritária global definida pelo Administrador.
- **Busca e Filtros Avançados**:
  - Pesquisa rápida global por nome, CPF, telefone ou contrato.
  - Filtros individuais por coluna com busca exata ou parcial.

---

### 3.2. Quadro de Contagem & Resumo Executivo
- **Painel de Contagem (Observação Final)**:
  - Exibe a distribuição quantitativa de todas as observações finais da guia ativa.
  - **Filtro Temporal de Preenchimento (Admin)**: Permite visualizar a contagem por *Todas as Datas*, *Hoje*, *Ontem* ou selecionar uma data específica de preenchimento.
- **Resumo Executivo da Base**:
  - Métricas em tempo real:
    - **Total da base**: Contagem de todos os clientes da guia.
    - **Base trabalhada**: Quantidade e percentual de clientes que já possuem tratativa registrada.
    - **Contato efetivo (Sucesso)**: Propostas concluídas com sucesso.
    - **Sem contato efetivo**: Somatório de tratativas sem sucesso e sem resposta (caixa postal, número ocupado, etc.).
    - **Pendências de discagem**: Clientes que ainda necessitam de acionamento.
- **Botões de Cópia Rápida**:
  - Cópia do relatório executivo formatado para WhatsApp/E-mail com 1 clique.
  - Cópia da tabela de contagem tabulada para colar direto no Excel.

---

### 3.3. Gestão de Guias e Esquemas Dinâmicos
- **Importação de Bases via CSV**:
  - Suporte a arrastar e soltar (drag & drop) ou seleção de arquivos locais.
  - Reconhecimento automático de delimitadores (vírgula `,`, ponto e vírgula `;` ou tabulação `\t`).
  - Tratamento nativo de acentuação (remoção de caracteres corrompidos/mojibake em UTF-8 e Windows-1252 / ISO-8859-1).
  - Mapeamento inteligente de colunas obrigatórias e personalizadas.
- **Exportação de Dados**:
  - Exportação em formato CSV com codificação UTF-8 com BOM (`\uFEFF`), garantindo exibição correta de caracteres especiais e acentos no Microsoft Excel.
- **Deduplicação de Base (Admin)**:
  - Deduplicação automática por CPF, Telefone ou E-mail.
  - Histórico de deduplicação com opção de **Desfazer** a operação a qualquer momento.

---

### 3.4. Auditoria de Tratativas & Presença em Tempo Real
- **Histórico Completo de Alterações**:
  - Toda edição de célula ou atualização em lote registra usuário, data/hora, tipo de ação e dados modificados.
- **Monitoramento de Operadores Ativos**:
  - Visualização em tempo real de quais usuários estão conectados e interagindo no sistema.
  - Detecção automática de inatividade após 15 minutos sem ações.

---

## 4. Arquitetura e Segurança de Dados

```
[ Frontend: React + TypeScript + Tailwind ]
                     │  (Fetch + Optimistic UI + Local Cache)
                     ▼
[ Servidor de Aplicação: Express + Node.js ]
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
[ Banco PostgreSQL ]     [ Cache Fallback Local ]
(Pool Conexões Drizzle)  (JSON de Alta Disponibilidade)
```

1. **Persistência Híbrida de Alta Disponibilidade**:
   - As gravações são efetuadas no banco de dados relacional PostgreSQL.
   - Em caso de instabilidade na conexão externa, o sistema mantém uma réplica de segurança local em disco e no navegador (`localStorage`), sincronizando assim que a conexão é restabelecida.
2. **Mesclagem Atômica (`JSONB Merge`)**:
   - Cada campo atualizado é integrado com `COALESCE(data, '{}'::jsonb) || new_data`, prevenindo que a edição de uma coluna específica sobrescreva as demais colunas do cliente.
3. **Controle de Concorrência**:
   - Timestamps de última edição local protegem a digitação dos operadores contra sobrescritas por requisições de fundo.

---

## 5. Boas Práticas de Uso

1. **Preenchimento em Lote**:
   - Selecione os clientes desejados utilizando os checkboxes.
   - Preencha os campos necessários na barra superior.
   - Pressione **Enter** em qualquer um dos campos ou clique em **Salvar Todas**.
2. **Atualização Manual de Dados**:
   - Utilize o botão de **Sincronizar Dados** no canto superior direito para forçar uma atualização imediata com o servidor.
3. **Exportação**:
   - Caso deseje exportar apenas parte dos dados, marque os clientes desejados antes de clicar em *Exportar*. Se nenhum estiver marcado, toda a base filtrada será exportada.
