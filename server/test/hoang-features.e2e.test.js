// End-to-end API tests for Hoàng's features (FR3, FR4, FR6, FR9, access log, DB Lab iv-vi).
// Needs both databases up and initialised (npm run db:up && npm run db:init). Creates real rows
// (appointments, visits, vitals); run `npm run db:init` to reset.
// Run: npm run test:e2e -w server
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { app } from '../src/app.js';
import { closeCassandra } from '../src/db/cassandra.js';
import { closeMssql } from '../src/db/mssql.js';
import { closeLabPool } from '../src/modules/lab/lab.db.js';
import { clinicDate } from '../src/utils/clinic-time.js';

let server;
let base;
const tokens = {};

async function call(method, path, { as = 'admin', body, headers = {} } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[as]}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** First future day where doctor 1 still has at least `n` free slots. */
async function freeSlots(n) {
  for (let offset = 1; offset <= 13; offset++) {
    const date = clinicDate(new Date(Date.now() + offset * 86_400_000));
    const { body } = await call('GET', `/slots?doctorId=1&date=${date}`);
    const free = body.filter((s) => !s.isBooked);
    if (free.length >= n) return { date, slots: free.slice(0, n) };
  }
  throw new Error('no free slots left: run npm run db:init');
}

const stock = async (id) => (await call('GET', '/medicines')).body.find((m) => m.id === id).stock;

before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
  for (const [as, password] of [
    ['admin', 'admin123'],
    ['reception', 'reception123'],
    ['doctor1', 'doctor123'],
  ]) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: as, password }),
    });
    tokens[as] = (await res.json()).token;
  }
});

after(async () => {
  await call('DELETE', '/vitals/simulator');
  server.close();
  await Promise.allSettled([closeMssql(), closeCassandra(), closeLabPool()]);
});

describe('FR3 appointments', () => {
  test('book, reject double booking, list, cancel, delete', async () => {
    const { date, slots } = await freeSlots(1);
    const slotId = slots[0].id;

    const booked = await call('POST', '/appointments', { as: 'reception', body: { patientId: 3, slotId, reason: 'Sốt' } });
    assert.equal(booked.status, 201);
    assert.equal(booked.body.status, 'SCHEDULED');
    assert.equal(booked.body.date, date);

    const again = await call('POST', '/appointments', { as: 'reception', body: { patientId: 4, slotId } });
    assert.equal(again.status, 409);

    const listed = await call('GET', `/appointments?date=${date}&doctorId=1&status=SCHEDULED`);
    assert.ok(listed.body.items.some((a) => a.id === booked.body.id));

    const deleteScheduled = await call('DELETE', `/appointments/${booked.body.id}`);
    assert.equal(deleteScheduled.status, 409);

    const cancelled = await call('PATCH', `/appointments/${booked.body.id}/cancel`, { as: 'reception' });
    assert.equal(cancelled.body.status, 'CANCELLED');
    const slotAfter = (await call('GET', `/slots?doctorId=1&date=${date}`)).body.find((s) => s.id === slotId);
    assert.equal(slotAfter.isBooked, false);

    assert.equal((await call('DELETE', `/appointments/${booked.body.id}`)).status, 204);
  });

  test('20 concurrent bookings of one slot → exactly one succeeds', async () => {
    const { slots } = await freeSlots(1);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        call('POST', '/appointments', { as: 'reception', body: { patientId: (i % 10) + 1, slotId: slots[0].id } }),
      ),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 19);
  });

  test('doctors cannot book; validation errors are 400', async () => {
    assert.equal((await call('POST', '/appointments', { as: 'doctor1', body: { patientId: 1, slotId: 1 } })).status, 403);
    const bad = await call('POST', '/appointments', { as: 'reception', body: { patientId: 'x' } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.details.length >= 1);
  });

  test('past slots cannot be booked', async () => {
    const yesterday = clinicDate(new Date(Date.now() - 86_400_000));
    const slot = (await call('GET', `/slots?doctorId=1&date=${yesterday}`)).body.find((s) => !s.isBooked);
    const res = await call('POST', '/appointments', { as: 'reception', body: { patientId: 1, slotId: slot.id } });
    assert.equal(res.status, 400);
  });
});

