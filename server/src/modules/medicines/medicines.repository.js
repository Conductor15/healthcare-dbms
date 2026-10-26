import { getPool, sql } from '../../db/mssql.js';

export async function findAll(q) {
  const pool = await getPool();
  const request = pool.request();
  let where = '';
  if (q) {
    request.input('q', sql.NVarChar(152), `%${q}%`);
    where = 'WHERE name LIKE @q';
  }
  const { recordset } = await request.query(`
    SELECT medicine_id AS id, name, unit, unit_price AS unitPrice, stock_quantity AS stock
    FROM dbo.medicines ${where}
    ORDER BY name`);
  return recordset;
}
