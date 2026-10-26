function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}: copy .env.example to .env at the repo root`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  mssql: {
    server: process.env.MSSQL_HOST ?? 'localhost',
    port: Number(process.env.MSSQL_PORT ?? 1433),
    database: process.env.MSSQL_DATABASE ?? 'HealthcareDB',
    user: 'sa',
    password: required('MSSQL_SA_PASSWORD'),
    options: { encrypt: false, trustServerCertificate: true },
  },
  cassandra: {
    contactPoints: (process.env.CASSANDRA_CONTACT_POINTS ?? 'localhost').split(','),
    localDataCenter: process.env.CASSANDRA_LOCAL_DC ?? 'dc1',
    keyspace: process.env.CASSANDRA_KEYSPACE ?? 'healthcare',
  },
};
