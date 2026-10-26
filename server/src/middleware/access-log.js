import { getCassandra, types } from '../db/cassandra.js';

const INSERT = `INSERT INTO access_logs_by_user_day (user_id, day, ts, method, path, status_code, ip)
                VALUES (?, ?, now(), ?, ?, ?, ?)`;

/**
 * Step S3.12: one row per authenticated API call → Cassandra (append-only, high volume:
 * the NoSQL half of the polyglot design). Fire-and-forget: logging must never break a request.
 */
export function accessLog(req, res, next) {
  res.on('finish', () => {
    if (!req.user) return;
    const params = [
      req.user.sub,
      types.LocalDate.fromDate(new Date()),
      req.method,
      req.originalUrl,
      res.statusCode,
      req.ip,
    ];
    getCassandra()
      .execute(INSERT, params, { prepare: true })
      .catch((err) => console.warn('[access-log] skipped:', err.message));
  });
  next();
}