describe('FR4 + FR6 visits', () => {
  test('visit from appointment: one transaction writes visit, prescription, stock, invoice', async () => {
    const { slots } = await freeSlots(1);
    const appt = await call('POST', '/appointments', { as: 'reception', body: { patientId: 3, slotId: slots[0].id } });
    const [paracetamolBefore, cetirizineBefore] = [await stock(1), await stock(8)];

    const visit = await call('POST', '/visits', {
      as: 'doctor1',
      body: {
        appointmentId: appt.body.id,
        patientId: 3,
        symptoms: 'Sốt 38.5°C, ho',
        diagnosis: 'Viêm họng cấp',
        items: [
          { medicineId: 1, quantity: 10, dosage: 'Sáng 1 viên, tối 1 viên' },
          { medicineId: 8, quantity: 5, dosage: 'Tối 1 viên' },
        ],
      },
    });
    assert.equal(visit.status, 201);
    assert.equal(visit.body.prescription.items.length, 2);
    assert.equal(visit.body.invoice.totalAmount, 200000 + 10 * 1500 + 5 * 1800);
    assert.equal(visit.body.appointment.id, appt.body.id);
    assert.equal(await stock(1), paracetamolBefore - 10);
    assert.equal(await stock(8), cetirizineBefore - 5);
    assert.equal((await call('GET', `/appointments/${appt.body.id}`)).body.status, 'COMPLETED');

    // FR6 detail (10-table join) and payment
    const detail = await call('GET', `/visits/${visit.body.id}`);
    assert.equal(detail.body.patient.id, 3);
    assert.equal(detail.body.department.name, 'Nội tổng quát');
    const paid = await call('PATCH', `/invoices/${detail.body.invoice.id}/pay`, { as: 'reception' });
    assert.equal(paid.body.invoice.status, 'PAID');
    assert.equal((await call('PATCH', `/invoices/${detail.body.invoice.id}/pay`, { as: 'reception' })).status, 409);
  });

  test('out of stock → 409 and NOTHING is written (atomicity)', async () => {
    const paracetamolBefore = await stock(1);
    const visitsBefore = (await call('GET', '/visits?pageSize=1')).body.total;
    const res = await call('POST', '/visits', {
      as: 'doctor1',
      body: {
        patientId: 5,
        diagnosis: 'Hen phế quản',
        items: [
          { medicineId: 1, quantity: 3, dosage: 'Khi sốt' },
          { medicineId: 9, quantity: 1000, dosage: 'Xịt khi khó thở' },
        ],
      },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /Salbutamol/);
    assert.equal(await stock(1), paracetamolBefore);
    assert.equal((await call('GET', '/visits?pageSize=1')).body.total, visitsBefore);
  });

  test('doctors only see their own visits', async () => {
    const { body } = await call('GET', '/visits?pageSize=100', { as: 'doctor1' });
    assert.ok(body.items.every((v) => v.doctorId === 1));
  });
});

describe('FR9 vitals (Cassandra)', () => {
  test('record, alerts, history, latest', async () => {
    const normal = await call('POST', '/vitals', {
      as: 'doctor1',
      body: { patientId: 3, heartRate: 78, systolicBp: 120, diastolicBp: 80, spo2: 98, temperature: 36.8 },
    });
    assert.equal(normal.status, 201);
    assert.deepEqual(normal.body.alerts, []);

    const abnormal = await call('POST', '/vitals', {
      as: 'doctor1',
      body: { patientId: 3, heartRate: 135, systolicBp: 120, diastolicBp: 80, spo2: 88, temperature: 36.8 },
    });
    assert.deepEqual(abnormal.body.alerts.map((a) => a.type).sort(), ['HEART_RATE', 'SPO2']);

    const history = await call('GET', '/vitals/3');
    assert.ok(history.body.length >= 2);
    assert.ok(history.body[0].recordedAt >= history.body[1].recordedAt, 'newest first');
    const latest = await call('GET', '/vitals/latest?patientIds=3');
    assert.equal(latest.body[0].spo2, 88);
    const alerts = await call('GET', '/vitals/alerts');
    assert.ok(alerts.body.some((a) => a.patientId === 3 && a.type === 'SPO2'));
  });

  test('SSE stream pushes new readings', async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/api/vitals/4/stream?token=${tokens.doctor1}`, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    const reader = res.body.getReader();
    await call('POST', '/vitals', {
      as: 'doctor1',
      body: { patientId: 4, heartRate: 70, systolicBp: 118, diastolicBp: 76, spo2: 99, temperature: 36.6 },
    });
    const { value } = await reader.read();
    const event = JSON.parse(new TextDecoder().decode(value).replace(/^data: /, ''));
    assert.equal(event.patientId, 4);
    controller.abort();
  });

  test('device simulator writes readings', async () => {
    const started = await call('POST', '/vitals/simulator', {
      as: 'doctor1',
      body: { patientIds: [1, 2], intervalMs: 200, durationSec: 10 },
    });
    assert.equal(started.body.running, true);
    await new Promise((r) => setTimeout(r, 1500));
    const stopped = await call('DELETE', '/vitals/simulator', { as: 'doctor1' });
    assert.ok(stopped.body.written > 0);
  });
});

describe('access log (Cassandra)', () => {
  test('every API call of a user is logged, tokens are masked', async () => {
    await new Promise((r) => setTimeout(r, 300)); // logging is fire-and-forget
    const { body } = await call('GET', '/access-logs?userId=3');
    assert.ok(body.length > 0);
    assert.ok(body.every((l) => !l.path.includes(tokens.doctor1)));
    assert.equal((await call('GET', '/access-logs?userId=3', { as: 'reception' })).status, 403);
  });
});

describe('DB Lab iv-vi', () => {
  test('transaction: SQL Server rolls back, Cassandra leaves partial data', async () => {
    const mssql = await call('POST', '/lab/transaction', { body: { dbms: 'mssql', failAt: 4 } });
    assert.match(mssql.body.verdict, /ROLLBACK/);
    assert.deepEqual(mssql.body.before, mssql.body.after);
    const cass = await call('POST', '/lab/transaction', { body: { dbms: 'cassandra', failAt: 3 } });
    assert.match(cass.body.verdict, /DỞ DANG/);
  });

  test('double booking: UPDLOCK lets exactly one through, LWT too', async () => {
    const locked = await call('POST', '/lab/concurrency/double-booking', { body: { mode: 'mssql-locked', requests: 30 } });
    assert.equal(locked.body.toldBooked, 1);
    const lwt = await call('POST', '/lab/concurrency/double-booking', { body: { mode: 'cassandra-lwt', requests: 30 } });
    assert.equal(lwt.body.toldBooked, 1);
  });

  test('backups list works and lab is admin-only', async () => {
    assert.ok(Array.isArray((await call('GET', '/lab/backups')).body));
    assert.equal((await call('GET', '/lab/backups', { as: 'doctor1' })).status, 403);
  });
});
