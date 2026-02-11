import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
export const schoolKeySchema = z.string().trim().min(1).max(64);

export function parseOr400<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false as const, status: 400, message };
  }
  return { ok: true as const, data: result.data as z.infer<T> };
}
