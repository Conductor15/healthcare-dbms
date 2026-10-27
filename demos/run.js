// Runs a demo .sql / .cql file inside its container (works from PowerShell, cmd and Git Bash).
//   node demos/run.js demos/04-transaction/mssql/01_atomicity.sql          → print output
//   node demos/run.js demos/04-transaction/mssql/01_atomicity.sql --save   → also write ../results/<name>.txt
//   node demos/run.js <file> --node=hc-cassandra2                          → choose another Cassandra node
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  // defaults below
}

const [file, ...flags] = process.argv.slice(2);
if (!file || !/\.(sql|cql)$/.test(file)) {
  console.error('Usage: node demos/run.js <file.sql|file.cql> [--save] [--node=<container>]');
  process.exit(1);
}
const save = flags.includes('--save');
const node = flags.find((f) => f.startsWith('--node='))?.slice(7);

// prettier-ignore
const command = file.endsWith('.sql')
  ? [
      'exec', '-i', 'hc-mssql', '/opt/mssql-tools18/bin/sqlcmd',
      '-S', 'localhost', '-U', 'sa', '-P', process.env.MSSQL_SA_PASSWORD ?? 'Healthcare@2026',
      '-C', // trust the container's self-signed certificate
      '-I', // QUOTED_IDENTIFIER ON (required by filtered indexes / computed columns)
      '-d', process.env.MSSQL_DATABASE ?? 'HealthcareDB',
      '-f', '65001', // UTF-8 in/out
      '-W', // trim trailing spaces in result sets
    ]
  : ['exec', '-i', node ?? 'hc-cassandra', 'cqlsh'];

const child = spawn('docker', command, { stdio: ['pipe', 'pipe', 'pipe'] });
createReadStream(path.resolve(file)).pipe(child.stdin);

let output = '';
for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    output += chunk;
    process.stdout.write(chunk);
  });
}

child.on('close', async (code) => {
  if (save) {
    const target = path.join(
      path.dirname(path.resolve(file)),
      '..',
      'results',
      `${path.parse(file).name}.txt`,
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, output.replaceAll('\r\n', '\n'));
    console.log(`\n→ saved ${path.relative(REPO_ROOT, target)}`);
  }
  process.exit(code ?? 0);
});
