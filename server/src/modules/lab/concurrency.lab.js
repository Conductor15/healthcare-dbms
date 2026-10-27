// Topic v (Concurrency control) experiments: isolation-level anomaly matrix, double-booking race, deadlock.
import { getCassandra } from '../../db/cassandra.js';
import {
  begin,
  describeSqlError,
  getLabPool,
  ISOLATION_LEVELS,
  run,
  safeRollback,
  sleep,
  sql,
} from './lab.db.js';

const RC = sql.ISOLATION_LEVEL.READ_COMMITTED;

async function setupStock(pool) {
  await pool.request().batch(`
    IF (SELECT snapshot_isolation_state FROM sys.databases WHERE database_id = DB_ID()) = 0
      ALTER DATABASE CURRENT SET ALLOW_SNAPSHOT_ISOLATION ON;
    IF OBJECT_ID('dbo.lab_stock') IS NULL
      CREATE TABLE dbo.lab_stock (id INT PRIMARY KEY, name NVARCHAR(50) NOT NULL, qty INT NOT NULL);`);
}

const resetStock = (pool) =>
  pool.request().batch(`
    DELETE dbo.lab_stock;
    INSERT dbo.lab_stock VALUES (1, N'Paracetamol', 100), (2, N'Amoxicillin', 50), (3, N'Vitamin C', 200);`);

/** Tries `fn`; returns { ok: true, value } or { ok: false, why } for concurrency errors. */
async function attempt(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, why: describeSqlError(err) };
  }
}

// ------------------------------------------------------------------ anomalies

async function dirtyRead(pool, level) {
  const writer = await begin(pool, RC);
  const reader = await begin(pool, ISOLATION_LEVELS[level]);
  try {
    await run(writer, 'UPDATE dbo.lab_stock SET qty = 999 WHERE id = 1'); // not committed
    const read = await attempt(() => run(reader, 'SELECT qty FROM dbo.lab_stock WHERE id = 1'));
    if (!read.ok) return { anomaly: false, how: read.why };
    const qty = read.value.recordset[0].qty;
    return qty === 999
      ? { anomaly: true, how: 'đọc được 999 chưa commit' }
      : { anomaly: false, how: `đọc phiên bản đã commit (${qty})` };
  } finally {
    await safeRollback(reader);
    await safeRollback(writer);
  }
}

async function nonRepeatableRead(pool, level) {
  const reader = await begin(pool, ISOLATION_LEVELS[level]);
  try {
    const first = (await run(reader, 'SELECT qty FROM dbo.lab_stock WHERE id = 1')).recordset[0].qty;
    const writer = await begin(pool, RC);
    const write = await attempt(() => run(writer, 'UPDATE dbo.lab_stock SET qty = qty + 1 WHERE id = 1'));
    if (write.ok) await writer.commit();
    else await safeRollback(writer);
    const second = (await run(reader, 'SELECT qty FROM dbo.lab_stock WHERE id = 1')).recordset[0].qty;
    if (first !== second) return { anomaly: true, how: `lần 1 đọc ${first}, lần 2 đọc ${second}` };
    return {
      anomaly: false,
      how: write.ok ? `writer commit được nhưng reader vẫn thấy ${first}` : `writer ${write.why}`,
    };
  } finally {
    await safeRollback(reader);
  }
}

async function phantomRead(pool, level) {
  const countSql = 'SELECT COUNT(*) AS n FROM dbo.lab_stock WHERE qty > 80';
  const reader = await begin(pool, ISOLATION_LEVELS[level]);
  try {
    const first = (await run(reader, countSql)).recordset[0].n;
    const writer = await begin(pool, RC);
    const write = await attempt(() => run(writer, "INSERT dbo.lab_stock VALUES (99, N'Thuốc mới', 500)"));
    if (write.ok) await writer.commit();
    else await safeRollback(writer);
    const second = (await run(reader, countSql)).recordset[0].n;
    if (first !== second) return { anomaly: true, how: `COUNT lần 1 = ${first}, lần 2 = ${second}` };
    return {
      anomaly: false,
      how: write.ok ? 'INSERT commit được nhưng reader không thấy' : `INSERT ${write.why}`,
    };
  } finally {
    await safeRollback(reader);
  }
}

