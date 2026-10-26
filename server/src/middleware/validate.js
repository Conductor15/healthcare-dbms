import { z } from 'zod';
import { HttpError } from '../utils/http-error.js';

z.config(z.locales.vi()); // default validation messages in Vietnamese

/** Parses req[source] with a zod schema; the parsed value is exposed as req.valid[source]. */
export const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(new HttpError(400, 'Dữ liệu không hợp lệ', details));
    }
    req.valid = { ...req.valid, [source]: result.data };
    next();
  };
