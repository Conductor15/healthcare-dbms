// Data-access layer: the only place that talks SQL. Always bind values with .input(), never concatenate.
import { getPool, sql } from '../../db/mssql.js';

// Correlated subquery (query type g) to count doctors per department.
const SELECT = `
  SELECT d.department_id AS id, d.name, d.location, d.description, d.created_at AS createdAt,
         (SELECT COUNT(*) FROM dbo.doctors doc WHERE doc.department_id = d.department_id) AS doctorCount
  FROM dbo.departments d`;

const bindBody = (request, { name, location, description }) =>
  request
    .input('name', sql.NVarChar(100), name)
    .input('location', sql.NVarChar(100), location)
    .input('description', sql.NVarChar(500), description);

export async function findAll({ q }) {
  const pool = await getPool();
  const request = pool.request();
  let where = '';
  if (q) {
    request.input('q', sql.NVarChar(102), `%${q}%`);
    where = 'WHERE d.name LIKE @q'; // query type d: single condition
  }
  const { recordset } = await request.query(`${SELECT} ${where} ORDER BY d.name`);
  return recordset;
}

export async function findById(id) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`${SELECT} WHERE d.department_id = @id`);
  return recordset[0];
}

export async function insert(data) {
  const pool = await getPool();
  const { recordset } = await bindBody(pool.request(), data).query(`
    INSERT INTO dbo.departments (name, location, description)
    OUTPUT INSERTED.department_id AS id
    VALUES (@name, @location, @description)`);
  return recordset[0].id;
}

/** @returns number of rows updated (0 = not found) */
export async function update(id, data) {
  const pool = await getPool();
  const { rowsAffected } = await bindBody(pool.request().input('id', sql.Int, id), data).query(`
    UPDATE dbo.departments
    SET name = @name, location = @location, description = @description
    WHERE department_id = @id`);
  return rowsAffected[0];
}

/** @returns number of rows deleted (0 = not found) */
export async function remove(id) {
  const pool = await getPool();
  const { rowsAffected } = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM dbo.departments WHERE department_id = @id');
  return rowsAffected[0];
}
