// DB Lab (bonus, S3.10–S3.11): experiments run on a SEPARATE pool so session settings they change
// (isolation level, LOCK_TIMEOUT) never leak into the application's connections.
// The same functions are used by the API (DB Lab page) and by the demo scripts in /demos.
import sql from 'mssql';
import { config } from '../../config.js';

let labPoolPromise;

export function getLabPool() {
  labPoolPromise ??= new sql.ConnectionPool({
    ...config.mssql,
    requestTimeout: 120_000, // backups/restores and deadlock detection outlast the 15s default
    pool: { max: 80 },
  })
    .connect()
    .catch((err) => {
      labPoolPromise = undefined;
      throw err;
    });
  return labPoolPromise;
}

export async function closeLabPool() {
  if (labPoolPromise) await (await labPoolPromise).close();
  labPoolPromise = undefined;
}

/** Runs one statement on a transaction (or pool) with { name: value } params. */
export function run(target, text, params = {}) {
  const request = target.request();
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  return request.query(text);
}

/** Begins a transaction on its own connection with the given isolation and lock timeout (ms, -1 = wait forever). */
export async function begin(pool, isolation, lockTimeoutMs = 1500) {
  const tx = new sql.Transaction(pool);
  await tx.begin(isolation);
  await tx.request().batch(`SET LOCK_TIMEOUT ${Number(lockTimeoutMs)}`);
  return tx;
}

export async function safeRollback(tx) {
  try {
    await tx.rollback();
  } catch {
    // already rolled back by the server (deadlock victim, XACT_ABORT, ...)
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ISOLATION_LEVELS = {
  'READ UNCOMMITTED': sql.ISOLATION_LEVEL.READ_UNCOMMITTED,
  'READ COMMITTED': sql.ISOLATION_LEVEL.READ_COMMITTED,
  'REPEATABLE READ': sql.ISOLATION_LEVEL.REPEATABLE_READ,
  SERIALIZABLE: sql.ISOLATION_LEVEL.SERIALIZABLE,
  SNAPSHOT: sql.ISOLATION_LEVEL.SNAPSHOT,
};

/** Maps SQL Server concurrency errors to a short explanation. */
export function describeSqlError(err) {
  switch (err.number) {
    case 1222:
      return 'bị chặn (lock timeout 1222)';
    case 1205:
      return 'deadlock victim (1205)';
    case 3960:
      return 'snapshot update conflict (3960)';
    case 2627:
    case 2601:
      return 'vi phạm UNIQUE (2627)';
    default:
      return `lỗi ${err.number ?? ''} ${err.message}`;
  }
}

export { sql };
