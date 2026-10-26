import { app } from './app.js';
import { config } from './config.js';
import { closeCassandra } from './db/cassandra.js';
import { closeMssql } from './db/mssql.js';

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (health: /api/health)`);
});

async function shutdown() {
  server.close();
  await Promise.allSettled([closeMssql(), closeCassandra()]);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
