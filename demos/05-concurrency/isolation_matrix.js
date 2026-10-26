// T5-S1/S2  Which anomalies does each SQL Server isolation level allow?
// Each cell runs a deterministic 2-session interleaving on dbo.lab_stock (lock timeout 1.5s).
// Same code as the DB Lab page: server/src/modules/lab/concurrency.lab.js
// Run: node demos/05-concurrency/isolation_matrix.js
import '../_common/env.js';
import { closeLabPool } from '../../server/src/modules/lab/lab.db.js';
import { isolationMatrix } from '../../server/src/modules/lab/concurrency.lab.js';
import { report } from '../_common/bench.js';

const { levels, rows } = await isolationMatrix();

const mark = (cell) => (cell.anomaly ? '✗ CÓ' : '✓ không');
await report(
  rows.map((r) => ({ anomaly: r.anomaly, ...Object.fromEntries(levels.map((l) => [l, mark(r.cells[l])])) })),
);

const detail = rows.flatMap((r) =>
  levels.map((level) => ({
    anomaly: r.anomaly,
    level,
    occurs: r.cells[level].anomaly,
    how: r.cells[level].how,
  })),
);
await report(detail, 'demos/05-concurrency/results/isolation_matrix.csv');
await closeLabPool();
