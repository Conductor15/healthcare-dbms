// T4-S8  What does a transaction cost? Insert N rows in different transactional styles.
// Run: node demos/04-transaction/bench_cost.js
import { close, cql, mssql, report, throughput } from '../_common/bench.js';

const N = 2000;
const results = [];

// ---------------------------------------------------------------- SQL Server
const pool = await mssql();
await pool.request().batch(`
  IF OBJECT_ID('dbo.lab_tx_cost') IS NULL
    CREATE TABLE dbo.lab_tx_cost (id INT IDENTITY PRIMARY KEY, patient_id INT NOT NULL, note NVARCHAR(50) NOT NULL);
  TRUNCATE TABLE dbo.lab_tx_cost;`);
const insertSql = 'INSERT dbo.lab_tx_cost (patient_id, note) VALUES (@p, @n)';

results.push(
  await throughput(
    'SQL Server',
    'autocommit, 1 client (1 commit/row)',
    N,
    (i) => pool.request().input('p', i).input('n', `row ${i}`).query(insertSql),
    { concurrency: 1 },
  ),
);
results.push(
  await throughput(
    'SQL Server',
    'autocommit, 16 clients',
    N,
    (i) => pool.request().input('p', i).input('n', `row ${i}`).query(insertSql),
    { concurrency: 16 },
  ),
);

// one explicit transaction around all N inserts → one log flush at COMMIT
const tx = pool.transaction();
await tx.begin();
results.push(
  await throughput(
    'SQL Server',
    `1 transaction for ${N} rows, 1 client`,
    N,
    (i) => tx.request().input('p', i).input('n', `row ${i}`).query(insertSql),
    { concurrency: 1 },
  ),
);
await tx.commit();

// ---------------------------------------------------------------- Cassandra
const client = cql();
await client.execute(
  "CREATE KEYSPACE IF NOT EXISTS tx_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1}",
);
await client.execute(
  'CREATE TABLE IF NOT EXISTS tx_demo.cost (patient_id int, seq int, note text, PRIMARY KEY (patient_id, seq))',
);
await client.execute('TRUNCATE tx_demo.cost');
const insertCql = 'INSERT INTO tx_demo.cost (patient_id, seq, note) VALUES (?, ?, ?)';
const opts = { prepare: true };

results.push(
  await throughput(
    'Cassandra',
    'single INSERT, 1 client',
    N,
    (i) => client.execute(insertCql, [i % 100, i, `row ${i}`], opts),
    { concurrency: 1 },
  ),
);
results.push(
  await throughput(
    'Cassandra',
    'single INSERT, 16 clients',
    N,
    (i) => client.execute(insertCql, [i % 100, N + i, `row ${i}`], opts),
    { concurrency: 16 },
  ),
);
const unlogged = await throughput(
  'Cassandra',
  'UNLOGGED batch 50 rows / 1 partition',
  N / 50,
  (b) =>
    client.batch(
      Array.from({ length: 50 }, (_, k) => ({ query: insertCql, params: [1000 + b, k, `row ${k}`] })),
      { ...opts, logged: false },
    ),
  { concurrency: 1 },
);
results.push({ ...unlogged, name: `${unlogged.name} (ok = batches)`, rowsPerSec: unlogged.opsPerSec * 50 });
const logged = await throughput(
  'Cassandra',
  'LOGGED batch 2 rows / 2 partitions',
  N / 2,
  (b) =>
    client.batch(
      [
        { query: insertCql, params: [2000 + b, 0, 'a'] },
        { query: insertCql, params: [3000 + b, 0, 'b'] },
      ],
      { ...opts, logged: true },
    ),
  { concurrency: 1 },
);
results.push({ ...logged, name: `${logged.name} (ok = batches)`, rowsPerSec: logged.opsPerSec * 2 });
results.push(
  await throughput(
    'Cassandra',
    'LWT INSERT ... IF NOT EXISTS, 1 client',
    N,
    (i) => client.execute(`${insertCql} IF NOT EXISTS`, [5000 + (i % 100), i, `row ${i}`], opts),
    { concurrency: 1 },
  ),
);

await report(
  results.map((r) => ({ ...r, rowsPerSec: r.rowsPerSec ?? r.opsPerSec })),
  'demos/04-transaction/results/bench_cost.csv',
);
await close();
