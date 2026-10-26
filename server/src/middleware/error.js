import { HttpError } from '../utils/http-error.js';

// SQL Server error numbers that mean "the request conflicts with existing data", not a server bug.
const SQL_CONFLICTS = {
  2627: 'Dữ liệu bị trùng (vi phạm ràng buộc UNIQUE)',
  2601: 'Dữ liệu bị trùng (vi phạm chỉ mục UNIQUE)',
  547: 'Thao tác vi phạm ràng buộc dữ liệu (khoá ngoại hoặc CHECK)',
  1205: 'Giao dịch bị huỷ do deadlock, vui lòng thử lại',
};

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, `Không có endpoint ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  const sqlNumber = err.number ?? err.originalError?.info?.number;
  if (SQL_CONFLICTS[sqlNumber]) {
    return res.status(409).json({ error: SQL_CONFLICTS[sqlNumber], sqlNumber });
  }
  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau' });
}
