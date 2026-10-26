// HTTP layer: validate input, check role, call the service, shape the response.
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParam, optionalText } from '../../utils/schemas.js';
import * as service from './departments.service.js';

const listQuery = z.object({ q: z.string().trim().max(100).optional() });

const departmentBody = z.object({
  name: z.string().trim().min(2, 'Tên khoa tối thiểu 2 ký tự').max(100, 'Tối đa 100 ký tự'),
  location: optionalText(100),
  description: optionalText(500),
});

export const departmentsRouter = Router();

departmentsRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  res.json(await service.list(req.valid.query));
});

departmentsRouter.get('/:id', validate(idParam, 'params'), async (req, res) => {
  res.json(await service.get(req.valid.params.id));
});

departmentsRouter.post('/', requireRole('ADMIN'), validate(departmentBody), async (req, res) => {
  res.status(201).json(await service.create(req.valid.body));
});

departmentsRouter.put(
  '/:id',
  requireRole('ADMIN'),
  validate(idParam, 'params'),
  validate(departmentBody),
  async (req, res) => {
    res.json(await service.update(req.valid.params.id, req.valid.body));
  },
);

departmentsRouter.delete('/:id', requireRole('ADMIN'), validate(idParam, 'params'), async (req, res) => {
  await service.remove(req.valid.params.id);
  res.status(204).end();
});
