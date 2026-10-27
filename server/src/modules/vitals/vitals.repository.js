// Cassandra side of FR9. One table per query (see docs/design/erd.md, Q1-Q3); always prepared statements.
import { getCassandra, types } from '../../db/cassandra.js';
import { clinicDate } from '../../utils/clinic-time.js';

const { LocalDate, Long } = types;
const COLUMNS =
  'patient_id, recorded_at, heart_rate, systolic_bp, diastolic_bp, spo2, temperature, device_id';

const toReading = (row) => ({
  patientId: row.patient_id,
  recordedAt: row.recorded_at,
  heartRate: row.heart_rate,
  systolicBp: row.systolic_bp,
  diastolicBp: row.diastolic_bp,
  spo2: row.spo2,
  temperature: row.temperature === null ? null : Math.round(row.temperature * 10) / 10,
  deviceId: row.device_id,
});

/**
 * One reading → Q1 (history) + Q2 (latest) + Q3 (alerts) in a LOGGED batch: all-or-nothing across the
 * denormalized tables, no isolation needed (topic iv). Q2 is written USING TIMESTAMP = measurement time,
 * so a late-arriving older reading can never overwrite a newer one (last-write-wins, topic v).
 */
export async function save(r, alerts) {
  const day = LocalDate.fromString(clinicDate(r.recordedAt));
  const values = [
    r.patientId,
    r.recordedAt,
    r.heartRate,
    r.systolicBp,
    r.diastolicBp,
    r.spo2,
    r.temperature,
    r.deviceId,
  ];
  const queries = [
    {
      query: `INSERT INTO vital_signs_by_patient_day (day, ${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [day, ...values],
    },
    {
      query: `INSERT INTO latest_vitals_by_patient (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?) USING TIMESTAMP ?`,
      params: [...values, Long.fromNumber(r.recordedAt.getTime() * 1000)],
    },
    ...alerts.map((a) => ({
      query:
        'INSERT INTO vital_alerts_by_day (day, recorded_at, patient_id, alert_type, detail) VALUES (?, ?, ?, ?, ?)',
      params: [day, r.recordedAt, r.patientId, a.type, a.detail],
    })),
  ];
  await getCassandra().batch(queries, { prepare: true, logged: true });
}

/** Q1: readings of one patient on one day, newest first. */
export async function findByDay(patientId, day, limit) {
  const rs = await getCassandra().execute(
    `SELECT ${COLUMNS} FROM vital_signs_by_patient_day WHERE patient_id = ? AND day = ? LIMIT ?`,
    [patientId, LocalDate.fromString(day), limit],
    { prepare: true },
  );
  return rs.rows.map(toReading);
}

/** Q2: latest reading of several patients (IN on the partition key). */
export async function latest(patientIds) {
  const rs = await getCassandra().execute(
    `SELECT ${COLUMNS} FROM latest_vitals_by_patient WHERE patient_id IN ?`,
    [patientIds],
    { prepare: true },
  );
  return rs.rows.map(toReading);
}

/** Q3: abnormal readings on one day, newest first. */
export async function alerts(day, limit) {
  const rs = await getCassandra().execute(
    'SELECT recorded_at, patient_id, alert_type, detail FROM vital_alerts_by_day WHERE day = ? LIMIT ?',
    [LocalDate.fromString(day), limit],
    { prepare: true },
  );
  return rs.rows.map((row) => ({
    recordedAt: row.recorded_at,
    patientId: row.patient_id,
    type: row.alert_type,
    detail: row.detail,
  }));
}
