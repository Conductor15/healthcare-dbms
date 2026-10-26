import { getPool, sql } from '../../db/mssql.js';

/** Paginated visit list with patient, doctor, department and invoice (query types e + f). */
export async function findAll({ patientId, doctorId, from, to, page, pageSize }) {
  const pool = await getPool();
  const request = pool.request();
  const where = [];
  if (patientId) {
    request.input('patientId', sql.Int, patientId);
    where.push('v.patient_id = @patientId');
  }
  if (doctorId) {
    request.input('doctorId', sql.Int, doctorId);
    where.push('v.doctor_id = @doctorId');
  }
  if (from) {
    request.input('from', sql.Date, from);
    where.push('v.visit_date >= @from');
  }
  if (to) {
    request.input('to', sql.Date, to);
    where.push('v.visit_date < DATEADD(DAY, 1, @to)');
  }
  request.input('offset', sql.Int, (page - 1) * pageSize).input('pageSize', sql.Int, pageSize);
  const { recordset } = await request.query(`
    SELECT v.visit_id AS id, v.visit_date AS visitDate, v.diagnosis,
           p.patient_id AS patientId, p.full_name AS patientName,
           d.doctor_id AS doctorId, d.full_name AS doctorName, dep.name AS departmentName,
           i.invoice_id AS invoiceId, i.total_amount AS totalAmount, i.status AS invoiceStatus,
           COUNT(*) OVER () AS total
    FROM dbo.visits v
    JOIN dbo.patients p      ON p.patient_id = v.patient_id
    JOIN dbo.doctors d       ON d.doctor_id = v.doctor_id
    JOIN dbo.departments dep ON dep.department_id = d.department_id
    LEFT JOIN dbo.invoices i ON i.visit_id = v.visit_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY v.visit_date DESC, v.visit_id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  const total = recordset[0]?.total ?? 0;
  return { items: recordset.map(({ total: _, ...row }) => row), total, page, pageSize };
}

/**
 * FR6 (query type f): everything about one visit in ONE statement joining 10 tables.
 * Returns one row per prescribed medicine (or one row if none); the service nests them.
 */
export async function findDetailRows(id) {
  const pool = await getPool();
  const { recordset } = await pool.request().input('id', sql.Int, id).query(`
      SELECT v.visit_id, v.visit_date, v.symptoms, v.diagnosis, v.notes,
             p.patient_id, p.full_name AS patient_name, p.date_of_birth, p.gender, p.phone AS patient_phone,
             p.blood_type, p.medical_history,
             d.doctor_id, d.full_name AS doctor_name, d.specialization,
             dep.department_id, dep.name AS department_name, dep.location AS department_location,
             a.appointment_id, a.reason AS appointment_reason,
             CONVERT(CHAR(10), s.slot_date, 23) AS slot_date, CONVERT(CHAR(5), s.start_time, 108) AS slot_time,
             rx.prescription_id, rx.notes AS prescription_notes,
             pi.medicine_id, m.name AS medicine_name, m.unit, pi.quantity, pi.dosage, pi.unit_price,
             i.invoice_id, i.consultation_fee, i.medicine_total, i.total_amount, i.status AS invoice_status,
             i.issued_at, i.paid_at
      FROM dbo.visits v
      JOIN dbo.patients p                 ON p.patient_id = v.patient_id
      JOIN dbo.doctors d                  ON d.doctor_id = v.doctor_id
      JOIN dbo.departments dep            ON dep.department_id = d.department_id
      LEFT JOIN dbo.appointments a        ON a.appointment_id = v.appointment_id
      LEFT JOIN dbo.time_slots s          ON s.slot_id = a.slot_id
      LEFT JOIN dbo.prescriptions rx      ON rx.visit_id = v.visit_id
      LEFT JOIN dbo.prescription_items pi ON pi.prescription_id = rx.prescription_id
      LEFT JOIN dbo.medicines m           ON m.medicine_id = pi.medicine_id
      LEFT JOIN dbo.invoices i            ON i.visit_id = v.visit_id
      WHERE v.visit_id = @id
      ORDER BY m.name`);
  return recordset;
}

// ---- inside a transaction (tx) ----------------------------------------------------------

export async function lockAppointment(tx, id) {
  const { recordset } = await tx.request().input('id', sql.Int, id).query(`
      SELECT a.appointment_id AS id, a.patient_id AS patientId, a.status, s.doctor_id AS doctorId
      FROM dbo.appointments a WITH (UPDLOCK) JOIN dbo.time_slots s ON s.slot_id = a.slot_id
      WHERE a.appointment_id = @id`);
  return recordset[0];
}

export async function doctorFee(tx, doctorId) {
  const { recordset } = await tx
    .request()
    .input('doctorId', sql.Int, doctorId)
    .query(
      'SELECT consultation_fee AS fee, is_active AS active FROM dbo.doctors WHERE doctor_id = @doctorId',
    );
  return recordset[0];
}

export async function insertVisit(tx, v) {
  const { recordset } = await tx
    .request()
    .input('appointmentId', sql.Int, v.appointmentId ?? null)
    .input('patientId', sql.Int, v.patientId)
    .input('doctorId', sql.Int, v.doctorId)
    .input('symptoms', sql.NVarChar(500), v.symptoms)
    .input('diagnosis', sql.NVarChar(500), v.diagnosis)
    .input('notes', sql.NVarChar(sql.MAX), v.notes).query(`
      INSERT INTO dbo.visits (appointment_id, patient_id, doctor_id, symptoms, diagnosis, notes)
      OUTPUT INSERTED.visit_id AS id
      VALUES (@appointmentId, @patientId, @doctorId, @symptoms, @diagnosis, @notes)`);
  return recordset[0].id;
}

export async function insertPrescription(tx, visitId, notes) {
  const { recordset } = await tx
    .request()
    .input('visitId', sql.Int, visitId)
    .input('notes', sql.NVarChar(500), notes)
    .query(`INSERT INTO dbo.prescriptions (visit_id, notes) OUTPUT INSERTED.prescription_id AS id
            VALUES (@visitId, @notes)`);
  return recordset[0].id;
}

/**
 * Atomic "dispense if enough stock": the check and the decrement are ONE statement, so two doctors
 * prescribing the last boxes at the same time cannot both succeed (no lost update, topic v).
 * @returns {{ name, unitPrice } | undefined} undefined = not enough stock (or unknown medicine)
 */
export async function dispense(tx, medicineId, quantity) {
  const { recordset } = await tx.request().input('id', sql.Int, medicineId).input('qty', sql.Int, quantity)
    .query(`
      UPDATE dbo.medicines SET stock_quantity = stock_quantity - @qty
      OUTPUT INSERTED.name, INSERTED.unit_price AS unitPrice
      WHERE medicine_id = @id AND stock_quantity >= @qty`);
  return recordset[0];
}

export async function medicineStock(tx, medicineId) {
  const { recordset } = await tx
    .request()
    .input('id', sql.Int, medicineId)
    .query('SELECT name, stock_quantity AS stock FROM dbo.medicines WHERE medicine_id = @id');
  return recordset[0];
}

export async function insertItem(tx, item) {
  await tx
    .request()
    .input('rx', sql.Int, item.prescriptionId)
    .input('medicineId', sql.Int, item.medicineId)
    .input('quantity', sql.Int, item.quantity)
    .input('dosage', sql.NVarChar(200), item.dosage)
    .input('unitPrice', sql.Decimal(12, 2), item.unitPrice)
    .query(`INSERT INTO dbo.prescription_items (prescription_id, medicine_id, quantity, dosage, unit_price)
            VALUES (@rx, @medicineId, @quantity, @dosage, @unitPrice)`);
}

export async function insertInvoice(tx, { visitId, consultationFee, medicineTotal }) {
  await tx
    .request()
    .input('visitId', sql.Int, visitId)
    .input('fee', sql.Decimal(12, 2), consultationFee)
    .input('medicineTotal', sql.Decimal(12, 2), medicineTotal)
    .query(`INSERT INTO dbo.invoices (visit_id, consultation_fee, medicine_total)
            VALUES (@visitId, @fee, @medicineTotal)`);
}

export async function completeAppointment(tx, id) {
  await tx
    .request()
    .input('id', sql.Int, id)
    .query(
      "UPDATE dbo.appointments SET status = 'COMPLETED', updated_at = SYSUTCDATETIME() WHERE appointment_id = @id",
    );
}

/** @returns rows updated (0 = not found or not UNPAID) */
export async function payInvoice(id) {
  const pool = await getPool();
  const { rowsAffected } = await pool.request().input('id', sql.Int, id)
    .query(`UPDATE dbo.invoices SET status = 'PAID', paid_at = SYSUTCDATETIME()
            WHERE invoice_id = @id AND status = 'UNPAID'`);
  return rowsAffected[0];
}

export async function invoiceVisitId(id) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT visit_id AS visitId, status FROM dbo.invoices WHERE invoice_id = @id');
  return recordset[0];
}
