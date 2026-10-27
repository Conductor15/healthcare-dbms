import { getPool, sql } from '../../db/mssql.js';

/** Top 20 patients whose name or phone matches `q` (empty `q` → most recent patients). */
export async function patients(q) {
  const pool = await getPool();
  const request = pool.request();
  let where = '';
  if (q) {
    request.input('name', sql.NVarChar(102), `%${q}%`).input('phone', sql.VarChar(17), `${q}%`);
    where = 'WHERE full_name LIKE @name OR phone LIKE @phone';
  }
  const { recordset } = await request.query(`
    SELECT TOP (20) patient_id AS id, full_name AS fullName, phone, date_of_birth AS dateOfBirth, gender
    FROM dbo.patients ${where}
    ORDER BY patient_id DESC`);
  return recordset;
}

/** Active doctors with their department, optionally filtered by department. */
export async function doctors(departmentId) {
  const pool = await getPool();
  const request = pool.request();
  let filter = '';
  if (departmentId) {
    request.input('departmentId', sql.Int, departmentId);
    filter = 'AND d.department_id = @departmentId';
  }
  const { recordset } = await request.query(`
    SELECT d.doctor_id AS id, d.full_name AS fullName, d.department_id AS departmentId,
           dep.name AS departmentName, d.consultation_fee AS consultationFee
    FROM dbo.doctors d JOIN dbo.departments dep ON dep.department_id = d.department_id
    WHERE d.is_active = 1 ${filter}
    ORDER BY dep.name, d.full_name`);
  return recordset;
}

export async function users() {
  const pool = await getPool();
  const { recordset } = await pool.request().query(`
    SELECT user_id AS id, username, full_name AS fullName, role FROM dbo.users ORDER BY user_id`);
  return recordset;
}
