import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization ?? '';
  // EventSource (SSE) cannot send headers, so only event-stream requests may pass the token in the URL
  const isEventStream = req.headers.accept === 'text/event-stream';
  const token = header.startsWith('Bearer ') ? header.slice(7) : isEventStream ? req.query.token : null;
  if (!token) return next(new HttpError(401, 'Bạn chưa đăng nhập'));
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    next(new HttpError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'));
  }
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, 'Bạn không có quyền thực hiện thao tác này'));
