import { Router } from 'express';
import { getCassandra } from '../../db/cassandra.js';
import { getPool } from '../../db/mssql.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const [mssql, cassandra] = await Promise.allSettled([
    getPool()
      .then((pool) => pool.request().query('SELECT @@VERSION AS v'))
      .then((r) => r.recordset[0].v.split('\n')[0].trim()),
    getCassandra()
      .execute('SELECT release_version FROM system.local')
      .then((r) => `Apache Cassandra ${r.first().release_version}`),
  ]);
  const view = (r) =>
    r.status === 'fulfilled' ? { ok: true, version: r.value } : { ok: false, error: r.reason.message };
  const body = { mssql: view(mssql), cassandra: view(cassandra) };
  res.status(body.mssql.ok && body.cassandra.ok ? 200 : 503).json(body);
});
