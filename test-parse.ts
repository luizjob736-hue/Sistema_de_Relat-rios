import { parseDynamicCSV } from './src/utils.ts';
import { defaultSchema } from './src/types.ts';

const csv = `Base;Nome;CPF;E-mail;Telefone;Valor Solicitado;Valor Liberado;Tentativa 1;Status;Observação final
;ADRIANO SOARES DA SILVA;01314313150;;;;;01/08/2026 ás  09:34;Sem sucesso;Sem contato com o cliente
;WALLACE LULA SANTOS;02492036502;;;;;1-08;Com sucesso;Cliente informa que desconto foi realizado`;
console.log(parseDynamicCSV(csv, defaultSchema));
