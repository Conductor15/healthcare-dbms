import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import * as repo from './medicines.repository.js';

export const medicinesRouter = Router();

// Read-only list for the prescription form (stock shown so the doctor sees what is available).
medicinesRouter.get(
  '/',
  validate(z.object({ q: z.string().trim().max(100).optional() }), 'query'),
  async (req, res) => res.json(await repo.findAll(req.valid.query.q)),
);
