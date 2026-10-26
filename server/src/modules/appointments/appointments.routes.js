import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParam, optionalText } from '../../utils/schemas.js';
import * as service from './appointments.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD');
const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const slotsQuery = z.object({ doctorId: z.coerce.number().int().positive(), date: isoDate });
const listQuery = z.object({
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  doctorId: z.coerce.number().int().positive().optional(),
  patientId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const bookBody = z.object({
  patientId: z.coerce.number().int().positive(),
  slotId: z.coerce.number().int().positive(),
  reason: optionalText(255),
});

export const slotsRouter = Router();
slotsRouter.get('/', validate(slotsQuery, 'query'), async (req, res) => {
  res.json(await service.slots(req.valid.query));
});

export const appointmentsRouter = Router();
const FRONT_DESK = ['ADMIN', 'RECEPTIONIST'];

appointmentsRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  res.json(await service.list(req.valid.query, req.user));
});

appointmentsRouter.get('/:id', validate(idParam, 'params'), async (req, res) => {
  res.json(await service.get(req.valid.params.id));
});

appointmentsRouter.post('/', requireRole(...FRONT_DESK), validate(bookBody), async (req, res) => {
  res.status(201).json(await service.book(req.valid.body, req.user));
});

appointmentsRouter.patch(
  '/:id/cancel',
  requireRole(...FRONT_DESK),
  validate(idParam, 'params'),
  async (req, res) => {
    res.json(await service.cancel(req.valid.params.id));
  },
);

appointmentsRouter.delete('/:id', requireRole('ADMIN'), validate(idParam, 'params'), async (req, res) => {
  await service.remove(req.valid.params.id);
  res.status(204).end();
});
