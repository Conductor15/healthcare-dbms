// T5-S7  Tunable consistency on a 3-node cluster, keyspace RF = 3.
// Story: a nurse records a new allergy (penicillin) while node 3 is down. Node 3 comes back
// without the update (hinted handoff disabled to make the gap visible). Who reads what?
// Prereq: npm run db:up:cluster      Afterwards: node demos/_common/cluster.js down
// Run:    node demos/05-concurrency/cluster_consistency.js
import { execFileSync } from 'node:child_process';
import { report } from '../_common/bench.js';
import { NODES, nodetool, sleep, upNodes, waitForCqlsh } from '../_common/cluster.js';

const cqlsh = (node, statements) =>
  execFileSync('docker', ['exec', node, 'cqlsh', '-e', statements], { encoding: 'utf8', stdio: 'pipe' });

function readAllergy(node, consistency) {
  const out = cqlsh(
    node,
    `CONSISTENCY ${consistency}; SELECT allergy FROM cc_cluster.patient_allergy WHERE patient_id = 1;`,
  );
  return out.match(/-+\s*\n\s*(\S.*?)\s*\n\s*\n\(1 rows\)/)?.[1] ?? out.trim();
}

function tryWrite(node, consistency, allergy) {
  try {
    cqlsh(
      node,
      `CONSISTENCY ${consistency}; UPDATE cc_cluster.patient_allergy SET allergy = '${allergy}' WHERE patient_id = 1;`,
    );
    return 'OK';
  } catch (err) {
    return (err.stderr || err.message).split('\n').find((l) => l.includes('Error')) ?? 'FAILED';
  }
}

if ((await upNodes()) < 3) {
  console.error('Cần cluster 3 node đang chạy: npm run db:up:cluster');
  process.exit(1);
}

const steps = [];
const log = (step, node, consistency, result) => {
  steps.push({ step, node, consistency, result });
  console.log(`${step.padEnd(58)} ${node.padEnd(14)} ${String(consistency).padEnd(7)} → ${result}`);
};

cqlsh(
  NODES[0],
  `CREATE KEYSPACE IF NOT EXISTS cc_cluster WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 3};
   CREATE TABLE IF NOT EXISTS cc_cluster.patient_allergy (patient_id int PRIMARY KEY, allergy text);`,
);
for (const node of NODES) nodetool(node, 'disablehandoff');

log('1. Ghi "none" khi cả 3 node sống', NODES[0], 'ALL', tryWrite(NODES[0], 'ALL', 'none'));

execFileSync('docker', ['stop', NODES[2]], { stdio: 'pipe' });
while ((await upNodes()) > 2) await sleep(2000);
log('2. Node 3 chết. Ghi "penicillin" yêu cầu ALL', NODES[0], 'ALL', tryWrite(NODES[0], 'ALL', 'penicillin'));
log(
  '3. Ghi "penicillin" với QUORUM (2/3 node đủ)',
  NODES[0],
  'QUORUM',
  tryWrite(NODES[0], 'QUORUM', 'penicillin'),
);

execFileSync('docker', ['start', NODES[2]], { stdio: 'pipe' });
while ((await upNodes()) < 3) await sleep(3000);
await waitForCqlsh(NODES[2]);

const oneReads = Array.from({ length: 5 }, () => readAllergy(NODES[2], 'ONE'));
log('4. Node 3 sống lại (thiếu bản ghi). Đọc ONE ×5 qua node 3', NODES[2], 'ONE', oneReads.join(', '));
log('5. Đọc QUORUM qua node 3 (R+W = 2+2 > 3)', NODES[2], 'QUORUM', readAllergy(NODES[2], 'QUORUM'));
const afterRepair = Array.from({ length: 5 }, () => readAllergy(NODES[2], 'ONE'));
log('6. Đọc ONE ×5 lại sau QUORUM (read repair?)', NODES[2], 'ONE', afterRepair.join(', '));

for (const node of NODES) nodetool(node, 'enablehandoff');
await report(steps, 'demos/05-concurrency/results/cluster_consistency.csv');
