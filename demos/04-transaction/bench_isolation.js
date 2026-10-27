// T4-S5  Does a reader ever see a multi-row write HALF applied ("torn read")?
// A writer keeps setting rows 1 and 2 to the same version inside ONE transaction / logged batch,
// readers keep reading both rows and count mismatches.
// Run: node demos/04-transaction/bench_isolation.js
import { close, cql, mssql, report } from '../_common/bench.js';

const DURATION_MS = 4000;
const READERS = 4;

async function race(db, name, write, read) {
  let stop = false;
  let writes = 0;
  let reads = 0;
  let torn = 0;
  const writer = (async () => {
    for (let v = 1; !stop; v++) {
      await write(v);
      writes++;
    }
  })();
  const readers = Array.from({ length: READERS }, async () => {
    while (!stop) {
      const [a, b] = await read();
      reads++;
      if (a !== b) torn++;
    }
  });
  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));
  stop = true;
  await Promise.all([writer, ...readers]);
  return { db, name, writes, reads, tornReads: torn, tornPct: `${((torn / reads) * 100).toFixed(2)}%` };
}

// ---------------------------------------------------------------- SQL Server
const pool = await mssql();
await pool.request().batch(`
  ALTER DATABASE CURRENT SET ALLOW_SNAPSHOT_ISOLATION ON;
  IF OBJECT_ID('dbo.lab_pair') IS NULL CREATE TABLE dbo.lab_pair (id INT PRIMARY KEY, version INT NOT NULL);
  DELETE dbo.lab_pair; INSERT dbo.lab_pair VALUES (1, 0), (2, 0);`);

const mssqlWrite = (v) =>
  pool.request().input('v', v).batch(`
    SET XACT_ABORT ON;
    BEGIN TRAN;
      UPDATE dbo.lab_pair SET version = @v WHERE id = 1;
      UPDATE dbo.lab_pair SET version = @v WHERE id = 2;
    COMMIT;`);

const mssqlRead = (level) => async () => {
  const { recordset } = await pool
    .request()
    .query(
      `SET TRANSACTION ISOLATION LEVEL ${level}; SELECT version FROM dbo.lab_pair WHERE id IN (1, 2) ORDER BY id;`,
    );
  return recordset.map((r) => r.version);
};

const results = [];
for (const level of ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SNAPSHOT']) {
  results.push(await race('SQL Server', `transaction, reader ${level}`, mssqlWrite, mssqlRead(level)));
}

// ---------------------------------------------------------------- Cassandra
const client = cql();
await client.execute(
  "CREATE KEYSPACE IF NOT EXISTS tx_demo WITH replication = {'class': 'NetworkTopologyStrategy', 'dc1': 1}",
);
await client.execute('CREATE TABLE IF NOT EXISTS tx_demo.pair (id int PRIMARY KEY, version int)');
await client.execute('TRUNCATE tx_demo.pair');

const update = 'UPDATE tx_demo.pair SET version = ? WHERE id = ?';
const cassandraRead = async () => {
  const rs = await client.execute('SELECT id, version FROM tx_demo.pair WHERE id IN (1, 2)', [], {
    prepare: true,
  });
  const byId = Object.fromEntries(rs.rows.map((r) => [r.id, r.version]));
  return [byId[1] ?? 0, byId[2] ?? 0];
};
for (const logged of [true, false]) {
  const write = (v) =>
    client.batch(
      [
        { query: update, params: [v, 1] },
        { query: update, params: [v, 2] },
      ],
      { prepare: true, logged },
    );
  results.push(
    await race('Cassandra', `${logged ? 'LOGGED' : 'UNLOGGED'} batch, reader ONE`, write, cassandraRead),
  );
}

await report(results, 'demos/04-transaction/results/bench_isolation.csv');
await close();
