// Topic iv (Transaction) experiment: the 5-step "khám bệnh" workflow with a failure injected at step N,
// on SQL Server (one transaction) vs Cassandra (sequential writes or one logged batch).
import { getCassandra } from '../../db/cassandra.js';
import { getLabPool, run, safeRollback, sql } from './lab.db.js';

const STEPS = [
  'INSERT visits',
  'INSERT prescriptions',
  'INSERT prescription_items',
  'UPDATE medicines (trừ tồn kho)',
  'INSERT invoices',
];
const PATIENT = 7;
const DOCTOR = 1;
const MEDICINE = 1;
const QTY = 10;

const counts = async (pool) =>
  (
    await run(
      pool,
      `SELECT (SELECT COUNT(*) FROM dbo.visits) AS visits, (SELECT COUNT(*) FROM dbo.prescriptions) AS prescriptions,
              (SELECT COUNT(*) FROM dbo.prescription_items) AS items, (SELECT COUNT(*) FROM dbo.invoices) AS invoices,
              (SELECT stock_quantity FROM dbo.medicines WHERE medicine_id = ${MEDICINE}) AS stock`,
    )
  ).recordset[0];

async function mssqlWorkflow(failAt) {
  const pool = await getLabPool();
  const before = await counts(pool);
  const steps = STEPS.map((label, i) => ({ n: i + 1, label, status: 'chưa chạy' }));
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  const ids = {};
  let committed = false;
  let error;

  const statements = [
    async () => {
      const r = await run(
        tx,
        `INSERT dbo.visits (patient_id, doctor_id, symptoms, diagnosis) OUTPUT INSERTED.visit_id AS id
         VALUES (@p, @d, N'DB Lab', N'Demo transaction')`,
        { p: PATIENT, d: DOCTOR },
      );
      ids.visit = r.recordset[0].id;
    },
    async () => {
      const r = await run(
        tx,
        'INSERT dbo.prescriptions (visit_id) OUTPUT INSERTED.prescription_id AS id VALUES (@v)',
        { v: ids.visit },
      );
      ids.rx = r.recordset[0].id;
    },
    () =>
      run(tx, "INSERT dbo.prescription_items VALUES (@rx, @m, @q, N'DB Lab', 1500)", {
        rx: ids.rx,
        m: MEDICINE,
        q: QTY,
      }),
    // the real failure mode of step 4: asking for more than in stock violates CK_medicines_stock
    () =>
      run(tx, 'UPDATE dbo.medicines SET stock_quantity = stock_quantity - @q WHERE medicine_id = @m', {
        q: failAt === 4 ? 1_000_000 : QTY,
        m: MEDICINE,
      }),
    () =>
      run(tx, 'INSERT dbo.invoices (visit_id, consultation_fee, medicine_total) VALUES (@v, 200000, 15000)', {
        v: ids.visit,
      }),
  ];

  for (let i = 0; i < statements.length; i++) {
    const step = steps[i];
    const start = performance.now();
    try {
      if (failAt === i + 1 && failAt !== 4)
        throw new Error(`Lỗi giả lập tại bước ${failAt} (ví dụ: mất kết nối)`);
      await statements[i]();
      step.status = 'ok';
    } catch (err) {
      step.status = 'lỗi';
      step.error = err.message;
      error = err;
      break;
    } finally {
      step.ms = Math.round(performance.now() - start);
    }
  }

  if (error) {
    await safeRollback(tx);
    for (const s of steps) if (s.status === 'ok') s.status = 'đã rollback';
  } else {
    await tx.commit();
    committed = true;
  }
  const after = await counts(pool);

  // keep the lab repeatable: undo a successful demo commit
  if (committed) {
    await run(
      pool,
      `DELETE dbo.invoices WHERE visit_id = @v; DELETE dbo.prescriptions WHERE visit_id = @v;
       DELETE dbo.visits WHERE visit_id = @v;
       UPDATE dbo.medicines SET stock_quantity = stock_quantity + @q WHERE medicine_id = @m;`,
      { v: ids.visit, q: QTY, m: MEDICINE },
    );
  }

  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  return {
    dbms: 'SQL Server',
    mode: 'transaction',
    failAt,
    steps,
    before,
    after,
    committed,
    verdict: committed
      ? 'COMMIT: cả 5 bước được ghi (demo đã tự dọn sau khi đo)'
      : unchanged
        ? 'ROLLBACK: dữ liệu trước/sau giống hệt nhau (atomicity)'
        : 'CẢNH BÁO: dữ liệu thay đổi dù transaction lỗi',
  };
}

