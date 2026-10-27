// Step S1.6: shared measurement harness so all 6 topics report numbers the same way.
// Usage: see demos/_common/README.md and demos/_common/example.js
import './env.js'; // must stay first: config.js reads process.env on load
import cassandra from 'cassandra-driver';
import sql from 'mssql';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { config } from '../../server/src/config.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

export { sql };
export const { types } = cassandra;

// ---------------------------------------------------------------- connections

let mssqlPool;
let cassandraClient;

export async function mssql() {
  mssqlPool ??= await new sql.ConnectionPool({ ...config.mssql, pool: { max: 100 } }).connect();
  return mssqlPool;
}

export function cql() {
  cassandraClient ??= new cassandra.Client({ ...config.cassandra, socketOptions: { readTimeout: 60_000 } });
  return cassandraClient;
}

export async function close() {
  await Promise.allSettled([mssqlPool?.close(), cassandraClient?.shutdown()]);
}

// ---------------------------------------------------------------- statistics

function summarize(db, name, timings, extra = {}) {
  const sorted = [...timings].sort((a, b) => a - b);
  const pct = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const round = (x) => Math.round(x * 100) / 100;
  return {
    db,
    name,
    runs: sorted.length,
    min: round(sorted[0]),
    avg: round(sorted.reduce((s, x) => s + x, 0) / sorted.length),
    p50: round(pct(0.5)),
    p95: round(pct(0.95)),
    max: round(sorted.at(-1)),
    ...extra,
  };
}

/**
 * `params`: { name: value } (type inferred) or { name: [sql.Int, value] } (explicit type).
 */
function bindParams(request, params) {
  for (const [name, value] of Object.entries(params)) {
    if (Array.isArray(value)) request.input(name, value[0], value[1]);
    else request.input(name, value);
  }
  return request;
}

/**
 * Times `query` on SQL Server. Also sums "logical reads" reported by SET STATISTICS IO,
 * the metric that matters most for indexing/query-processing comparisons.
 * Options: runs, warmup, cold (flush buffer pool before every run: slower, measures disk reads).
 */
export async function benchMssql(name, query, params = {}, { runs = 10, warmup = 2, cold = false } = {}) {
  const pool = await mssql();
  const timings = [];
  let rows = 0;
  let logicalReads = 0;

  for (let i = 0; i < warmup + runs; i++) {
    if (cold) await pool.request().batch('CHECKPOINT; DBCC DROPCLEANBUFFERS WITH NO_INFOMSGS;');
    const request = bindParams(pool.request(), params);
    let reads = 0;
    request.on('info', ({ message }) => {
      for (const m of message.matchAll(/logical reads (\d+)/g)) reads += Number(m[1]);
    });

    const start = performance.now();
    const result = await request.query(`SET STATISTICS IO ON; ${query}`);
    const elapsed = performance.now() - start;

    if (i >= warmup) {
      timings.push(elapsed);
      rows = result.recordset?.length ?? result.rowsAffected.at(-1) ?? 0;
      logicalReads = reads;
    }
  }
  return summarize('SQL Server', name, timings, { rows, logicalReads });
}

/** Times a CQL statement (always prepared). Options: runs, warmup, consistency (types.consistencies.*). */
export async function benchCassandra(name, query, params = [], { runs = 10, warmup = 2, consistency } = {}) {
  const client = cql();
  const timings = [];
  let rows = 0;

  for (let i = 0; i < warmup + runs; i++) {
    const start = performance.now();
    const result = await client.execute(query, params, { prepare: true, consistency });
    const elapsed = performance.now() - start;
    if (i >= warmup) {
      timings.push(elapsed);
      rows = result.rowLength ?? 0;
    }
  }
  return summarize('Cassandra', name, timings, { rows });
}

/**
 * Throughput test: runs `task(i)` `total` times with at most `concurrency` in flight.
 * Returns ops/s and outcome counts. Good for bulk-insert and concurrency (double-booking) demos.
 */
export async function throughput(db, name, total, task, { concurrency = 50 } = {}) {
  let next = 0;
  let ok = 0;
  const errors = {};
  const start = performance.now();

  async function worker() {
    while (next < total) {
      const i = next++;
      try {
        await task(i);
        ok++;
      } catch (err) {
        const key = err.number ? `SQL ${err.number}` : (err.code ?? err.name ?? 'Error');
        errors[key] = (errors[key] ?? 0) + 1;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));

  const seconds = (performance.now() - start) / 1000;
  return {
    db,
    name,
    total,
    ok,
    failed: total - ok,
    errors: JSON.stringify(errors),
    seconds: Math.round(seconds * 100) / 100,
    opsPerSec: Math.round(ok / seconds),
  };
}

// ---------------------------------------------------------------- scripts & output

/** Runs a .sql file (batches separated by GO lines), e.g. a demo's setup script. */
export async function execMssqlFile(file) {
  const pool = await mssql();
  const text = await readFile(path.resolve(REPO_ROOT, file), 'utf8');
  for (const batch of text.split(/^\s*GO\s*$/gim).map((b) => b.trim())) {
    if (batch) await pool.request().batch(batch);
  }
}

/** Prints results as a table and, if `file` is given, writes them as CSV (path relative to repo root). */
export async function report(results, file) {
  console.table(results);
  if (!file) return;
  const columns = [...new Set(results.flatMap(Object.keys))];
  const escape = (v) =>
    v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : v;
  const csv = [columns.join(','), ...results.map((r) => columns.map((c) => escape(r[c])).join(','))].join(
    '\n',
  );
  const target = path.resolve(REPO_ROOT, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${csv}\n`);
  console.log(`→ ${path.relative(REPO_ROOT, target)}`);
}
