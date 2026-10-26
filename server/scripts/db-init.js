// DEV ONLY: drops and recreates HealthcareDB + the Cassandra keyspace from /database, then seeds users.
// Usage: npm run db:init            (both DBs)
//        npm run db:init -- mssql   (one of them)
import bcrypt from 'bcryptjs';
import cassandra from 'cassandra-driver';
import sql from 'mssql';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../src/config.js';

const DATABASE_DIR = path.resolve(import.meta.dirname, '../../database');

const SEED_USERS = [
  { username: 'admin', password: 'admin123', fullName: 'Quản trị viên', role: 'ADMIN', doctorId: null },
  {
    username: 'reception',
    password: 'reception123',
    fullName: 'Lễ tân Thu Hà',
    role: 'RECEPTIONIST',
    doctorId: null,
  },
  { username: 'doctor1', password: 'doctor123', fullName: 'BS. Nguyễn Văn An', role: 'DOCTOR', doctorId: 1 },
];

async function scripts(subdir, ext) {
  const dir = path.join(DATABASE_DIR, subdir);
  const files = (await readdir(dir)).filter((f) => f.endsWith(ext)).sort();
  return Promise.all(files.map(async (f) => ({ name: f, text: await readFile(path.join(dir, f), 'utf8') })));
}

async function initMssql() {
  const db = config.mssql.database;
  console.log(`SQL Server → recreating [${db}]`);

  const master = await new sql.ConnectionPool({ ...config.mssql, database: 'master' }).connect();
  await master.request().batch(`
    IF DB_ID(N'${db}') IS NOT NULL
    BEGIN
      ALTER DATABASE [${db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${db}];
    END`);
  await master.request().batch(`CREATE DATABASE [${db}]`);
  await master.close();

  const pool = await new sql.ConnectionPool(config.mssql).connect();
  for (const { name, text } of await scripts('mssql', '.sql')) {
    const batches = text
      .split(/^\s*GO\s*$/gim)
      .map((b) => b.trim())
      .filter(Boolean);
    for (const batch of batches) await pool.request().batch(batch);
    console.log(`  ✓ ${name} (${batches.length} batches)`);
  }

  for (const u of SEED_USERS) {
    await pool
      .request()
      .input('username', sql.VarChar(50), u.username)
      .input('hash', sql.VarChar(100), await bcrypt.hash(u.password, 10))
      .input('fullName', sql.NVarChar(100), u.fullName)
      .input('role', sql.VarChar(20), u.role)
      .input('doctorId', sql.Int, u.doctorId)
      .query(`INSERT INTO dbo.users (username, password_hash, full_name, role, doctor_id)
              VALUES (@username, @hash, @fullName, @role, @doctorId)`);
  }
  console.log(`  ✓ users: ${SEED_USERS.map((u) => `${u.username}/${u.password}`).join(', ')}`);
  await pool.close();
}

// Cassandra opens port 9042 well before it can answer queries (first boot ~60-90s), so poll until it does.
async function connectCassandra({ timeoutMs = 180_000, intervalMs = 5_000 } = {}) {
  const { contactPoints, localDataCenter } = config.cassandra;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // DDL (DROP KEYSPACE snapshots first) can exceed the driver's 12s default read timeout.
    const client = new cassandra.Client({
      contactPoints,
      localDataCenter,
      socketOptions: { readTimeout: 60_000 },
    });
    try {
      await client.execute('SELECT release_version FROM system.local');
      return client;
    } catch (err) {
      await client.shutdown().catch(() => {});
      if (Date.now() > deadline) throw err;
      console.log(`  … Cassandra not ready yet, retrying in ${intervalMs / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

async function initCassandra() {
  const { keyspace } = config.cassandra;
  console.log(`Cassandra → recreating keyspace ${keyspace}`);

  const client = await connectCassandra();
  await client.execute(`DROP KEYSPACE IF EXISTS ${keyspace}`);
  for (const { name, text } of await scripts('cassandra', '.cql')) {
    const statements = text
      .split('\n')
      .filter((line) => !/^\s*(--|\/\/)/.test(line))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) await client.execute(stmt);
    console.log(`  ✓ ${name} (${statements.length} statements)`);
  }
  await client.shutdown();
}

const only = process.argv[2];
try {
  if (!only || only === 'mssql') await initMssql();
  if (!only || only === 'cassandra') await initCassandra();
  console.log('Done.');
} catch (err) {
  console.error('db:init failed:', err.message);
  console.error('Are the containers healthy? → docker compose ps');
  process.exit(1);
}