/** Two clerks read stock 100 and each dispense 10 with read-modify-write. Correct result: 80. */
async function lostUpdate(pool, level, { atomic = false } = {}) {
  const a = await begin(pool, ISOLATION_LEVELS[level]);
  const b = await begin(pool, ISOLATION_LEVELS[level]);
  const write = (tx, seen) =>
    atomic
      ? run(tx, 'UPDATE dbo.lab_stock SET qty = qty - 10 WHERE id = 1')
      : run(tx, 'UPDATE dbo.lab_stock SET qty = @qty WHERE id = 1', { qty: seen - 10 });
  try {
    const seenA = (await run(a, 'SELECT qty FROM dbo.lab_stock WHERE id = 1')).recordset[0].qty;
    const seenB = (await run(b, 'SELECT qty FROM dbo.lab_stock WHERE id = 1')).recordset[0].qty;

    const wa = await attempt(() => write(a, seenA));
    if (wa.ok) await a.commit();
    else await safeRollback(a);
    const wb = await attempt(() => write(b, seenB));
    if (wb.ok) await b.commit();
    else await safeRollback(b);

    const final = (await run(pool, 'SELECT qty FROM dbo.lab_stock WHERE id = 1')).recordset[0].qty;
    if (wa.ok && wb.ok && final !== 80)
      return { anomaly: true, how: `cả 2 commit nhưng tồn kho = ${final} (đúng: 80)` };
    if (wa.ok && wb.ok) return { anomaly: false, how: `cả 2 commit, tồn kho = ${final}` };
    return { anomaly: false, how: `một bên ${wa.ok ? wb.why : wa.why} → phải thử lại` };
  } finally {
    await safeRollback(a);
    await safeRollback(b);
  }
}

const ANOMALIES = [
  { key: 'dirtyRead', label: 'Dirty read', fn: dirtyRead },
  { key: 'nonRepeatableRead', label: 'Non-repeatable read', fn: nonRepeatableRead },
  { key: 'phantomRead', label: 'Phantom read', fn: phantomRead },
  { key: 'lostUpdate', label: 'Lost update (đọc rồi ghi)', fn: lostUpdate },
  {
    key: 'lostUpdateAtomic',
    label: 'Lost update (UPDATE qty = qty - 10)',
    fn: (p, l) => lostUpdate(p, l, { atomic: true }),
  },
];

/**
 * Runs every anomaly scenario under every isolation level (fresh data each time).
 * @returns {{ levels: string[], rows: { anomaly: string, cells: Record<string, {anomaly: boolean, how: string}> }[] }}
 */
export async function isolationMatrix() {
  const pool = await getLabPool();
  await setupStock(pool);
  const levels = Object.keys(ISOLATION_LEVELS);
  const rows = [];
  for (const { key, label, fn } of ANOMALIES) {
    const cells = {};
    for (const level of levels) {
      await resetStock(pool);
      cells[level] = await fn(pool, level);
    }
    rows.push({ key, anomaly: label, cells });
  }
  await resetStock(pool);
  return { levels, rows };
}

// ------------------------------------------------------------------ double booking

const BOOKING_MODES = {
  'mssql-naive': 'SQL Server: đọc is_booked rồi ghi, không khoá',
  'mssql-locked': 'SQL Server: transaction + WITH (UPDLOCK, HOLDLOCK)',
  'mssql-unique': 'SQL Server: chỉ dựa vào UNIQUE index',
  'cassandra-naive': 'Cassandra: SELECT rồi INSERT',
  'cassandra-lwt': 'Cassandra: INSERT … IF NOT EXISTS (LWT)',
};

async function setupBookingTables(pool) {
  await pool.request().batch(`
    IF OBJECT_ID('dbo.lab_slots') IS NULL
      CREATE TABLE dbo.lab_slots (slot_id INT PRIMARY KEY, is_booked BIT NOT NULL);
    IF OBJECT_ID('dbo.lab_bookings') IS NULL
      CREATE TABLE dbo.lab_bookings (booking_id INT IDENTITY PRIMARY KEY, slot_id INT NOT NULL, patient_id INT NOT NULL);
    IF OBJECT_ID('dbo.lab_bookings_unique') IS NULL
      CREATE TABLE dbo.lab_bookings_unique (booking_id INT IDENTITY PRIMARY KEY, slot_id INT NOT NULL UNIQUE, patient_id INT NOT NULL);
    DELETE dbo.lab_slots; DELETE dbo.lab_bookings; DELETE dbo.lab_bookings_unique;
    INSERT dbo.lab_slots VALUES (1, 0);`);
}

