// Small read-only endpoints that feed <Select> boxes (autocomplete). Too thin for a service layer:
// the router calls the repository directly. Full CRUD for patients/doctors lives in their own modules.
import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as repo from './lookups.repository.js';

export const lookupsRouter = Router();

lookupsRouter.get(
  '/patients',
  validate(z.object({ q: z.string().trim().max(100).optional() }), 'query'),
  async (req, res) => res.json(await repo.patients(req.valid.query.q)),
);

lookupsRouter.get(
  '/doctors',
  validate(z.object({ departmentId: z.coerce.number().int().positive().optional() }), 'query'),
  async (req, res) => res.json(await repo.doctors(req.valid.query.departmentId)),
);

lookupsRouter.get('/users', requireRole('ADMIN'), async (req, res) => res.json(await repo.users()));
