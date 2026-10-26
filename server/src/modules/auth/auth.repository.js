import { getPool, sql } from '../../db/mssql.js';

const COLUMNS = `user_id AS id, username, full_name AS fullName, role, doctor_id AS doctorId,
                 is_active AS isActive, password_hash AS passwordHash`;

export async function findByUsername(username) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input('username', sql.VarChar(50), username)
    .query(`SELECT ${COLUMNS} FROM dbo.users WHERE username = @username`);
  return recordset[0];
}

export async function findById(id) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`SELECT ${COLUMNS} FROM dbo.users WHERE user_id = @id`);
  return recordset[0];
}
