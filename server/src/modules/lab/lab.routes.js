// DB Lab API (bonus): run the topic iv–vi experiments from the app. ADMIN only.
// Topics i–iii (Dương, S3.10) add their routes here too.
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { HttpError } from '../../utils/http-error.js';
import { listBackups, pointInTimeDemo, takeBackup } from './backup.lab.js';
import { bookingModes, deadlock, doubleBooking, isolationMatrix } from './concurrency.lab.js';
import { visitWorkflow } from './transaction.lab.js';

export const labRouter = Router();
labRouter.use(requireRole('ADMIN'));

// Experiments share lab tables: run one at a time.
let running = null;
const exclusive = (name, fn) => async (req, res) => {
  if (running) throw new HttpError(409, `Đang chạy thí nghiệm "${running}", vui lòng đợi`);
  running = name;
  try {
    res.json(await fn(req));
  } finally {
    running = null;
  }
};

// ---- iv. Transaction
const transactionBody = z.object({
  dbms: z.enum(['mssql', 'cassandra']),
  failAt: z.coerce.number().int().min(1).max(5).nullish(),
  useBatch: z.boolean().optional(),
});
labRouter.post(
  '/transaction',
  validate(transactionBody),
  exclusive('transaction', (req) => visitWorkflow(req.valid.body)),
);

// ---- v. Concurrency
labRouter.get(
  '/concurrency/isolation-matrix',
  exclusive('isolation matrix', () => isolationMatrix()),
);
const bookingBody = z.object({
  mode: z.enum(bookingModes),
  requests: z.coerce.number().int().min(2).max(200).default(50),
});
labRouter.post(
  '/concurrency/double-booking',
  validate(bookingBody),
  exclusive('double booking', (req) => doubleBooking(req.valid.body.mode, req.valid.body.requests)),
);
labRouter.post(
  '/concurrency/deadlock',
  exclusive('deadlock', () => deadlock()),
);

// ---- vi. Backup & recovery
labRouter.get('/backups', async (req, res) => res.json(await listBackups()));
labRouter.post(
  '/backups',
  validate(z.object({ type: z.enum(['FULL', 'DIFF', 'LOG']) })),
  exclusive('backup', (req) => takeBackup(req.valid.body.type)),
);
labRouter.post(
  '/backups/point-in-time-demo',
  exclusive('point-in-time restore', () => pointInTimeDemo()),
);
