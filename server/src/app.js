import cors from 'cors';
import express, { Router } from 'express';
import { config } from './config.js';
import { accessLog } from './middleware/access-log.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { departmentsRouter } from './modules/departments/departments.routes.js';
import { healthRouter } from './modules/health/health.routes.js';

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
app.use('/api', api);

app.use(notFoundHandler);
app.use(errorHandler);
