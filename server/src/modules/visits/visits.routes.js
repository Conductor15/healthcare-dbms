import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParam, optionalText } from '../../utils/schemas.js';
import * as service from './visits.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD');

const listQuery = z.object({
  patientId: z.coerce.number().int().positive().optional(),
  doctorId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createBody = z.object({
  appointmentId: z.coerce.number().int().positive().nullish(),
  patientId: z.coerce.number().int().positive(),
  doctorId: z.coerce.number().int().positive().nullish(),
  symptoms: optionalText(500),
  diagnosis: z.string().trim().min(2, 'Nhập chẩn đoán').max(500),
  notes: optionalText(4000),
  prescriptionNotes: optionalText(500),
  items: z
    .array(
      z.object({
        medicineId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1, 'Số lượng tối thiểu 1').max(1000),
        dosage: z.string().trim().min(2, 'Nhập liều dùng').max(200),
      }),
    )
    .max(20)
    .default([])
    .refine(
      (items) => new Set(items.map((i) => i.medicineId)).size === items.length,
      'Mỗi thuốc chỉ kê một dòng',
    ),
});

export const visitsRouter = Router();

visitsRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  res.json(await service.list(req.valid.query, req.user));
});

visitsRouter.get('/:id', validate(idParam, 'params'), async (req, res) => {
  res.json(await service.get(req.valid.params.id));
});

visitsRouter.post('/', requireRole('DOCTOR', 'ADMIN'), validate(createBody), async (req, res) => {
  res.status(201).json(await service.create(req.valid.body, req.user));
});

export const invoicesRouter = Router();

invoicesRouter.patch(
  '/:id/pay',
  requireRole('ADMIN', 'RECEPTIONIST'),
  validate(idParam, 'params'),
  async (req, res) => {
    res.json(await service.payInvoice(req.valid.params.id));
  },
);
