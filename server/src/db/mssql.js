import sql from 'mssql';
import { config } from '../config.js';

let poolPromise;

export function getPool() {
  poolPromise ??= new sql.ConnectionPool({
    ...config.mssql,
    pool: { max: 20, min: 0, idleTimeoutMillis: 30_000 },
  })
    .connect()
    .catch((err) => {
      poolPromise = undefined; // allow retry on next request
      throw err;
    });
  return poolPromise;
}

/**
 * Runs `work(tx)` in one transaction: commit on success, rollback on any error.
 * Create requests with `new sql.Request(tx)` inside `work`.
 */
export async function withTransaction(work, isolationLevel = sql.ISOLATION_LEVEL.READ_COMMITTED) {
  const tx = new sql.Transaction(await getPool());
  await tx.begin(isolationLevel);
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // server already aborted the transaction (e.g. XACT_ABORT / deadlock victim)
    }
    throw err;
  }
}

export async function closeMssql() {
  if (poolPromise) await (await poolPromise).close();
}

export { sql };
