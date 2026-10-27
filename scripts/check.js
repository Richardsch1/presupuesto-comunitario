import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
let count = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'coverage'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    if (entry.name === '.env' || entry.name.startsWith('.env.') || /.(pem|key)$/u.test(entry.name)) throw new Error('No publiques archivos de secretos.');
    const content = await readFile(file, 'utf8');
    if (/(?:sk-ant-[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{25,}|github_pat_[a-zA-Z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/u.test(content)) throw new Error('Posible secreto: revisa los archivos antes de publicar.');
    if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    }
    count += 1;
  }
}
await scan(fileURLToPath(new URL('../', import.meta.url)));
console.info(`${count} archivos revisados: sintaxis y patrones de secretos. No sustituye revisión humana.`);