async function cassandraWorkflow(failAt, useBatch) {
  const client = getCassandra();
  await client.execute(
    'CREATE TABLE IF NOT EXISTS lab_visits_by_patient (patient_id int, visit_id int, diagnosis text, PRIMARY KEY (patient_id, visit_id))',
  );
  await client.execute(
    'CREATE TABLE IF NOT EXISTS lab_prescription_items (visit_id int, medicine_id int, quantity int, PRIMARY KEY (visit_id, medicine_id))',
  );
  await client.execute('CREATE TABLE IF NOT EXISTS lab_stock (medicine_id int PRIMARY KEY, stock int)');
  await client.execute(
    'CREATE TABLE IF NOT EXISTS lab_invoices_by_visit (visit_id int PRIMARY KEY, total int)',
  );
  for (const t of ['lab_visits_by_patient', 'lab_prescription_items', 'lab_stock', 'lab_invoices_by_visit']) {
    await client.execute(`TRUNCATE ${t}`);
  }
  await client.execute('INSERT INTO lab_stock (medicine_id, stock) VALUES (1, 5000)');

  const VISIT = 1;
  const statements = [
    {
      query: 'INSERT INTO lab_visits_by_patient (patient_id, visit_id, diagnosis) VALUES (?, ?, ?)',
      params: [PATIENT, VISIT, 'Demo'],
    },
    null, // no separate prescription header table in the denormalized model
    {
      query: 'INSERT INTO lab_prescription_items (visit_id, medicine_id, quantity) VALUES (?, ?, ?)',
      params: [VISIT, 1, QTY],
    },
    { query: 'UPDATE lab_stock SET stock = ? WHERE medicine_id = ?', params: [5000 - QTY, 1] }, // app read 5000 first
    { query: 'INSERT INTO lab_invoices_by_visit (visit_id, total) VALUES (?, ?)', params: [VISIT, 215000] },
  ];
  const steps = STEPS.map((label, i) => ({
    n: i + 1,
    label: statements[i] ? label : `${label} (gộp vào bảng phi chuẩn hoá)`,
    status: 'chưa chạy',
  }));

  if (useBatch) {
    const start = performance.now();
    if (failAt) {
      // the app fails BEFORE sending APPLY BATCH: nothing reaches the cluster
      steps.forEach((s, i) => (s.status = i + 1 < failAt ? 'đã chuẩn bị' : s.status));
      steps[failAt - 1].status = 'lỗi';
      steps[failAt - 1].error = `Lỗi giả lập tại bước ${failAt}, batch không được gửi`;
    } else {
      await client.batch(statements.filter(Boolean), { prepare: true, logged: true });
      steps.forEach((s) => (s.status = 'ok'));
    }
    steps[0].ms = Math.round(performance.now() - start);
  } else {
    for (let i = 0; i < statements.length; i++) {
      const step = steps[i];
      if (failAt === i + 1) {
        step.status = 'lỗi';
        step.error = `Lỗi giả lập tại bước ${failAt}, ứng dụng dừng`;
        break;
      }
      const start = performance.now();
      if (statements[i]) await client.execute(statements[i].query, statements[i].params, { prepare: true });
      step.status = 'ok (đã ghi vĩnh viễn)';
      step.ms = Math.round(performance.now() - start);
    }
  }

  const rows = async (table) =>
    (await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).first().n.toNumber();
  const after = {
    visits: await rows('lab_visits_by_patient'),
    items: await rows('lab_prescription_items'),
    invoices: await rows('lab_invoices_by_visit'),
    stock: (await client.execute('SELECT stock FROM lab_stock WHERE medicine_id = 1')).first().stock,
  };
  const partial = after.visits !== after.invoices || after.items !== after.invoices;
  return {
    dbms: 'Cassandra',
    mode: useBatch ? 'logged batch' : 'từng câu lệnh',
    failAt,
    steps,
    before: { visits: 0, items: 0, invoices: 0, stock: 5000 },
    after,
    committed: !failAt,
    verdict: partial
      ? 'DỮ LIỆU DỞ DANG: các bước trước lỗi đã ghi, không có ROLLBACK'
      : failAt
        ? 'Không có gì được ghi (lỗi xảy ra trước khi gửi batch)'
        : 'Cả batch được áp dụng (atomic, nhưng không có isolation)',
  };
}

/** @param {{ dbms: 'mssql'|'cassandra', failAt?: 1|2|3|4|5|null, useBatch?: boolean }} options */
export function visitWorkflow({ dbms, failAt = null, useBatch = false }) {
  return dbms === 'cassandra' ? cassandraWorkflow(failAt, useBatch) : mssqlWorkflow(failAt);
}
