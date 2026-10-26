import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { clinicDate } from '../../utils/clinic-time.js';
import * as service from './vitals.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD');
const patientParam = z.object({ patientId: z.coerce.number().int().positive() });
const dayQuery = z.object({
  day: isoDate.default(() => clinicDate()),
  limit: z.coerce.number().int().min(1).max(5000).default(300),
});
const readingBody = z.object({
  patientId: z.coerce.number().int().positive(),
  heartRate: z.coerce.number().int().min(20).max(250),
  systolicBp: z.coerce.number().int().min(50).max(260),
  diastolicBp: z.coerce.number().int().min(30).max(160),
  spo2: z.coerce.number().int().min(50).max(100),
  temperature: z.coerce.number().min(30).max(45),
  deviceId: z.string().trim().max(50).optional(),
});
const simulatorBody = z.object({
  patientIds: z.array(z.coerce.number().int().positive()).min(1).max(20),
  intervalMs: z.coerce.number().int().min(200).max(10_000).default(1000),
  durationSec: z.coerce.number().int().min(5).max(1800).default(120),
});
const CLINICAL = ['ADMIN', 'DOCTOR'];

export const vitalsRouter = Router();

vitalsRouter.get('/alerts', validate(dayQuery, 'query'), async (req, res) => {
  res.json(await service.alerts(req.valid.query));
});

vitalsRouter.get(
  '/latest',
  validate(z.object({ patientIds: z.string().regex(/^\d+(,\d+)*$/, 'Dạng 1,2,3') }), 'query'),
  async (req, res) => {
    res.json(await service.latest(req.valid.query.patientIds.split(',').map(Number)));
  },
);

vitalsRouter.get('/simulator', (req, res) => res.json(service.simulatorStatus()));
vitalsRouter.post('/simulator', requireRole(...CLINICAL), validate(simulatorBody), (req, res) => {
  res.status(201).json(service.startSimulator(req.valid.body));
});
vitalsRouter.delete('/simulator', requireRole(...CLINICAL), (req, res) => res.json(service.stopSimulator()));

vitalsRouter.post('/', requireRole(...CLINICAL), validate(readingBody), async (req, res) => {
  res.status(201).json(await service.record(req.valid.body));
});

vitalsRouter.get(
  '/:patientId',
  validate(patientParam, 'params'),
  validate(dayQuery, 'query'),
  async (req, res) => {
    res.json(await service.history(req.valid.params.patientId, req.valid.query));
  },
);

/** Server-Sent Events: pushes every new reading of this patient (EventSource sends the token as ?token=). */
vitalsRouter.get('/:patientId/stream', validate(patientParam, 'params'), (req, res) => {
  const { patientId } = req.valid.params;
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const onReading = (reading) => {
    if (reading.patientId === patientId) res.write(`data: ${JSON.stringify(reading)}\n\n`);
  };
  service.vitalsBus.on('reading', onReading);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    service.vitalsBus.off('reading', onReading);
    clearInterval(keepAlive);
  });
});
