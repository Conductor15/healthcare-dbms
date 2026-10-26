import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import { HttpError, notFound } from '../../utils/http-error.js';
import * as repo from './auth.repository.js';

const toPublic = ({ passwordHash, isActive, ...user }) => user;

export async function login({ username, password }) {
  const user = await repo.findByUsername(username);
  const ok = user?.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu');

  const token = jwt.sign(
    { sub: user.id, role: user.role, doctorId: user.doctorId, name: user.fullName },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
  return { token, user: toPublic(user) };
}

export async function me(userId) {
  const user = await repo.findById(userId);
  if (!user) throw notFound('người dùng');
  return toPublic(user);
}
