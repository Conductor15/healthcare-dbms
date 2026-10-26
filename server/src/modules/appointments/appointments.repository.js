import { getPool, sql } from '../../db/mssql.js';

const SELECT = `
  SELECT a.appointment_id AS id, a.status, a.reason, a.created_at AS createdAt,
         CONVERT(CHAR(10), s.slot_date, 23) AS date,
         CONVERT(CHAR(5), s.start_time, 108) AS startTime, CONVERT(CHAR(5), s.end_time, 108) AS endTime,
         a.slot_id AS slotId, p.patient_id AS patientId, p.full_name AS patientName, p.phone AS patientPhone,
         d.doctor_id AS doctorId, d.full_name AS doctorName, dep.name AS departmentName,
         v.visit_id AS visitId
  FROM dbo.appointments a
  JOIN dbo.time_slots s    ON s.slot_id = a.slot_id
  JOIN dbo.patients p      ON p.patient_id = a.patient_id
  JOIN dbo.doctors d       ON d.doctor_id = s.doctor_id
  JOIN dbo.departments dep ON dep.department_id = d.department_id
  LEFT JOIN dbo.visits v   ON v.appointment_id = a.appointment_id`;

/** Slots of one doctor on one day, with booking state (query type e: doctor AND date). */
export async function findSlots({ doctorId, date }) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input('doctorId', sql.Int, doctorId)
    .input('date', sql.Date, date).query(`
      SELECT slot_id AS id, CONVERT(CHAR(5), start_time, 108) AS startTime,
             CONVERT(CHAR(5), end_time, 108) AS endTime, is_booked AS isBooked
      FROM dbo.time_slots
      WHERE doctor_id = @doctorId AND slot_date = @date
      ORDER BY start_time`);
  return recordset;
}

/** Filtered, paginated list (query types e + f: composite filter over a 6-table join). */
export async function findAll({ date, from, to, doctorId, patientId, status, page, pageSize }) {
  const pool = await getPool();
  const request = pool.request();
  const where = [];
  if (date) {
    request.input('date', sql.Date, date);
    where.push('s.slot_date = @date');
  }
  if (from) {
    request.input('from', sql.Date, from);
    where.push('s.slot_date >= @from');
  }
  if (to) {
    request.input('to', sql.Date, to);
    where.push('s.slot_date <= @to');
  }
  if (doctorId) {
    request.input('doctorId', sql.Int, doctorId);
    where.push('s.doctor_id = @doctorId');
  }
  if (patientId) {
    request.input('patientId', sql.Int, patientId);
    where.push('a.patient_id = @patientId');
  }
  if (status) {
    request.input('status', sql.VarChar(20), status);
    where.push('a.status = @status');
  }
  request.input('offset', sql.Int, (page - 1) * pageSize).input('pageSize', sql.Int, pageSize);
  const { recordset } = await request.query(`
    WITH filtered AS (${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''})
    SELECT *, COUNT(*) OVER () AS total FROM filtered
    ORDER BY date DESC, startTime
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  const total = recordset[0]?.total ?? 0;
  return { items: recordset.map(({ total: _, ...row }) => row), total, page, pageSize };
}

export async function findById(id, tx) {
  const request = tx ? tx.request() : (await getPool()).request();
  const { recordset } = await request
    .input('id', sql.Int, id)
    .query(`${SELECT} WHERE a.appointment_id = @id`);
  return recordset[0];
}

// ---- inside a transaction (tx) ----------------------------------------------------------

/**
 * Reads the slot with UPDLOCK + HOLDLOCK: concurrent bookings of the same slot queue up here
 * instead of all seeing "free" (see demos/05-concurrency, mode mssql-locked).
 */
export async function lockSlot(tx, slotId) {
  const { recordset } = await tx.request().input('slotId', sql.Int, slotId).query(`
      SELECT s.slot_id AS id, s.doctor_id AS doctorId, s.is_booked AS isBooked,
             CONVERT(CHAR(10), s.slot_date, 23) AS date, CONVERT(CHAR(5), s.start_time, 108) AS startTime,
             d.is_active AS doctorActive
      FROM dbo.time_slots s WITH (UPDLOCK, HOLDLOCK)
      JOIN dbo.doctors d ON d.doctor_id = s.doctor_id
      WHERE s.slot_id = @slotId`);
  return recordset[0];
}

export async function patientExists(tx, patientId) {
  const { recordset } = await tx
    .request()
    .input('patientId', sql.Int, patientId)
    .query('SELECT 1 AS ok FROM dbo.patients WHERE patient_id = @patientId');
  return recordset.length > 0;
}

/** Another active appointment of the same patient at the same date + time (any doctor)? */
export async function patientBusyAt(tx, { patientId, date, startTime }) {
  const { recordset } = await tx
    .request()
    .input('patientId', sql.Int, patientId)
    .input('date', sql.Date, date)
    .input('startTime', sql.VarChar(5), startTime).query(`
      SELECT TOP (1) a.appointment_id AS id
      FROM dbo.appointments a JOIN dbo.time_slots s ON s.slot_id = a.slot_id
      WHERE a.patient_id = @patientId AND a.status = 'SCHEDULED'
        AND s.slot_date = @date AND s.start_time = CAST(@startTime AS TIME(0))`);
  return recordset[0];
}

export async function insert(tx, { patientId, slotId, reason, createdBy }) {
  const { recordset } = await tx
    .request()
    .input('patientId', sql.Int, patientId)
    .input('slotId', sql.Int, slotId)
    .input('reason', sql.NVarChar(255), reason)
    .input('createdBy', sql.Int, createdBy).query(`
      INSERT INTO dbo.appointments (patient_id, slot_id, reason, created_by)
      OUTPUT INSERTED.appointment_id AS id
      VALUES (@patientId, @slotId, @reason, @createdBy);
      UPDATE dbo.time_slots SET is_booked = 1 WHERE slot_id = @slotId;`);
  return recordset[0].id;
}

export async function lockAppointment(tx, id) {
  const { recordset } = await tx.request().input('id', sql.Int, id)
    .query(`SELECT appointment_id AS id, slot_id AS slotId, status
            FROM dbo.appointments WITH (UPDLOCK) WHERE appointment_id = @id`);
  return recordset[0];
}

export async function cancel(tx, { id, slotId }) {
  await tx.request().input('id', sql.Int, id).input('slotId', sql.Int, slotId).query(`
      UPDATE dbo.appointments SET status = 'CANCELLED', updated_at = SYSUTCDATETIME() WHERE appointment_id = @id;
      UPDATE dbo.time_slots SET is_booked = 0 WHERE slot_id = @slotId;`);
}

/** Only cancelled appointments can be deleted. @returns rows deleted */
export async function removeCancelled(id) {
  const pool = await getPool();
  const { rowsAffected } = await pool
    .request()
    .input('id', sql.Int, id)
    .query("DELETE FROM dbo.appointments WHERE appointment_id = @id AND status = 'CANCELLED'");
  return rowsAffected[0];
}
