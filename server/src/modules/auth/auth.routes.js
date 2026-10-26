import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './auth.service.js';

const loginBody = z.object({
  username: z.string().trim().min(1, 'Nhập tên đăng nhập'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});

export const authRouter = Router();

authRouter.post('/login', validate(loginBody), async (req, res) => {
  res.json(await service.login(req.valid.body));
});

authRouter.get('/me', authenticate, async (req, res) => {
  res.json(await service.me(req.user.sub));
});
