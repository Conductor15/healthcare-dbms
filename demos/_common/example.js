// Smoke test + usage example for bench.js. Run: node demos/_common/example.js
import { benchCassandra, benchMssql, close, mssql, report, sql, throughput, types } from './bench.js';

const results = [];

// Latency: same "find by name" style query on both DBMS
results.push(
  await benchMssql(
    'departments LIKE (seed data)',
    'SELECT * FROM dbo.departments WHERE name LIKE @q',
    { q: [sql.NVarChar(100), '%Tim%'] },
    { runs: 20 },
  ),
);
results.push(
  await benchCassandra(
    'access log of user 1 today',
    'SELECT * FROM access_logs_by_user_day WHERE user_id = ? AND day = ?',
    [1, types.LocalDate.now()],
    { runs: 20 },
  ),
);
await report(results);

// Throughput: 200 concurrent reads
const pool = await mssql();
await report([
  await throughput('SQL Server', '200 reads, 20 in flight', 200, () => pool.request().query('SELECT 1'), {
    concurrency: 20,
  }),
]);

await close();