const SLOT = 1;

const bookers = {
  async 'mssql-naive'(pool, patient) {
    const { recordset } = await run(pool, 'SELECT is_booked FROM dbo.lab_slots WHERE slot_id = @slot', {
      slot: SLOT,
    });
    if (recordset[0].is_booked) return false;
    await run(pool, 'INSERT dbo.lab_bookings (slot_id, patient_id) VALUES (@slot, @patient)', {
      slot: SLOT,
      patient,
    });
    await run(pool, 'UPDATE dbo.lab_slots SET is_booked = 1 WHERE slot_id = @slot', { slot: SLOT });
    return true;
  },
  async 'mssql-locked'(pool, patient) {
    const tx = await begin(pool, RC, -1);
    try {
      const { recordset } = await run(
        tx,
        'SELECT is_booked FROM dbo.lab_slots WITH (UPDLOCK, HOLDLOCK) WHERE slot_id = @slot',
        { slot: SLOT },
      );
      if (recordset[0].is_booked) {
        await tx.commit();
        return false;
      }
      await run(tx, 'INSERT dbo.lab_bookings (slot_id, patient_id) VALUES (@slot, @patient)', {
        slot: SLOT,
        patient,
      });
      await run(tx, 'UPDATE dbo.lab_slots SET is_booked = 1 WHERE slot_id = @slot', { slot: SLOT });
      await tx.commit();
      return true;
    } catch (err) {
      await safeRollback(tx);
      throw err;
    }
  },
  async 'mssql-unique'(pool, patient) {
    await run(pool, 'INSERT dbo.lab_bookings_unique (slot_id, patient_id) VALUES (@slot, @patient)', {
      slot: SLOT,
      patient,
    });
    return true;
  },
  async 'cassandra-naive'(client, patient) {
    const rs = await client.execute('SELECT patient_id FROM lab_slot_bookings WHERE slot_id = ?', [SLOT], {
      prepare: true,
    });
    if (rs.rowLength) return false;
    await client.execute(
      'INSERT INTO lab_slot_bookings (slot_id, patient_id, booked_at) VALUES (?, ?, toTimestamp(now()))',
      [SLOT, patient],
      { prepare: true },
    );
    return true;
  },
  async 'cassandra-lwt'(client, patient) {
    const rs = await client.execute(
      'INSERT INTO lab_slot_bookings (slot_id, patient_id, booked_at) VALUES (?, ?, toTimestamp(now())) IF NOT EXISTS',
      [SLOT, patient],
      { prepare: true },
    );
    return rs.wasApplied();
  },
};

/**
 * `requests` patients try to book the SAME slot at the same moment.
 * @returns {{ mode, description, requests, toldBooked, rowsStored, owner, errors, ms }}
 */
export async function doubleBooking(mode, requests = 50) {
  if (!bookers[mode]) throw new Error(`Unknown mode ${mode}`);
  const isCassandra = mode.startsWith('cassandra');
  const pool = await getLabPool();
  const client = getCassandra();
  let target = pool;
  if (isCassandra) {
    await client.execute(
      'CREATE TABLE IF NOT EXISTS lab_slot_bookings (slot_id int PRIMARY KEY, patient_id int, booked_at timestamp)',
    );
    await client.execute('TRUNCATE lab_slot_bookings');
    target = client;
  } else {
    await setupBookingTables(pool);
  }

  const errors = {};
  const start = performance.now();
  const outcomes = await Promise.all(
    Array.from({ length: requests }, (_, i) =>
      bookers[mode](target, 1000 + i).catch((err) => {
        const why = isCassandra ? err.message : describeSqlError(err);
        errors[why] = (errors[why] ?? 0) + 1;
        return false;
      }),
    ),
  );
  const ms = Math.round(performance.now() - start);

  let rowsStored;
  let owner;
  if (isCassandra) {
    const rs = await client.execute('SELECT patient_id FROM lab_slot_bookings WHERE slot_id = ?', [SLOT], {
      prepare: true,
    });
    rowsStored = rs.rowLength; // a primary key holds at most 1 row: later writes silently overwrite
    owner = rs.first()?.patient_id;
  } else {
    const table = mode === 'mssql-unique' ? 'dbo.lab_bookings_unique' : 'dbo.lab_bookings';
    const { recordset } = await run(pool, `SELECT patient_id FROM ${table} WHERE slot_id = @slot`, {
      slot: SLOT,
    });
    rowsStored = recordset.length;
    const ids = recordset.map((r) => r.patient_id);
    owner = ids.length > 3 ? `${ids.slice(0, 3).join(', ')}, … (${ids.length} bệnh nhân)` : ids.join(', ');
  }

  return {
    mode,
    description: BOOKING_MODES[mode],
    requests,
    toldBooked: outcomes.filter(Boolean).length,
    rowsStored,
    owner,
    errors,
    ms,
  };
}

