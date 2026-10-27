// S3.12: read the API access log that middleware/access-log.js writes to Cassandra (Q4). ADMIN only.
import { Router } from 'express';
import { z } from 'zod';
import { getCassandra, types } from '../../db/cassandra.js';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { clinicDate } from '../../utils/clinic-time.js';

const query = z.object({
  userId: z.coerce.number().int().positive(),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => clinicDate()),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export const accessLogsRouter = Router();

accessLogsRouter.get('/', requireRole('ADMIN'), validate(query, 'query'), async (req, res) => {
  const { userId, day, limit } = req.valid.query;
  const rs = await getCassandra().execute(
    'SELECT ts, method, path, status_code, ip FROM access_logs_by_user_day WHERE user_id = ? AND day = ? LIMIT ?',
    [userId, types.LocalDate.fromString(day), limit],
    { prepare: true },
  );
  res.json(
    rs.rows.map((r) => ({
      at: r.ts.getDate(),
      method: r.method,
      path: r.path,
      statusCode: r.status_code,
      ip: r.ip,
    })),
  );
});
