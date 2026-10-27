// Helpers for the optional 3-node Cassandra cluster (docker compose profile "cluster").
//   node demos/_common/cluster.js status
//   node demos/_common/cluster.js down   → decommission nodes 2-3 (streams their data back to node 1),
//                                          then remove their containers + volumes (back to 1-node dev).
//                                          Never "docker compose down" the extra nodes directly: they would
//                                          stay in the ring as DN and take their share of the data with them.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const NODES = ['hc-cassandra', 'hc-cassandra2', 'hc-cassandra3'];
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
export const nodetool = (node, ...args) => docker('exec', node, 'nodetool', ...args);

/** Number of nodes reported Up/Normal by node 1. */
export async function upNodes() {
  try {
    return (nodetool(NODES[0], 'status').match(/^UN\s/gm) ?? []).length;
  } catch {
    return 0;
  }
}

export async function waitForCqlsh(node, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      docker('exec', node, 'cqlsh', '-e', 'SELECT now() FROM system.local');
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await sleep(3000);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] ?? 'status';
  if (command === 'status') {
    console.log(nodetool(NODES[0], 'status'));
  } else if (command === 'down') {
    for (const node of [NODES[2], NODES[1]]) {
      console.log(`decommission ${node} …`);
      try {
        // --force: allowed even though demo keyspaces with RF=3 drop below RF; data is still streamed out
        nodetool(node, 'decommission', '--force');
      } catch (err) {
        // never remove a node that still owns data: that data would be lost
        console.error(`decommission failed, containers NOT removed:\n${err.stderr || err.message}`);
        process.exit(1);
      }
    }
    execFileSync('docker', ['compose', '--profile', 'cluster', 'rm', '-sf', 'cassandra2', 'cassandra3'], {
      stdio: 'inherit',
    });
    for (const volume of ['healthcare-dbms_cassandra2-data', 'healthcare-dbms_cassandra3-data']) {
      try {
        docker('volume', 'rm', volume);
      } catch {
        // already gone
      }
    }
    console.log(nodetool(NODES[0], 'status'));
  }
}
