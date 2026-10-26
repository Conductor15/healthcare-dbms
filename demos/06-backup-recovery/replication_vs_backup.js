// T6-S6  Replication gives availability, NOT backup.
// RF=3: losing a node keeps the clinic running, but a mistaken TRUNCATE is faithfully
// replicated to every node; only a snapshot brings the data back.
// Prereq: npm run db:up:cluster (run after 05-concurrency/cluster_consistency.js, which creates cc_cluster)
// Run:    node demos/06-backup-recovery/replication_vs_backup.js
import { execFileSync } from 'node:child_process';
import { report } from '../_common/bench.js';
import { NODES, nodetool, sleep, upNodes, waitForCqlsh } from '../_common/cluster.js';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
const cqlsh = (node, statements) => docker('exec', node, 'cqlsh', '-e', statements);
const count = (node, cl) =>
  cqlsh(node, `CONSISTENCY ${cl}; SELECT COUNT(*) FROM cc_cluster.patient_allergy;`).match(
    /^\s+(\d+)\s*$/m,
  )?.[1];

if ((await upNodes()) < 3) {
  console.error('Cần cluster 3 node đang chạy: npm run db:up:cluster');
  process.exit(1);
}

const steps = [];
const log = (step, result) => {
  steps.push({ step, result });
  console.log(`${step.padEnd(64)} → ${result}`);
};

cqlsh(
  NODES[0],
  `CREATE KEYSPACE IF NOT EXISTS cc_cluster WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 3};
   CREATE TABLE IF NOT EXISTS cc_cluster.patient_allergy (patient_id int PRIMARY KEY, allergy text);
   CONSISTENCY ALL;
   INSERT INTO cc_cluster.patient_allergy (patient_id, allergy) VALUES (1, 'penicillin');
   INSERT INTO cc_cluster.patient_allergy (patient_id, allergy) VALUES (2, 'aspirin');
   INSERT INTO cc_cluster.patient_allergy (patient_id, allergy) VALUES (3, 'none');`,
);
log('1. 3 hồ sơ dị ứng, ghi CONSISTENCY ALL (có trên cả 3 node)', `${count(NODES[0], 'ALL')} dòng`);

docker('stop', NODES[1]);
while ((await upNodes()) > 2) await sleep(2000);
log('2. Node 2 chết → vẫn đọc được với QUORUM (high availability)', `${count(NODES[0], 'QUORUM')} dòng`);
try {
  cqlsh(NODES[0], 'TRUNCATE cc_cluster.patient_allergy;');
  log('3. TRUNCATE khi node 2 chết', 'OK');
} catch (err) {
  log('3. TRUNCATE khi node 2 chết', `bị từ chối: TRUNCATE cần TẤT CẢ replica sống`);
}
docker('start', NODES[1]);
while ((await upNodes()) < 3) await sleep(3000);
await waitForCqlsh(NODES[1]);

for (const node of NODES) nodetool(node, 'clearsnapshot', '-t', 'before_mistake', '--', 'cc_cluster');
for (const node of NODES) nodetool(node, 'snapshot', '-t', 'before_mistake', 'cc_cluster');
log('4. nodetool snapshot -t before_mistake trên TỪNG node', 'OK (3 snapshot)');

cqlsh(NODES[0], 'TRUNCATE cc_cluster.patient_allergy;');
log(
  '5. Lỡ tay TRUNCATE (cả 3 node sống) → đọc ALL',
  `${count(NODES[0], 'ALL')} dòng: replication đã nhân bản cả lỗi`,
);

for (const node of NODES) {
  const dir = docker(
    'exec',
    node,
    'sh',
    '-c',
    'ls -d /var/lib/cassandra/data/cc_cluster/patient_allergy-*/snapshots/before_mistake',
  ).trim();
  nodetool(node, 'import', '--copy-data', 'cc_cluster', 'patient_allergy', dir);
}
log('6. nodetool import --copy-data từ snapshot trên từng node → đọc ALL', `${count(NODES[0], 'ALL')} dòng`);

await report(steps, 'demos/06-backup-recovery/results/replication_vs_backup.csv');
