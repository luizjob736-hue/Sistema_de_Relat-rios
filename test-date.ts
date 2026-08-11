import { normalizeDateTime } from './src/utils.ts';
console.log(normalizeDateTime("10/082026 16:40"));
console.log(normalizeDateTime("01/08/2026 ás  09:34"));
console.log(normalizeDateTime("01/08/2026 ás 15:20 ACREDITY"));
console.log(normalizeDateTime("1-08"));
console.log(normalizeDateTime(" 09:05 05/08/2026"));
console.log(normalizeDateTime(" 05/08/2026 15; 17"));
console.log(normalizeDateTime("—10/08/2026 09:16"));
console.log(normalizeDateTime("—"));
