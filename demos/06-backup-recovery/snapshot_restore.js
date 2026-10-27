// T6-S2/S5 (Cassandra)  Snapshot + incremental backup, then restore after an accidental TRUNCATE.
// Snapshot = hard links to the immutable SSTables (instant, no copy). Incremental backups hard-link every
// SSTable flushed after the snapshot, closing the gap between snapshots.
// Run (single node): node demos/06-backup-recovery/snapshot_restore.js
import { execFileSync } from 'node:child_process';
import { report } from '../_common/bench.js';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
const cqlsh = (statements) => docker('exec', 'hc-cassandra', 'cqlsh', '-e', statements);
const nodetool = (...args) => docker('exec', 'hc-cassandra', 'nodetool', ...args);
const sh = (command) => docker('exec', 'hc-cassandra', 'sh', '-c', command).trim();
const count = () => cqlsh('SELECT COUNT(*) FROM backup_demo.vitals;').match(/^\s+(\d+)\s*$/m)?.[1];
const insertRows = (from, to) =>
  execFileSync('docker', ['exec', '-i', 'hc-cassandra', 'cqlsh'], {
    input: Array.from(
      { length: to - from },
      (_, k) =>
        `INSERT INTO backup_demo.vitals (patient_id, day, recorded_at, heart_rate) VALUES (${(from + k) % 10}, '2026-10-26', ${1792900000000 + from + k}, ${60 + ((from + k) % 40)});`,
    ).join('\n'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

const steps = [];
const log = (step, result) => {
  steps.push({ step, result });
  console.log(`${step.padEnd(62)} → ${result}`);
};

cqlsh(`CREATE KEYSPACE IF NOT EXISTS backup_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1};
       CREATE TABLE IF NOT EXISTS backup_demo.vitals (patient_id int, day date, recorded_at timestamp, heart_rate int,
         PRIMARY KEY ((patient_id, day), recorded_at));
       TRUNCATE backup_demo.vitals;`);
nodetool('clearsnapshot', '--all', '--', 'backup_demo');
const tableDir = sh('ls -d /var/lib/cassandra/data/backup_demo/vitals-* | head -1');
sh(`rm -rf ${tableDir}/backups`);

insertRows(0, 100);
nodetool('flush', 'backup_demo');
log('1. 100 bản ghi sinh hiệu, flush ra SSTable', `${count()} dòng`);

const t0 = Date.now();
nodetool('snapshot', '-t', 'daily', 'backup_demo');
log('2. nodetool snapshot -t daily (hard link, không copy)', `${Date.now() - t0} ms`);
log('   Các file trong snapshot', sh(`ls ${tableDir}/snapshots/daily | grep -c Data.db`) + ' SSTable');

nodetool('enablebackup');
insertRows(100, 120);
nodetool('flush', 'backup_demo');
log('3. Bật incremental backup, ghi thêm 20 bản ghi, flush', `${count()} dòng`);
log(
  '   Thư mục backups/ (SSTable mới được hard-link)',
  sh(`ls ${tableDir}/backups | grep -c Data.db`) + ' SSTable',
);
nodetool('disablebackup');

cqlsh('TRUNCATE backup_demo.vitals;');
log('4. Sự cố: TRUNCATE', `${count()} dòng`);
log(
  '   auto_snapshot cũng tự chụp trước khi TRUNCATE',
  nodetool('listsnapshots')
    .split('\n')
    .filter((l) => l.includes('backup_demo'))
    .map((l) => l.trim().split(/\s+/)[0])
    .join(', '),
);

nodetool('import', '--copy-data', 'backup_demo', 'vitals', `${tableDir}/snapshots/daily`);
log('5. nodetool import từ snapshot "daily"', `${count()} dòng (mất 20 bản ghi sau snapshot)`);
nodetool('import', '--copy-data', 'backup_demo', 'vitals', `${tableDir}/backups`);
log('6. nodetool import thêm từ incremental backups/', `${count()} dòng`);

await report(steps, 'demos/06-backup-recovery/results/snapshot_restore.csv');
