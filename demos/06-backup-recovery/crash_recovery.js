// T6-S4 (+ T4-S7 durability)  Crash recovery: kill -9 both DBMS in the middle of work, restart, inspect.
// SQL Server: an UNCOMMITTED update whose dirty pages were already flushed (needs UNDO) and a COMMITTED
// insert that only exists in the log (needs REDO). Cassandra: acknowledged writes still only in the
// memtable (0 SSTables) must come back from the commit log.
// WARNING: restarts both containers; the API server (if running) reconnects automatically.
// Run: node demos/06-backup-recovery/crash_recovery.js
import '../_common/env.js';
import { execFileSync, spawn } from 'node:child_process';
import { report } from '../_common/bench.js';
import { sleep } from '../_common/cluster.js';

const PASSWORD = process.env.MSSQL_SA_PASSWORD ?? 'Healthcare@2026';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
const sqlcmdArgs = (query) => [
  'exec',
  'hc-mssql',
  '/opt/mssql-tools18/bin/sqlcmd',
  '-S',
  'localhost',
  '-U',
  'sa',
  '-P',
  PASSWORD,
  '-C',
  '-d',
  'HealthcareDB',
  '-W',
  '-h',
  '-1',
  '-Q',
  `SET NOCOUNT ON; ${query}`,
];
const sqlcmd = (query) => docker(...sqlcmdArgs(query)).trim();
const cqlsh = (statements) => docker('exec', '-i', 'hc-cassandra', 'cqlsh', '-e', statements);

async function waitFor(check, label) {
  for (let i = 0; i < 90; i++) {
    try {
      check();
      return;
    } catch {
      await sleep(2000);
    }
  }
  throw new Error(`${label} did not come back`);
}

const results = [];
const log = (dbms, step, value) => {
  results.push({ dbms, step, value });
  console.log(`[${dbms}] ${step}: ${value}`);
};

// ------------------------------------------------------------------ SQL Server
sqlcmd(`
  IF OBJECT_ID('dbo.lab_crash') IS NULL CREATE TABLE dbo.lab_crash (id INT IDENTITY PRIMARY KEY, note NVARCHAR(50));
  IF OBJECT_ID('dbo.lab_crash_big') IS NULL
  BEGIN
    CREATE TABLE dbo.lab_crash_big (id INT PRIMARY KEY, qty INT NOT NULL);
    INSERT dbo.lab_crash_big SELECT TOP (5000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)), 100
    FROM sys.all_objects a CROSS JOIN sys.all_objects b;
  END;
  TRUNCATE TABLE dbo.lab_crash; UPDATE dbo.lab_crash_big SET qty = 100;`);

// session A: big uncommitted transaction, left open
const open = spawn(
  'docker',
  sqlcmdArgs(`BEGIN TRAN;
    UPDATE dbo.lab_crash_big SET qty = 0;
    INSERT dbo.lab_crash (note) VALUES (N'uncommitted');
    WAITFOR DELAY '00:05:00';
    COMMIT;`),
  { stdio: 'ignore' },
);
await sleep(2000);
sqlcmd('CHECKPOINT;'); // flushes dirty pages, including the uncommitted qty = 0, to the data file
sqlcmd("INSERT dbo.lab_crash (note) VALUES (N'committed after checkpoint');"); // only in the log
log(
  'SQL Server',
  'trước crash, đọc NOLOCK qty',
  sqlcmd('SELECT DISTINCT qty FROM dbo.lab_crash_big WITH (NOLOCK);'),
);

docker('kill', 'hc-mssql'); // SIGKILL: no shutdown, no checkpoint
open.kill();
docker('start', 'hc-mssql');
await waitFor(() => sqlcmd('SELECT 1;'), 'SQL Server');
log('SQL Server', 'sau restart, qty (UNDO)', sqlcmd('SELECT DISTINCT qty FROM dbo.lab_crash_big;'));
log(
  'SQL Server',
  'sau restart, lab_crash (REDO)',
  sqlcmd("SELECT STRING_AGG(note, ' | ') FROM dbo.lab_crash;"),
);
const errorlog = docker('exec', 'hc-mssql', 'cat', '/var/opt/mssql/log/errorlog')
  .split('\n')
  .filter((l) => /HealthcareDB/.test(l) && /(Recovery|rolled|transactions|Phase)/i.test(l))
  .map((l) => l.replace(/^\S+ \S+\s+\S+\s+/, '').trim());
for (const line of errorlog) log('SQL Server', 'errorlog', line);

// ------------------------------------------------------------------ Cassandra
cqlsh(`CREATE KEYSPACE IF NOT EXISTS tx_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1};
       CREATE TABLE IF NOT EXISTS tx_demo.crash_demo (id int PRIMARY KEY, note text);
       TRUNCATE tx_demo.crash_demo;`);
const inserts = Array.from(
  { length: 500 },
  (_, i) => `INSERT INTO tx_demo.crash_demo (id, note) VALUES (${i}, 'vital ${i}');`,
).join('\n');
execFileSync('docker', ['exec', '-i', 'hc-cassandra', 'cqlsh'], {
  input: inserts,
  stdio: ['pipe', 'pipe', 'pipe'],
});
const sstables = docker('exec', 'hc-cassandra', 'nodetool', 'tablestats', 'tx_demo.crash_demo').match(
  /SSTable count: (\d+)/,
)?.[1];
log('Cassandra', 'trước crash: 500 dòng đã ack, số SSTable trên đĩa', sstables);

const killedAt = new Date().toISOString();
docker('kill', 'hc-cassandra');
docker('start', 'hc-cassandra');
await waitFor(() => cqlsh('SELECT now() FROM system.local;'), 'Cassandra');
log(
  'Cassandra',
  'sau restart, COUNT(*)',
  cqlsh('SELECT COUNT(*) FROM tx_demo.crash_demo;').match(/^\s+(\d+)\s*$/m)?.[1],
);
const replay = docker('logs', '--since', killedAt, 'hc-cassandra')
  .split('\n')
  .filter((l) => /Replaying .*commitlog|Log replay complete/i.test(l))
  .map((l) => l.replace(/^.*?\] \S+ \S+ /, '').trim())
  .slice(0, 4);
for (const line of replay) log('Cassandra', 'log', line);

await report(results, 'demos/06-backup-recovery/results/crash_recovery.csv');
