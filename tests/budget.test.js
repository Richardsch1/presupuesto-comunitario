import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calculateBudget, parsePEN, formatPEN, budgetToCsv } from '../src/index.js';
const example = () => ({ title: 'EJEMPLO FICTICIO', currency: 'PEN', fundingPEN: '100.00', contingencyBps: 0, items: [{ id: 'rubro-uno', description: 'Material ficticio', category: 'materiales', quantity: '3', unitPricePEN: '0.10' }] });

test('calcula decimales sin error de coma flotante', () => {
  const result = calculateBudget(example()); assert.equal(result.totalCents, '30'); assert.equal(result.remainingCents, '9970');
});
test('interpreta importes y formatos de céntimos exactos', () => {
  assert.equal(parsePEN('12.3'), 1230n); assert.equal(parsePEN('0'), 0n);
  assert.equal(formatPEN('1230'), 'S/ 12.30'); assert.equal(formatPEN('-1'), '-S/ 0.01');
});
test('rechaza importes numéricos, negativos, comas, exponentes y precisión excesiva', () => {
  for (const value of [1.1, '-1', '1,20', '1e3', '1.005', '01', 'NaN', '1000000000.00']) assert.throws(() => parsePEN(value));
});
test('redondea mitades hacia arriba por rubro', () => {
  const input = example(); input.items[0].unitPricePEN = '0.01'; input.items[0].quantity = '0.5';
  assert.equal(calculateBudget(input).totalCents, '1');
  input.items[0].quantity = '0.499'; assert.equal(calculateBudget(input).totalCents, '0');
});
test('suma rubros redondeados antes de aplicar contingencia', () => {
  const input = example(); input.items[0].unitPricePEN = '0.01'; input.items[0].quantity = '0.5';
  input.items.push({ ...input.items[0], id: 'rubro-dos' }); input.contingencyBps = 5000;
  const result = calculateBudget(input);
  assert.equal(result.subtotalCents, '2'); assert.equal(result.contingencyCents, '1'); assert.equal(result.totalCents, '3');
});
test('contingencia usa puntos básicos explícitos sin impuestos automáticos', () => {
  const input = example(); input.items[0].unitPricePEN = '1.00'; input.items[0].quantity = '1'; input.contingencyBps = 1000;
  const result = calculateBudget(input); assert.equal(result.contingencyCents, '10'); assert.equal(result.totalCents, '110');
});
test('marca déficit y conserva saldo negativo exacto', () => {
  const input = example(); input.fundingPEN = '0.20';
  const result = calculateBudget(input); assert.equal(result.overBudget, true); assert.equal(result.remainingCents, '-10');
});
test('agrega categorías y no modifica la entrada', () => {
  const input = example(); const before = JSON.stringify(input);
  assert.deepEqual(calculateBudget(input).categoryTotals, [{ category: 'materiales', cents: '30' }]);
  assert.equal(JSON.stringify(input), before);
});
test('acepta totales superiores a la precisión segura de Number como cadenas', () => {
  const input = example(); input.items[0].unitPricePEN = '999999999.99'; input.items[0].quantity = '1000000';
  assert.equal(calculateBudget(input).totalCents, '99999999999000000');
});
test('valida límites, moneda, duplicados y cantidades', () => {
  for (const quantity of ['0', '-1', '1.0001', '1000001', 1]) { const input = example(); input.items[0].quantity = quantity; assert.throws(() => calculateBudget(input)); }
  assert.throws(() => calculateBudget({ ...example(), currency: 'USD' }));
  assert.throws(() => calculateBudget({ ...example(), contingencyBps: 1.5 }));
  const input = example(); input.items.push(structuredClone(input.items[0])); assert.throws(() => calculateBudget(input));
});
test('rechaza campos de identidad y texto activo', () => {
  assert.throws(() => calculateBudget({ ...example(), bankAccount: '00000000' }));
  assert.throws(() => calculateBudget({ ...example(), title: '<script>texto</script>' }));
});
test('CSV protege fórmulas y contiene totales y saldo', () => {
  const input = example(); input.items[0].description = '=FORMULA("ficticia")';
  const csv = budgetToCsv(calculateBudget(input));
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"\'=FORMULA(""ficticia"")"'));
  assert.ok(csv.includes('"subtotal"')); assert.ok(csv.includes('"saldo"'));
});
const cli = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
const file = fileURLToPath(new URL('../examples/presupuesto.json', import.meta.url));
test('CLI produce JSON y CSV a partir del ejemplo ficticio', () => {
  const json = spawnSync(process.execPath, [cli, 'calculate', '--input', file], { encoding: 'utf8' });
  assert.equal(json.status, 0); assert.equal(JSON.parse(json.stdout).subtotalCents, '6690');
  const csv = spawnSync(process.execPath, [cli, 'calculate', '--input', file, '--format', 'csv'], { encoding: 'utf8' });
  assert.equal(csv.status, 0); assert.match(csv.stdout, /total_centimos/);
});
test('CLI rechaza formato y argumentos desconocidos', () => {
  for (const args of [['calculate', '--input', file, '--format', 'xml'], ['calculate', '--input'], ['otro']]) assert.equal(spawnSync(process.execPath, [cli, ...args]).status, 1);
});
