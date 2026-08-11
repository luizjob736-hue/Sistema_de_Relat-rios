import { defaultSchema } from './src/types.ts';
console.log(defaultSchema.fields.find(f => f.id === 'status'));
console.log(defaultSchema.fields.find(f => f.id === 'observacaoFinal'));
