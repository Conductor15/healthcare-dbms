import { z } from 'zod';

export const idParam = z.object({ id: z.coerce.number().int().positive() });

/** Optional trimmed text; empty string becomes null so it is stored as NULL. */
export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .nullish()
    .transform((v) => v || null);