export const bookingModes = Object.keys(BOOKING_MODES);

// ------------------------------------------------------------------ locks & deadlock

const LOCKS_SQL = `
  SELECT request_session_id AS spid, resource_type AS resource, request_mode AS mode,
         request_status AS status, COUNT(*) AS count
  FROM sys.dm_tran_locks
  WHERE resource_database_id = DB_ID() AND request_session_id IN (@s1, @s2)
  GROUP BY request_session_id, resource_type, request_mode, request_status
  ORDER BY request_session_id, resource_type`;

/**
 * T1 locks row 1 then wants row 2; T2 locks row 2 then wants row 1 → cycle.
 * SQL Server's deadlock monitor (runs every ~5s) kills one, the other completes; the victim retries.
 */
export async function deadlock() {
  const pool = await getLabPool();
  await setupStock(pool);
  await resetStock(pool);

  const t1 = await begin(pool, RC, -1);
  const t2 = await begin(pool, RC, -1);
  const spid = async (tx) => (await run(tx, 'SELECT @@SPID AS spid')).recordset[0].spid;
  const s1 = await spid(t1);
  const s2 = await spid(t2);
  const sessions = { [s1]: 'T1', [s2]: 'T2' };
  const snapshot = async () =>
    (await run(pool, LOCKS_SQL, { s1, s2 })).recordset.map((r) => ({ ...r, tx: sessions[r.spid] }));

  await run(t1, 'UPDATE dbo.lab_stock SET qty = qty - 1 WHERE id = 1 -- T1: thuốc 1');
  await run(t2, 'UPDATE dbo.lab_stock SET qty = qty - 1 WHERE id = 2 -- T2: thuốc 2');
  const locksHeld = await snapshot();

  const start = performance.now();
  const p1 = run(t1, 'UPDATE dbo.lab_stock SET qty = qty - 1 WHERE id = 2').then(
    () => null,
    (err) => err,
  );
  await sleep(300);
  const locksWaiting = await snapshot();
  const p2 = run(t2, 'UPDATE dbo.lab_stock SET qty = qty - 1 WHERE id = 1').then(
    () => null,
    (err) => err,
  );
  const [e1, e2] = await Promise.all([p1, p2]);
  const detectedAfterMs = Math.round(performance.now() - start);

  const victim = e1?.number === 1205 ? 'T1' : e2?.number === 1205 ? 'T2' : null;
  const winner = victim === 'T1' ? t2 : t1;
  await winner.commit();
  await safeRollback(victim === 'T1' ? t1 : t2);

  // the application retries the victim's whole transaction, now without contention
  const retry = await begin(pool, RC, -1);
  await run(retry, 'UPDATE dbo.lab_stock SET qty = qty - 1 WHERE id IN (1, 2)');
  await retry.commit();
  const { recordset: finalStock } = await run(
    pool,
    'SELECT id, name, qty FROM dbo.lab_stock WHERE id IN (1, 2)',
  );

  return {
    victim,
    message: (victim === 'T1' ? e1 : e2)?.message,
    detectedAfterMs,
    locksHeld,
    locksWaiting,
    finalStock, // each medicine dispensed twice: 100 → 98, 50 → 48
  };
}
