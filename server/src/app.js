import cors from 'cors';
import express, { Router } from 'express';
import { config } from './config.js';
import { accessLog } from './middleware/access-log.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { accessLogsRouter } from './modules/access-logs/access-logs.routes.js';
import { appointmentsRouter, slotsRouter } from './modules/appointments/appointments.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { departmentsRouter } from './modules/departments/departments.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { labRouter } from './modules/lab/lab.routes.js';
import { lookupsRouter } from './modules/lookups/lookups.routes.js';
import { medicinesRouter } from './modules/medicines/medicines.routes.js';
import { invoicesRouter, visitsRouter } from './modules/visits/visits.routes.js';
import { vitalsRouter } from './modules/vitals/vitals.routes.js';

export const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

// Public
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

// Authenticated: every call below is logged to Cassandra.
// Each owner adds ONE line here per module (see CONTRIBUTING §4 and docs/design/api.md).
const api = Router();
api.use(authenticate, accessLog);
api.use('/departments', departmentsRouter); // S0.4 reference module
// Hoàng
api.use('/lookups', lookupsRouter);
api.use('/medicines', medicinesRouter);
api.use('/slots', slotsRouter); // FR3
api.use('/appointments', appointmentsRouter); // FR3
api.use('/visits', visitsRouter); // FR4, FR6
api.use('/invoices', invoicesRouter); // FR4
api.use('/vitals', vitalsRouter); // FR9 (Cassandra)
api.use('/access-logs', accessLogsRouter); // S3.12 (Cassandra)
api.use('/lab', labRouter); // DB Lab (bonus)
// Dương
app.use('/api', api);

app.use(notFoundHandler);
app.use(errorHandler);
