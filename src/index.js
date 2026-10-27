function exact(value, fields) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)); }
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[ .()-]*){7,}/iu.test(value)) throw new Error('Texto inválido o con posibles datos personales.');
}
export function parsePEN(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(value)) throw new Error('Importe inválido: usa una cadena no negativa con punto y hasta dos decimales.');
  const [integer, fraction = ''] = value.split('.');
  return BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function quantity(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/u.test(value)) throw new Error('Cantidad inválida: usa una cadena con hasta tres decimales.');
  const [integer, fraction = ''] = value.split('.');
  const scaled = BigInt(integer) * 1000n + BigInt(fraction.padEnd(3, '0'));
  if (scaled <= 0n || scaled > 1000000000n) throw new Error('La cantidad debe ser positiva y no superar un millón.');
  return scaled;
}
export function formatPEN(value) {
  if (typeof value !== 'bigint' && (typeof value !== 'string' || !/^-?\d+$/u.test(value))) throw new Error('Céntimos inválidos.');
  const cents = BigInt(value); const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}S/ ${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
const rounded = (numerator, denominator) => (numerator + denominator / 2n) / denominator;

export function calculateBudget(input) {
  if (!exact(input, ['title', 'currency', 'fundingPEN', 'contingencyBps', 'items']) || input.currency !== 'PEN') throw new Error('Contrato inválido; solo se admite PEN.');
  text(input.title, 120);
  const funding = parsePEN(input.fundingPEN);
  if (!Number.isInteger(input.contingencyBps) || input.contingencyBps < 0 || input.contingencyBps > 10000) throw new Error('Contingencia inválida: usa puntos básicos entre cero y diez mil.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 200) throw new Error('Incluye entre uno y doscientos rubros.');
  const ids = new Set();
  const categories = new Map();
  const lines = input.items.map(item => {
    if (!exact(item, ['id', 'description', 'category', 'quantity', 'unitPricePEN']) || typeof item.id !== 'string' || !/^[a-z][a-z0-9-]{1,39}$/u.test(item.id) || ids.has(item.id)) throw new Error('Rubro inválido o identificador duplicado.');
    ids.add(item.id); text(item.description, 240);
    if (!['materiales', 'servicios', 'transporte', 'otros'].includes(item.category)) throw new Error('Categoría inválida.');
    const total = rounded(parsePEN(item.unitPricePEN) * quantity(item.quantity), 1000n);
    categories.set(item.category, (categories.get(item.category) || 0n) + total);
    return { ...item, totalCents: total.toString(), totalPEN: formatPEN(total) };
  });
  const subtotal = lines.reduce((sum, line) => sum + BigInt(line.totalCents), 0n);
  const contingency = rounded(subtotal * BigInt(input.contingencyBps), 10000n);
  const total = subtotal + contingency;
  return {
    title: input.title, currency: 'PEN', lines,
    fundingCents: funding.toString(), subtotalCents: subtotal.toString(), contingencyCents: contingency.toString(), totalCents: total.toString(), remainingCents: (funding - total).toString(),
    overBudget: total > funding,
    categoryTotals: [...categories.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, cents]) => ({ category, cents: cents.toString() })),
    rounding: 'Mitades hacia arriba por rubro; contingencia redondeada sobre la suma de rubros.',
    notice: 'Cálculo con importes proporcionados; no verifica precios, disponibilidad, impuestos o compromisos de financiación.',
  };
}

function cell(value) {
  let text = String(value);
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function budgetToCsv(result) {
  if (!Array.isArray(result?.lines)) throw new Error('Resultado inválido.');
  const rows = [['id', 'descripcion', 'categoria', 'cantidad', 'precio_unitario_PEN', 'total_centimos', 'total_PEN']];
  for (const line of result.lines) rows.push([line.id, line.description, line.category, line.quantity, line.unitPricePEN, line.totalCents, line.totalPEN]);
  rows.push(['subtotal', '', '', '', '', result.subtotalCents, formatPEN(result.subtotalCents)], ['contingencia', '', '', '', '', result.contingencyCents, formatPEN(result.contingencyCents)], ['total', '', '', '', '', result.totalCents, formatPEN(result.totalCents)], ['saldo', '', '', '', '', result.remainingCents, formatPEN(result.remainingCents)]);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
