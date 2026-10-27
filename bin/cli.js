#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { calculateBudget, budgetToCsv } from '../src/index.js';
const help = `Presupuesto comunitario en PEN
node bin/cli.js calculate --input examples/presupuesto.json [--format json|csv]

Usa cadenas para importes y cantidades; ejemplo "12.30", nunca coma decimal.
No modifica archivos, no mueve dinero y no obtiene precios de internet.
`;
try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') process.stdout.write(help);
  else {
    if (command !== 'calculate') throw new Error('Comando inválido.');
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]; const value = args[i + 1];
      if (!['--input', '--format'].includes(key) || Object.hasOwn(options, key) || !value || value.startsWith('--')) throw new Error('Opciones inválidas.');
      options[key] = value;
    }
    const format = options['--format'] || 'json';
    if (!options['--input'] || !['json', 'csv'].includes(format) || (await stat(options['--input'])).size > 1024 * 1024) throw new Error('Archivo o formato inválido.');
    const result = calculateBudget(JSON.parse(await readFile(options['--input'], 'utf8')));
    process.stdout.write(format === 'csv' ? budgetToCsv(result) : JSON.stringify(result, null, 2) + '\n');
  }
} catch { console.error('No se pudo calcular. Revisa --help y el contrato de entrada; no se imprime información del archivo.'); process.exitCode = 1; }
